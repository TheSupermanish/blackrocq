// blackrocq demo backend.
//
// Zero-dependency Node server that drives the confidential OTC flow through the
// Daml JSON API and exposes a tiny REST surface for the split-screen UI.
//
// Everything that points at the ledger is env-configurable, so the SAME app
// runs against the local Canton sandbox or a hosted participant (e.g. Seaport):
//   LEDGER_JSON_API   default http://localhost:7575
//   LEDGER_ID         default "sandbox"
//   JWT_SECRET        default "secret"   (sandbox runs --allow-insecure-tokens)
//   PKG_ID            main package id of the deployed DAR
//   PORT              default 4000
const http = require("http");
const fs = require("fs");
const path = require("path");
const { mint } = require("./jwt");

const JSON_API = process.env.LEDGER_JSON_API || "http://localhost:7575";
const LEDGER_ID = process.env.LEDGER_ID || "sandbox";
const SECRET = process.env.JWT_SECRET || "secret";
const PORT = Number(process.env.PORT || 4000);
const PKG =
  process.env.PKG_ID ||
  fs.readFileSync(path.join(__dirname, ".pkgid"), "utf8").trim();

const TPL = {
  Holding: `${PKG}:Asset:Holding`,
  RFQ: `${PKG}:Trading:RFQ`,
  TradeProposal: `${PKG}:Trading:TradeProposal`,
  Trade: `${PKG}:Trading:Trade`,
};
const ALL_TEMPLATES = Object.values(TPL);
const shortName = (tid) => tid.split(":").slice(-1)[0]; // "...:Trading:RFQ" -> "RFQ"

// ---- JSON API helpers --------------------------------------------------------
function tokenFor(parties, admin = false) {
  return mint({ ledgerId: LEDGER_ID, secret: SECRET, actAs: parties, admin });
}

async function api(pathname, token, body) {
  const res = await fetch(`${JSON_API}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (json.status !== 200) {
    throw new Error(`${pathname} failed: ${JSON.stringify(json.errors || json)}`);
  }
  return json.result;
}

const allocateParty = (hint) =>
  api("/v1/parties/allocate", tokenFor([], true), { identifierHint: hint }).then(
    (r) => r.identifier
  );

const create = (token, templateId, payload) =>
  api("/v1/create", token, { templateId, payload }).then((r) => r.contractId);

const exercise = (token, templateId, contractId, choice, argument = {}) =>
  api("/v1/exercise", token, { templateId, contractId, choice, argument });

const queryAs = (token) =>
  api("/v1/query", token, { templateIds: ALL_TEMPLATES }).then((rows) =>
    rows.map((r) => ({
      type: shortName(r.templateId),
      contractId: r.contractId,
      payload: r.payload,
    }))
  );

// ---- Session state -----------------------------------------------------------
// A "session" is a fresh set of parties. Because Canton visibility is per party,
// a new party set is automatically a clean slate: old contracts are invisible.
let S = null;

async function initSession() {
  // Canton derives a party's id deterministically from its hint, so each
  // session uses a unique tag to get a fresh, clean set of parties. Because
  // visibility is per party, a new set is automatically a clean slate.
  const tag = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const [custodian, fund, dealer, rival, regulator] = await Promise.all([
    allocateParty(`Custodian-${tag}`),
    allocateParty(`PensionFund-${tag}`),
    allocateParty(`BankDealer-${tag}`),
    allocateParty(`RivalDealer-${tag}`),
    allocateParty(`Regulator-${tag}`),
  ]);

  const tok = {
    fund: tokenFor([fund]),
    dealer: tokenFor([dealer]),
    rival: tokenFor([rival]),
    regulator: tokenFor([regulator]),
    settle: tokenFor([fund, dealer]), // co-authorized atomic settlement
  };

  // Seed initial holdings: the dealer owns the bond, the fund owns the cash.
  const bondCid = await create(tok.dealer, TPL.Holding, {
    issuer: custodian,
    owner: dealer,
    regulator,
    instrument: "ACME-2030-BOND",
    amount: "1000.0",
  });
  const cashCid = await create(tok.fund, TPL.Holding, {
    issuer: custodian,
    owner: fund,
    regulator,
    instrument: "USD",
    amount: "1000000.0",
  });

  S = {
    parties: { custodian, fund, dealer, rival, regulator },
    tok,
    cids: { bondCid, cashCid, rfqCid: null, proposalCid: null, tradeCid: null },
    instrument: "ACME-2030-BOND",
    quantity: 1000,
    unitPrice: null,
    step: "seeded",
  };
  return S;
}

// ---- Flow steps --------------------------------------------------------------
async function doRfq() {
  const { parties, tok } = S;
  S.cids.rfqCid = await create(tok.fund, TPL.RFQ, {
    buyer: parties.fund,
    dealer: parties.dealer,
    regulator: parties.regulator,
    instrument: S.instrument,
    quantity: String(S.quantity) + ".0",
  });
  S.step = "rfq";
}

async function doQuote(unitPrice) {
  S.unitPrice = unitPrice;
  const r = await exercise(S.tok.dealer, TPL.RFQ, S.cids.rfqCid, "Quote", {
    unitPrice: String(unitPrice) + ".0",
  });
  S.cids.proposalCid = r.exerciseResult;
  S.step = "quote";
}

async function doAccept() {
  const r = await exercise(
    S.tok.fund,
    TPL.TradeProposal,
    S.cids.proposalCid,
    "AcceptQuote"
  );
  S.cids.tradeCid = r.exerciseResult;
  S.step = "accept";
}

async function doSettle() {
  const cashAmount = S.quantity * S.unitPrice; // 1000 * 950 = 950000
  // Carve the exact payment leg out of the fund's cash.
  const split = await exercise(S.tok.fund, TPL.Holding, S.cids.cashCid, "Split", {
    splitAmount: String(cashAmount) + ".0",
  });
  const paymentCid = split.exerciseResult._1;
  // Atomic delivery-versus-payment, co-authorized by both counterparties.
  await exercise(S.tok.settle, TPL.Trade, S.cids.tradeCid, "Settle", {
    assetCid: S.cids.bondCid,
    cashCid: paymentCid,
  });
  S.step = "settled";
}

async function buildState() {
  const [fundView, dealerView, rivalView, regView] = await Promise.all([
    queryAs(S.tok.fund),
    queryAs(S.tok.dealer),
    queryAs(S.tok.rival),
    queryAs(S.tok.regulator),
  ]);
  // Counterparties panel = union of what the two trading parties can see.
  const byCid = new Map();
  for (const c of [...fundView, ...dealerView]) byCid.set(c.contractId, c);
  return {
    step: S.step,
    parties: S.parties,
    quantity: S.quantity,
    unitPrice: S.unitPrice,
    views: {
      counterparties: [...byCid.values()],
      rival: rivalView,
      regulator: regView,
    },
  };
}

// ---- HTTP router -------------------------------------------------------------
const send = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
};

const STATIC_DIR = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function serveStatic(req, res) {
  let p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = path.join(STATIC_DIR, p);
  if (!file.startsWith(STATIC_DIR) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "text/plain" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url.startsWith("/api/state")) {
      return send(res, 200, await buildState());
    }
    if (req.method === "POST") {
      const actions = {
        "/api/reset": initSession,
        "/api/rfq": doRfq,
        "/api/quote": async () => doQuote(950),
        "/api/accept": doAccept,
        "/api/settle": doSettle,
      };
      const act = actions[req.url];
      if (act) {
        await act();
        return send(res, 200, await buildState());
      }
    }
    return serveStatic(req, res);
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
});

initSession()
  .then(() => {
    server.listen(PORT, () =>
      console.log(`blackrocq demo on http://localhost:${PORT}  (ledger ${JSON_API})`)
    );
  })
  .catch((e) => {
    console.error("startup failed:", e);
    process.exit(1);
  });
