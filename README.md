# blackrocq

**Confidential OTC trading desk on Canton.**

Two institutions agree a large block trade: size, price, counterparties, and
the trade itself stay private to the parties involved (plus an optional
regulator). Settlement is atomic delivery-versus-payment: the asset and the
cash change hands in one transaction, or neither does. The rest of the market
sees nothing.

> The RFQ, quote, counterparties, and trade size are private to the two
> parties (plus an optional regulator), but settlement is atomic DvP: and the
> wider market learns nothing.

## Why Canton

This is not "a database with permissions." Two differentiators are load-bearing:

1. **Sub-transaction privacy** (signatory / observer model): the rival dealer
   never learns a trade happened. Enforced by the ledger, not by app code.
2. **Atomic multi-party settlement**: DvP with no trusted intermediary ever
   holding both legs.

"Private to the market, transparent to the regulator" is built in via an
optional `regulator` observer on every contract.

## Flow

```
RFQ (buyer → one dealer)  →  Quote (dealer → buyer)  →  AcceptQuote  →  Trade  →  Settle (atomic DvP)
```

| Template        | Signatory     | Observers          | File           |
|-----------------|---------------|--------------------|----------------|
| `Holding`       | owner         | issuer, regulator  | `daml/Asset.daml`   |
| `RFQ`           | buyer         | dealer, regulator  | `daml/Trading.daml` |
| `TradeProposal` | seller        | buyer, regulator   | `daml/Trading.daml` |
| `Trade`         | seller, buyer | regulator          | `daml/Trading.daml` |

## Run it

Built and verified on **Daml SDK 2.10.4** (Java 17).

```bash
curl -sSL https://get.daml.com/ | sh    # one-time install
export PATH="$HOME/.daml/bin:$PATH"
daml build                              # compile -> .daml/dist/blackrocq-0.1.0.dar
daml test                               # run Setup.demo + privacy assertions in memory
```

Run it on a real Canton ledger (this exact sequence passes end to end):

```bash
daml sandbox --port 6865 &
daml ledger upload-dar --host localhost --port 6865 .daml/dist/blackrocq-0.1.0.dar
daml script --ledger-host localhost --ledger-port 6865 \
  --dar .daml/dist/blackrocq-0.1.0.dar --script-name Setup:demo
```

`Setup.demo` runs the full lifecycle and asserts that the rival dealer can see
neither the RFQ nor the Trade, while the regulator can audit the live trade.

See [DEPLOY.md](DEPLOY.md) for hosted deployment (Seaport, Canton DevNet).

## Live demo app

A three-panel UI shows one trade from three points of view, querying the ledger
*as* each party over the Daml JSON API, so the privacy is real:

![settled trade](docs/demo-settled.png)

```bash
./app/run-local.sh        # builds, starts sandbox + JSON API + backend
# open http://localhost:4000 and step RFQ -> Quote -> Accept -> Settle
```

The rival dealer's column stays empty through the entire lifecycle. See
[app/README.md](app/README.md) for architecture and how to point it at Seaport.

## Status

- [x] Core Daml model: RFQ → Quote → Trade → atomic DvP, with regulator window
- [x] `daml build` clean; `daml test` green (3 active contracts, 7 transactions)
- [x] Deploys to a live Canton ledger and runs the full flow (verified on sandbox)
- [x] Split-screen UI: counterparties vs rival (redacted) vs regulator, live on the ledger
- [x] Pitch deck (`deck/`, rendered to PDF)
- [ ] Public live deployment (Seaport / hosted participant)
- [ ] Multi-dealer RFQ (buyer fans out to N dealers, each blind to the others)
- [ ] Daml Finance instruments for the asset and tokenized-deposit cash leg
- [ ] 3-minute demo video
