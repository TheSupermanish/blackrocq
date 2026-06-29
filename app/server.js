// blackrocq demo backend, confidential DeFi on Canton.
//
// Zero-dependency Node server that drives three private primitives through the
// Daml JSON API and exposes a small REST surface for the UI:
//   send   - a confidential transfer
//   swap   - an instant atomic asset-for-asset exchange (post + fill an order)
//   order  - a resting confidential limit order (fill / cancel later)
//
// Env-configurable so the same app runs on the local sandbox or a hosted
// participant (Seaport): LEDGER_JSON_API, LEDGER_ID, JWT_SECRET, PKG_ID, PORT.
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

const TPL = { Holding: `${PKG}:Asset:Holding`, Order: `${PKG}:Trading:Order` };
const ALL = Object.values(TPL);
const short = (tid) => tid.split(":").slice(-1)[0];
const fmt = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));

// ---- JSON API helpers --------------------------------------------------------
const tokenFor = (parties, admin = false) =>
  mint({ ledgerId: LEDGER_ID, secret: SECRET, actAs: parties, admin });

async function call(pathname, token, body) {
  const res = await fetch(`${JSON_API}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (json.status !== 200)
    throw new Error(`${pathname}: ${JSON.stringify(json.errors || json)}`);
  return json.result;
}
const allocate = (hint) =>
  call("/v1/parties/allocate", tokenFor([], true), { identifierHint: hint }).then((r) => r.identifier);
const create = (token, templateId, payload) =>
  call("/v1/create", token, { templateId, payload }).then((r) => r.contractId);
const exercise = (token, templateId, contractId, choice, argument = {}) =>
  call("/v1/exercise", token, { templateId, contractId, choice, argument });
const queryAs = (token) =>
  call("/v1/query", token, { templateIds: ALL }).then((rows) =>
    rows.map((r) => ({ type: short(r.templateId), contractId: r.contractId, payload: r.payload }))
  );

// ---- Session state -----------------------------------------------------------
let S = null;
const NAME = { alice: "Alice", bob: "Bob", market: "Market", regulator: "Regulator", custodian: "Custodian" };
const labelOwner = (id) => {
  if (!S) return id;
  for (const k of Object.keys(S.parties)) if (S.parties[k] === id) return NAME[k];
  return String(id).split("-")[0];
};
const logTx = (action, text) => {
  S.log.unshift({ action, text, n: ++S.txCount });
  S.log = S.log.slice(0, 12);
};

async function initSession() {
  const tag = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const [custodian, alice, bob, market, regulator] = await Promise.all([
    allocate(`Custodian-${tag}`),
    allocate(`Alice-${tag}`),
    allocate(`Bob-${tag}`),
    allocate(`Market-${tag}`),
    allocate(`Regulator-${tag}`),
  ]);
  const parties = { custodian, alice, bob, market, regulator };
  const tok = {
    alice: tokenFor([alice]),
    bob: tokenFor([bob]),
    market: tokenFor([market]),
    regulator: tokenFor([regulator]),
    co: tokenFor([alice, bob]), // co-authorize 2-party actions (send/swap/fill)
  };
  const tokById = { [alice]: tok.alice, [bob]: tok.bob };

  S = { parties, tok, tokById, reserved: new Set(), orders: {}, log: [], txCount: 0 };

  // Seed wallets. Both users hold both tokens so either can make or take.
  const reg = regulator;
  const seed = (token, owner, instrument, amount) =>
    create(token, TPL.Holding, { issuer: custodian, owner, regulator: reg, instrument, amount: fmt(amount) });
  await Promise.all([
    seed(tok.alice, alice, "wBTC", 5),
    seed(tok.alice, alice, "USDC", 200000),
    seed(tok.bob, bob, "wBTC", 2),
    seed(tok.bob, bob, "USDC", 500000),
  ]);
  logTx("seed", "Alice: 5 wBTC + 200,000 USDC   Bob: 2 wBTC + 500,000 USDC");
  return S;
}

// Find (or split out) a holding of exactly `amount` of `instrument` owned by
// `owner`, skipping holdings reserved to back resting orders.
async function splitToExact(token, owner, instrument, amount) {
  const rows = await queryAs(token);
  const cands = rows.filter(
    (c) => c.type === "Holding" && c.payload.owner === owner &&
      c.payload.instrument === instrument && !S.reserved.has(c.contractId)
  );
  const exact = cands.find((c) => parseFloat(c.payload.amount) === amount);
  if (exact) return exact.contractId;
  const big = cands.find((c) => parseFloat(c.payload.amount) > amount);
  if (!big) throw new Error(`${labelOwner(owner)} has insufficient ${instrument} (need ${amount})`);
  const r = await exercise(token, TPL.Holding, big.contractId, "Split", { splitAmount: fmt(amount) });
  return r.exerciseResult._1;
}

// ---- Actions -----------------------------------------------------------------
async function doSend(b = {}) {
  const from = b.from || S.parties.alice, to = b.to || S.parties.bob;
  const instrument = b.instrument || "USDC", amount = b.amount ?? 5000;
  const piece = await splitToExact(S.tokById[from], from, instrument, amount);
  await exercise(S.tok.co, TPL.Holding, piece, "Transfer", { newOwner: to });
  logTx("send", `${labelOwner(from)} privately sent ${amount.toLocaleString()} ${instrument} to ${labelOwner(to)}`);
}

async function placeOrder(b = {}) {
  const maker = b.maker || S.parties.alice, taker = b.taker || S.parties.bob;
  const gI = b.giveInstrument || "wBTC", gA = b.giveAmount ?? 1;
  const wI = b.wantInstrument || "USDC", wA = b.wantAmount ?? 66000;
  const makerHoldingCid = await splitToExact(S.tokById[maker], maker, gI, gA); // pre-size + reserve the give-leg
  const orderCid = await create(S.tokById[maker], TPL.Order, {
    maker, taker, regulator: S.parties.regulator,
    giveInstrument: gI, giveAmount: fmt(gA), wantInstrument: wI, wantAmount: fmt(wA),
  });
  S.reserved.add(makerHoldingCid);
  S.orders[orderCid] = { maker, taker, makerHoldingCid, giveInstrument: gI, giveAmount: gA, wantInstrument: wI, wantAmount: wA };
  logTx("order", `${labelOwner(maker)} posted a private limit order: give ${gA} ${gI} for ${wA.toLocaleString()} ${wI}`);
  return orderCid;
}

async function fillOrder(orderCid, rec) {
  const o = rec || S.orders[orderCid];
  if (!o) throw new Error("unknown order");
  const makerHoldingCid = o.makerHoldingCid || (await splitToExact(S.tokById[o.maker], o.maker, o.giveInstrument, o.giveAmount));
  const takerHoldingCid = await splitToExact(S.tokById[o.taker], o.taker, o.wantInstrument, o.wantAmount);
  await exercise(S.tok.co, TPL.Order, orderCid, "Fill", { makerHoldingCid, takerHoldingCid });
  S.reserved.delete(makerHoldingCid);
  delete S.orders[orderCid];
  logTx("fill", `${labelOwner(o.taker)} filled: ${o.giveAmount} ${o.giveInstrument} ⇄ ${o.wantAmount.toLocaleString()} ${o.wantInstrument} (atomic swap)`);
}

async function doFill(b = {}) {
  if (!b.orderCid) throw new Error("orderCid required");
  await fillOrder(b.orderCid);
}

// Swap = post an order and fill it immediately.
async function doSwap(b = {}) {
  const maker = b.maker || S.parties.alice, taker = b.taker || S.parties.bob;
  const gI = b.giveInstrument || "wBTC", gA = b.giveAmount ?? 0.5;
  const wI = b.wantInstrument || "USDC", wA = b.wantAmount ?? 32500;
  const makerHoldingCid = await splitToExact(S.tokById[maker], maker, gI, gA);
  const orderCid = await create(S.tokById[maker], TPL.Order, {
    maker, taker, regulator: S.parties.regulator,
    giveInstrument: gI, giveAmount: fmt(gA), wantInstrument: wI, wantAmount: fmt(wA),
  });
  await fillOrder(orderCid, { maker, taker, makerHoldingCid, giveInstrument: gI, giveAmount: gA, wantInstrument: wI, wantAmount: wA });
  S.log[0].action = "swap";
  S.log[0].text = `${labelOwner(maker)} swapped ${gA} ${gI} for ${wA.toLocaleString()} ${wI} with ${labelOwner(taker)} (private, atomic)`;
}

async function doCancel(b = {}) {
  const o = S.orders[b.orderCid];
  if (!o) throw new Error("unknown order");
  await exercise(S.tokById[o.maker], TPL.Order, b.orderCid, "Cancel");
  S.reserved.delete(o.makerHoldingCid);
  delete S.orders[b.orderCid];
  logTx("cancel", `${labelOwner(o.maker)} cancelled their limit order`);
}

// ---- State -------------------------------------------------------------------
async function buildState() {
  const [a, bv, m, r] = await Promise.all([
    queryAs(S.tok.alice), queryAs(S.tok.bob), queryAs(S.tok.market), queryAs(S.tok.regulator),
  ]);
  const byCid = new Map();
  for (const c of [...a, ...bv]) byCid.set(c.contractId, c);
  const counterparties = [...byCid.values()];
  const orders = r.filter((c) => c.type === "Order").map((c) => ({ contractId: c.contractId, ...c.payload }));
  return {
    parties: S.parties,
    names: NAME,
    views: { counterparties, market: m, regulator: r },
    orders,
    log: S.log,
  };
}

// ---- HTTP --------------------------------------------------------------------
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((resolve) => {
  let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
});
const STATIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
function serveStatic(req, res) {
  const p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = path.join(STATIC, p);
  if (!file.startsWith(STATIC) || !fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "text/plain" });
  fs.createReadStream(file).pipe(res);
}

const ACTIONS = {
  "/api/reset": initSession,
  "/api/send": doSend,
  "/api/swap": doSwap,
  "/api/order": placeOrder,
  "/api/fill": doFill,
  "/api/cancel": doCancel,
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url.startsWith("/api/state")) return send(res, 200, await buildState());
    if (req.method === "POST" && ACTIONS[req.url]) {
      const body = await readBody(req);
      await ACTIONS[req.url](body);
      return send(res, 200, await buildState());
    }
    return serveStatic(req, res);
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
});

initSession()
  .then(() => server.listen(PORT, () => console.log(`blackrocq on http://localhost:${PORT}  (ledger ${JSON_API}, pkg ${PKG.slice(0, 8)})`)))
  .catch((e) => { console.error("startup failed:", e); process.exit(1); });
