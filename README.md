# blackrocq

**Confidential DeFi on Canton.** Private send, private swap, private limit orders.

On a public chain every transfer, swap, and resting order is visible to the
whole world: positions leak, orders get front-run, strategies get copied.
blackrocq makes them confidential by construction. A send, a swap, or a limit
order is visible only to the parties involved (plus an optional regulator). The
public market sees nothing, not even that the transaction exists.

> Move and trade tokens privately. The parties (and a regulator) see everything;
> the market sees nothing; settlement is atomic.

![live demo](docs/demo.png)

## The three primitives

- **Send** (`Holding.Transfer`): a confidential token transfer.
- **Swap** (`Order` + `Fill`): an instant, atomic asset-for-asset exchange. Both
  legs move in one transaction, or neither does.
- **Limit order** (`Order`, resting): post an order at your price; it stays
  private until your chosen counterparty fills it. A swap is just a limit order
  filled immediately, so one primitive powers both.

All three are private because of Canton's signatory/observer model, not because
of application-level access control.

## Why Canton

This is not "a database with permissions." Two capabilities are load-bearing:

1. **Sub-transaction privacy** (signatory / observer model): an outsider never
   learns a send, swap, or order happened. Enforced by the ledger.
2. **Atomic multi-party settlement**: a swap moves both legs together or not at
   all, with no intermediary ever holding both sides.

"Private to the market, transparent to the regulator" is built in via an
optional `regulator` observer on every contract.

## Model

| Template  | Signatory | Observers         | File                |
|-----------|-----------|-------------------|---------------------|
| `Holding` | owner     | issuer, regulator | `daml/Asset.daml`   |
| `Order`   | maker     | taker, regulator  | `daml/Trading.daml` |

`Holding` carries `Transfer` (send) and `Split`. `Order` carries `Fill` (the
atomic swap) and `Cancel`.

## Live demo app

A three-panel UI shows the same ledger from three points of view: the
counterparties, the public market (which sees nothing), and the regulator.

```bash
./app/run-local.sh        # builds, starts sandbox + JSON API + backend
# open http://localhost:4000 and try Send / Swap / Place limit order
```

The public market column stays empty no matter what you do. See
[app/README.md](app/README.md) for architecture and how to point it at Seaport.

## Build and test

Built and verified on **Daml SDK 2.10.4** (Java 17).

```bash
curl -sSL https://get.daml.com/ | sh
export PATH="$HOME/.daml/bin:$PATH"
daml build                              # compile -> .daml/dist/blackrocq-0.1.0.dar
daml test                               # Setup.demo + privacy assertions, in memory
```

`Setup.demo` runs send + a confidential limit order + a fill (swap) and asserts
the market can see none of it while the regulator can audit it.

## Status

- [x] Confidential DeFi model: `Holding`/`Transfer`, `Order`/`Fill`/`Cancel`
- [x] `daml build` clean; `daml test` green
- [x] Live stack (Canton sandbox + JSON API + backend), every endpoint tested
- [x] Three-panel UI: send / swap / limit orders, market stays blind
- [ ] Public live deployment (Seaport / hosted participant)
- [ ] Multi-taker order book (open orders fillable by any of N takers)
- [ ] Daml Finance instruments + tokenized-deposit settlement asset
- [ ] Deck + 3-minute demo video (reframe to DeFi)

See [DEPLOY.md](DEPLOY.md) for hosted deployment (Seaport, Canton DevNet).
