# Deploying blackrocq

Deploying any Daml app is three steps: **build a DAR**, **upload it to a ledger**,
and **allocate parties / run the init flow**. Below: the locally verified path,
then the hosted options (Seaport, Canton DevNet).

## Prerequisites

- Daml SDK 2.10.4 (`curl -sSL https://get.daml.com/ | sh`)
- Java 11+ (we tested on OpenJDK 17)

```bash
export PATH="$HOME/.daml/bin:$PATH"
```

## 1. Local Canton sandbox (verified)

This exact sequence has been run and passes end to end (`SCRIPT_EXIT=0`, all
privacy assertions hold) on Canton sandbox from SDK 2.10.4.

```bash
daml build                                   # -> .daml/dist/blackrocq-0.1.0.dar
daml sandbox --port 6865 &                   # start a local Canton ledger
daml ledger upload-dar --host localhost --port 6865 .daml/dist/blackrocq-0.1.0.dar
daml script --ledger-host localhost --ledger-port 6865 \
  --dar .daml/dist/blackrocq-0.1.0.dar --script-name Setup:demo
```

Note: `daml test` compiles from source in memory and does NOT refresh the
on-disk DAR. Always run `daml build` before `upload-dar`.

## 2. Deploy to a hosted Daml participant (generic)

Any hosted Canton participant (Node-as-a-Service, custody provider, or platform)
exposes a ledger host/port and issues an access token. Point `daml deploy` at it:

```bash
daml deploy --host <LEDGER_HOST> --port <LEDGER_PORT> \
  --access-token-file <PATH_TO_TOKEN>
```

`daml deploy` uploads the DAR and allocates the parties from `daml.yaml`. Or set
a `ledger:` block in `daml.yaml` and just run `daml deploy`.

## 3. Seaport (seaport.to)

Seaport is a third-party hosted "DAML Developer Platform" (code, build, deploy,
manage Daml from one place). It is NOT listed among Canton's official developer
tools, but it is a legitimate hosted route and the quickest way to a public
ledger without running your own node.

What only you can do (account-gated, cannot be automated from here):

1. Sign up at https://seaport.to and create a project / ledger.
2. From the Seaport console, get the **ledger endpoint** (host + port, or a JSON
   API URL) and an **access token / API key**.
3. Deploy the DAR built in step 1, either by:
   - `daml deploy --host <seaport-host> --port <seaport-port> --access-token-file token.jwt`, or
   - uploading `.daml/dist/blackrocq-0.1.0.dar` through the Seaport UI if it
     offers web upload.
4. Run the `Setup:demo` script (or wire the frontend) against that endpoint.

Hand me the endpoint + token (or run the command above yourself with `!`) and
the rest is turnkey.

## 4. Canton Network DevNet (official, heavyweight)

Deploying to the real decentralized DevNet is a node-operations exercise, not a
DAR upload. It requires (per Splice / Digital Asset docs):

- A sponsoring **Super Validator** for connection info.
- A **validator node** (Docker Compose or Kubernetes) with a static egress IP,
  PostgreSQL, and OIDC auth.
- An **onboarding secret** (self-serve via API on DevNet, expires in 48h).
- Whitelisted connectivity to the Global Synchronizer.

Tooling: **DPM** (Digital Asset Package Manager) and the Canton Network App
Quickstart (LocalNet for local, then graduate to DevNet/TestNet/MainNet). Note
the CN App Quickstart targets Daml 3.x; these 2.10 contracts would be
recompiled on the 3.x toolchain (the templates port with minor changes).

Docs:
- Validator onboarding: https://docs.dev.sync.global/validator_operator/validator_onboarding.html
- DevNet overview: https://docs.digitalasset.com/integrate/devnet/canton-network-overview/index.html
- App Quickstart: https://docs.digitalasset.com/build/3.4/quickstart/

For a hackathon submission, option 3 (Seaport) or a deployed frontend over a
hosted participant is the pragmatic "link to live product." Option 4 is overkill
unless the judges specifically want a node on the live synchronizer.
