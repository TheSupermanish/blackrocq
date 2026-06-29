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

Install the Daml SDK, then:

```bash
curl -sSL https://get.daml.com/ | sh    # one-time install
daml build                              # compile
daml test                               # run the Setup.demo script + privacy assertions
daml start                              # boots into a settled trade; open Navigator
```

`Setup.demo` runs the full lifecycle and asserts that the rival dealer can see
neither the RFQ nor the Trade, while the regulator can audit the settled trade.

## Roadmap (2-week hackathon)

- [x] Core Daml model: RFQ → Quote → Trade → atomic DvP, with regulator window
- [ ] Split-screen UI: "what the counterparties see" vs "what the market sees"
- [ ] Multi-dealer RFQ (buyer fans out to N dealers, each blind to the others)
- [ ] Daml Finance instruments for the asset and tokenized-deposit cash leg
- [ ] Deck + 3-minute demo video
