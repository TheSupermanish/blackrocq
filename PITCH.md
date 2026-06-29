# blackrocq — Pitch

**Confidential OTC trading desk on Canton.**
*Private DeFi & Capital Markets track · Canton Foundation*

---

## The one-liner

> Block trades, settled atomically, with the market kept blind — and the
> regulator kept informed.

---

## The problem

When a pension fund wants to buy a large block of bonds, it has a problem:
**the moment its intent is visible, the price moves against it.** This is
information leakage, and it is the multi-billion-dollar reason institutions
avoid public order books and trade over-the-counter (OTC) through private
desks and dark pools.

But today's OTC plumbing is a mess of bilateral messages, manual
reconciliation, and settlement risk — one side can deliver while the other
fails to pay. And public blockchains make the leakage problem *worse*:
everything is visible to everyone, forever.

So institutions are stuck:
- **Public chains** leak positions, counterparties, and size to the world.
- **Private databases** can't settle atomically across firms without a trusted
  intermediary holding both legs.
- **Legacy OTC** is slow, manual, and carries settlement risk.

---

## The solution — blackrocq

A confidential OTC desk built on **Canton**, where privacy and atomic
settlement are properties of the ledger itself, not bolted-on access control.

1. **Request for Quote** — a buyer privately asks *one* named dealer for a
   price. No other dealer, and no part of the market, can see the request.
2. **Quote** — the dealer responds with a price, visible only to the two of
   them.
3. **Accept** — the buyer turns the quote into a bilateral trade both parties
   have signed.
4. **Settle** — delivery-versus-payment: the asset and the cash change hands
   in a **single atomic transaction**, or neither leg moves. No intermediary
   ever holds both sides.

Throughout, an **optional regulator** observes every contract — *private to
the market, transparent to the regulator.*

---

## Why this can only work on Canton

This is not "a database with permissions." Two of Canton's core capabilities
are load-bearing:

| Capability | What it buys us |
|---|---|
| **Sub-transaction privacy** (signatory / observer model) | A rival dealer never even learns a trade happened. Enforced by the ledger. |
| **Atomic multi-party settlement** | True DvP with zero settlement risk and no trusted middleman. |

Take either away and the product collapses. That's the test of a real Canton
app — and blackrocq passes it.

---

## Demo (the 10-second proof)

Split screen.

- **Left — the counterparties:** RFQ, quote, signed trade, settled positions.
- **Right — the rival dealer:** *empty.* A trade worth a million dollars just
  settled and they see nothing.
- **Bottom — the regulator:** the full, auditable record.

Our `Setup.demo` script proves this on-ledger: it **asserts** the rival can
query neither the RFQ nor the Trade, while the regulator can audit the settled
trade. Privacy isn't a claim in our slides — it's a passing test.

---

## How it maps to the judging criteria

- **Technical execution** — clean, documented Daml; privacy enforced by the
  ledger; atomic DvP with on-ledger assertions, not hand-waving.
- **Originality** — a regulator-observable confidential trading desk; most
  teams build private *or* auditable, not both.
- **UX & design** — the split-screen "who-sees-what" view makes invisible
  privacy legible to a non-technical user in seconds.
- **Real-world applicability** — information leakage in block trading is a
  genuine, expensive, institutional problem. This is how desks actually work.

Spans **Private DeFi & Capital Markets** (OTC, private deal execution) and
touches **RWA & Tokenized Deposits** (the cash leg is a tokenized deposit).

---

## The ask

We're building the front door to institutional capital markets on Canton —
where a fund can move size without moving the market, and a regulator can still
see everything. blackrocq.

---

## 3-minute spoken script

**[0:00–0:30] Hook.**
"A pension fund wants to buy a hundred million in bonds. The instant the market
sees that order, the price runs away from them. That single problem —
information leakage — is why trillions trade off-exchange, over the counter. We
built the OTC desk for that world, on Canton. It's called blackrocq."

**[0:30–1:15] Problem.**
"Today institutions are stuck between three bad options. Public chains broadcast
your every position. Private databases can't settle a trade across two firms
without someone trusted holding both the cash and the asset. And legacy OTC is
slow, manual, and full of settlement risk — where one side pays and the other
fails to deliver. Nobody has private *and* atomic *and* auditable."

**[1:15–2:15] Solution + demo.**
"blackrocq gives you all three. Watch. A fund sends a request for quote to one
dealer — privately. Over here is a rival dealer's screen: nothing. The dealer
quotes, the fund accepts, and they settle delivery-versus-payment — the bonds
and the cash swap in one atomic transaction, or neither moves. The rival dealer
still sees nothing. But down here, the regulator sees the whole thing. Private
to the market, transparent to the regulator."

**[2:15–3:00] Why Canton + close.**
"This only works because Canton gives us two things no permissioned database
can: sub-transaction privacy, so the trade is invisible to outsiders by
construction, and atomic multi-party settlement, so there's no middleman and no
settlement risk. Our privacy guarantee isn't a slide — it's an assertion in our
test suite that the rival can't see the trade. blackrocq: move size without
moving the market. Thank you."

---

## Slide outline (deck)

1. **Title** — blackrocq · Confidential OTC desk on Canton
2. **The problem** — information leakage moves the price against you
3. **Three bad options** — public chains / private DBs / legacy OTC
4. **blackrocq** — private, atomic, auditable
5. **How it works** — RFQ → Quote → Accept → atomic DvP (the diagram)
6. **The demo** — split-screen who-sees-what
7. **Why only Canton** — sub-transaction privacy + atomic settlement
8. **Judging fit / market** — capital markets + tokenized deposits
9. **The ask / close**
