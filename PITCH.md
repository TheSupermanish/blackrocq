# blackrocq: Pitch

**Confidential DeFi on Canton.** Private send, private swap, private limit orders.
*Private DeFi & Capital Markets track · Canton Foundation*

---

## The one-liner

> Send, swap, and trade tokens privately. The parties (and a regulator) see
> everything; the public market sees nothing; settlement is atomic.

---

## The problem

On a public chain, everyone sees everything you do. Every transfer, every swap,
every resting order is public the instant you make it. Your positions leak, your
orders get front-run, your strategy gets copied. Posting an order on a public
DEX is broadcasting your intent to every bot in the mempool, which sandwiches
you and hands you a worse price. This is not a bug in one app; it is how public
ledgers work.

Three things leak, and none of them can be made private on a public chain:

- **Transfers**: every send is a permanent public trail of who paid whom.
- **Swaps**: visible in the mempool, front-run and sandwiched before they land.
- **Orders**: a resting limit order is a public signal of your size and price.

---

## The solution: blackrocq

Confidential DeFi on Canton. Three private primitives, one engine:

1. **Send** (`Holding.Transfer`): move tokens with no public trail. Only you and
   the recipient (and an optional regulator) ever see it.
2. **Swap** (`Order` + `Fill`): exchange two assets in a single atomic
   transaction, or neither leg moves. No mempool, no front-running, no
   settlement risk.
3. **Limit order** (`Order`, resting): post your price; it stays invisible until
   your chosen taker fills it. A swap is just a limit order filled immediately,
   so one template powers both.

Every primitive is private by construction, and every contract carries an
optional regulator observer: private to the market, transparent to the regulator.

---

## Why this can only work on Canton

| Capability | What it buys us |
|---|---|
| **Sub-transaction privacy** (signatory / observer model) | An outsider never learns a send, swap, or order happened. Enforced by the ledger. |
| **Atomic multi-party settlement** | A swap moves both legs together or not at all. No mempool window to front-run, no middleman. |

Take either away and confidential DeFi collapses. That is the test of a real
Canton app, and blackrocq passes it.

---

## The proof (the 10-second demo)

One ledger, three points of view, side by side in the live app:

- **Counterparties (Alice and Bob):** a swap and a resting limit order, live.
- **Public market:** redacted. A trade is settling right now and it sees nothing.
- **Regulator:** the full, auditable record.

This is the running app, not a mockup. Our test suite asserts on-ledger that the
market can query none of it while the regulator can audit every send, swap, and
order.

---

## Who it's for

- **Traders and funds:** move and trade size without being front-run or copied.
- **Market makers:** post private quotes and fill them without revealing the book.
- **Institutions and regulators:** confidentiality the market cannot see, with
  oversight the regulator always can.

Spans Private DeFi & Capital Markets, with reach into payments / neobanking and
RWA & tokenized deposits.

---

## 3-minute spoken script

**[0:00-0:30] Hook.**
"On a public chain, everyone sees everything you do. The moment you post a swap
or an order, every bot in the mempool sees your size and your price, front-runs
you, and hands you a worse fill. We built DeFi where that can't happen. It's
called blackrocq: confidential DeFi on Canton."

**[0:30-1:10] Problem.**
"Three things leak on every public chain and none can be made private: your
transfers are a permanent public trail, your swaps get sandwiched in the
mempool, and a resting limit order is just a public signal you're trading
against yourself. Privacy isn't a missing feature there. It's impossible."

**[1:10-2:10] Solution and demo.**
"blackrocq gives you three private primitives on one engine. Send: move tokens
with no public trail. Swap: exchange two assets atomically, no mempool, no
front-running. And limit orders: post your price and it rests invisibly until
your taker fills it. Watch the live app. Here are the two counterparties: a swap
and a resting order. Here is a rival in the public market: nothing, redacted. And
here is the regulator: the full record. Same ledger, three completely different
views."

**[2:10-3:00] Why Canton and close.**
"This only works because Canton gives us two things no public chain can:
sub-transaction privacy, so an outsider never learns the trade happened, and
atomic settlement, so both legs move together with no mempool window to attack.
Our privacy guarantee isn't a slide; it's an assertion in our test suite that the
market can't see the trade. blackrocq: send, swap, and trade, without the whole
world watching. Thank you."

---

## Slide outline (deck)

1. **Title**: blackrocq, confidential DeFi on Canton
2. **The problem**: a public chain shows everyone everything (front-running / MEV)
3. **What leaks**: transfers / swaps / orders
4. **The primitives**: send / swap / limit order
5. **The proof**: one ledger, three points of view (live app)
6. **Why only Canton**: sub-transaction privacy + atomic settlement
7. **Who it's for**: traders, market makers, institutions and regulators
8. **The ask / close**
