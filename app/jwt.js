// Zero-dependency JWT minting for the local Daml JSON API.
// The sandbox runs with --allow-insecure-tokens, so any HS256 signature is
// accepted (the signature is not verified); only the claims matter.
//
// When deploying to Seaport or another hosted participant, replace the secret
// with the real signing secret (or use the token the platform issues) and set
// LEDGER_ID accordingly.
const crypto = require("crypto");

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mint({
  ledgerId = "sandbox",
  applicationId = "blackrocq",
  actAs = [],
  readAs = null,
  admin = false,
  secret = "secret",
}) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    "https://daml.com/ledger-api": {
      ledgerId,
      applicationId,
      actAs,
      readAs: readAs === null ? actAs : readAs,
      admin,
    },
  };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

module.exports = { mint };

// CLI: node jwt.js admin=true ledgerId=sandbox actAs=Alice::123,Bob::456
if (require.main === module) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.split("=");
      return [k, v.join("=")];
    })
  );
  console.log(
    mint({
      ledgerId: args.ledgerId || "sandbox",
      applicationId: args.app || "blackrocq",
      actAs: args.actAs ? args.actAs.split(",") : [],
      admin: args.admin === "true",
    })
  );
}
