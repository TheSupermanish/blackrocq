# blackrocq

**Confidential DeFi on Canton.** Private send, private swap, private limit orders.

On a public chain every transfer, swap, and resting order is visible to the
whole world: positions leak, orders get front-run, strategies get copied.
blackrocq makes them confidential by construction. A send, a swap, or a limit
order is visible only to the parties involved (plus an optional regulator). The
public market sees nothing, not even that the transaction exists, and settlement
is atomic.

> Move and trade tokens privately. The parties (and a regulator) see everything;
> the market sees nothing; settlement is atomic.

![live demo](docs/demo.png)

---

## Table of contents

- [The three primitives](#the-three-primitives)
- [How the privacy works](#how-the-privacy-works)
- [The contracts](#the-contracts)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup and build](#setup-and-build)
- [Run the live app](#run-the-live-app)
- [REST API](#rest-api)
- [Architecture](#architecture)
- [Testing](#testing)
- [Deployment](#deployment)
- [Pitch deck](#pitch-deck)
- [Status](#status)

---

## The three primitives

| Primitive | What it does | Contract |
|-----------|--------------|----------|
| **Send** | A confidential token transfer, no public trail. | `Holding.Transfer` |
| **Swap** | An instant, atomic asset-for-asset exchange. Both legs move in one transaction, or neither does. | `Order` + `Fill` |
| **Limit order** | Post an order at your price; it rests privately until your chosen taker fills it. | `Order` (resting), then `Fill` |

A swap is just a limit order filled immediately, so one template (`Order` with
`Fill`) powers both. All three are private because of Canton's signatory /
observer model, not because of application-level access control.

## How the privacy works

1. **Sub-transaction privacy.** On Canton, a contract is disclosed only to its
   signatories and observers. An outsider (the "market") is neither, so it
   cannot even learn a send, swap, or order exists. This is enforced by the
   ledger, not by the app.
2. **Atomic multi-party settlement.** A swap (`Fill`) moves both legs in a
   single transaction or neither moves. There is no public mempool window to
   front-run, and no intermediary ever holds both sides.
3. **Regulator window.** Every contract carries an optional `regulator`
   observer. Private to the market, transparent to the regulator.

A subtlety worth knowing: because neither party can see the other's holdings by
default, settlement is **co-authorized** (both parties act on the one atomic
transaction), so each leg is readable inside it. In production this is done with
Canton explicit disclosure instead.

## The contracts

### `daml/Asset.daml` — `Holding`

A simplified fungible token holding.

```
template Holding with
    issuer, owner : Party
    regulator : Optional Party
    instrument : Text
    amount : Decimal
  where
    signatory owner                 -- owner-signed: enables atomic in-tx transfers
    observer issuer, regulator
```

- **`Transfer { newOwner }`** (controller `owner`, `newOwner`): reassigns
  ownership. The recipient must co-authorize, since they become the sole
  signatory of the new holding. Inside an atomic `Fill`, both authorities are
  present, so the swap goes through.
- **`Split { splitAmount }`** (controller `owner`): carves an exact-size piece
  off a holding, used to size a swap or payment leg precisely.

### `daml/Trading.daml` — `Order`

The core primitive: a confidential limit order. Visible only to the maker, the
invited taker, and an optional regulator.

```
template Order with
    maker, taker : Party
    regulator : Optional Party
    giveInstrument : Text ; giveAmount : Decimal
    wantInstrument : Text ; wantAmount : Decimal
  where
    signatory maker
    observer taker, regulator
```

- **`Fill { makerHoldingCid, takerHoldingCid }`** (controller `taker`): the
  atomic swap. Verifies both legs match the order, then `Transfer`s the maker's
  give-leg to the taker and the taker's want-leg to the maker in one
  transaction.
- **`Cancel`** (controller `maker`): withdraws a resting order, privately.

### `daml/Setup.daml` — demo script

`Setup.demo` runs the whole flow end to end (seed wallets, a private send, a
confidential limit order, a fill) and **asserts on-ledger** that the market can
see none of it while the regulator can audit it. It is also the `init-script` in
`daml.yaml`.

## Project structure

```
blackrocq/
├── daml/
│   ├── Asset.daml          Holding: Transfer (send), Split
│   ├── Trading.daml        Order: Fill (atomic swap), Cancel
│   └── Setup.daml          end-to-end demo + privacy assertions
├── daml.yaml               SDK 2.10.4, dependencies, init-script
├── app/
│   ├── server.js           zero-dependency backend over the Daml JSON API
│   ├── jwt.js              dev JWT minting (insecure tokens for the sandbox)
│   ├── public/index.html   three-panel confidential-DeFi UI
│   ├── run-local.sh        one-command full stack
│   └── README.md           app architecture + endpoint reference
├── deck/
│   ├── index.html          pitch deck (8 slides)
│   └── blackrocq-pitch.pdf  rendered deck
├── docs/demo.png           live UI screenshot
├── DEPLOY.md               hosted deployment (Seaport, Canton DevNet)
├── PITCH.md                pitch narrative + 3-minute script
└── README.md               this file
```

## Prerequisites

- **Daml SDK 2.10.4** (`curl -sSL https://get.daml.com/ | sh`)
- **Java 11+** (tested on OpenJDK 17)
- **Node 18+** (tested on Node 22; the backend uses only built-ins)

No crypto wallet or private key is needed. The local stack runs on a Canton
sandbox in dev mode and uses short-lived dev tokens for throwaway test parties.

## Setup and build

```bash
curl -sSL https://get.daml.com/ | sh        # one-time SDK install
export PATH="$HOME/.daml/bin:$PATH"
daml build                                  # -> .daml/dist/blackrocq-0.1.0.dar
daml test                                   # run Setup.demo + privacy assertions
```

## Run the live app

```bash
./app/run-local.sh
```

This builds the DAR, starts a Canton sandbox and the Daml JSON API, uploads the
DAR, and runs the backend. Open **http://localhost:4000** and try **Send /
Swap / Place limit order**. The public-market column stays empty no matter what.
Ctrl-C stops everything.

## REST API

The backend (`app/server.js`) exposes a small surface over the Daml JSON API.
All bodies are optional with demo defaults.

| Method + path     | Body                              | Effect                              |
|-------------------|-----------------------------------|-------------------------------------|
| `POST /api/send`  | `{from?,to?,instrument?,amount?}` | confidential transfer               |
| `POST /api/swap`  | `{maker?,taker?,give*,want*}`     | instant atomic swap (post + fill)   |
| `POST /api/order` | `{maker?,taker?,give*,want*}`     | place a resting limit order         |
| `POST /api/fill`  | `{orderCid}`                      | fill a resting order (atomic swap)  |
| `POST /api/cancel`| `{orderCid}`                      | cancel a resting order              |
| `POST /api/reset` | -                                 | fresh party set + reseed wallets    |
| `GET  /api/state` | -                                 | per-party views + open orders + log |

## Architecture

```
browser  (app/public/index.html)
  -> Node backend (app/server.js)     zero-dep REST; one JWT per party
    -> Daml JSON API  (:7575)         insecure tokens in dev
      -> Canton ledger (:6865)        signatory/observer privacy + atomic swap
```

The backend allocates a fresh party set per session, mints a per-party JWT, and
queries the ledger **as each party**, so the market panel is empty because the
ledger genuinely discloses nothing to a non-party.

## Testing

- **Contracts:** `daml test` runs the `Setup.demo` script with privacy
  assertions (`demo: ok, 4 active contracts, 7 transactions`).
- **Live transactions:** every REST endpoint has been exercised against the
  running Daml JSON API (send, place order, fill, swap, cancel). At every step
  the public market can query zero contracts while the regulator sees all.

## Deployment

The app is fully env-configurable, so the same UI runs against a hosted
participant by setting `LEDGER_JSON_API`, `LEDGER_ID`, `JWT_SECRET`, and
`PKG_ID`. See [DEPLOY.md](DEPLOY.md) for the verified local path, the Seaport
route, and the Canton DevNet route.

## Pitch deck

[`deck/index.html`](deck/index.html) (rendered to
[`deck/blackrocq-pitch.pdf`](deck/blackrocq-pitch.pdf)): an 8-slide pitch on the
same terminal/redaction visual system as the app.

## Status

- [x] Confidential DeFi model: `Holding`/`Transfer`, `Order`/`Fill`/`Cancel`
- [x] `daml build` clean; `daml test` green
- [x] Live stack (Canton sandbox + JSON API + backend), every endpoint tested
- [x] Three-panel UI: send / swap / limit orders, market stays blind
- [x] Pitch deck (DeFi)
- [ ] Public live deployment (Seaport / hosted participant)
- [ ] Multi-taker order book (open orders fillable by any of N takers)
- [ ] Daml Finance instruments + tokenized-deposit settlement asset
- [ ] 3-minute demo video
