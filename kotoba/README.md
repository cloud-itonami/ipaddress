# ipaddress kotoba

Phase E reference implementation of ipaddress on the etzhayyim substrate.

Per [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md), ipaddress migrates from vendor's `createKyselyDb` pattern (RW direct write) to **Option B** — PDS XRPC writes via `@etzhayyim/sdk e.write()`.

Coverage: **37 of 37 (100%)** ipaddress XRPC commands ported.

| Tier | Commands | Slice |
|---|---|---|
| ASN | registerAsn, getAsn | 1 |
| Prefix | registerPrefix, getPrefix | 2 |
| Provider | registerProvider, getProvider | 2 |
| IP | registerIp, getIp | 3 |
| Scan | registerScan, getScan, listScans | 4 |
| Search | searchProviders, listProviders, listPrefixes | 5 |
| Topology | getDelegationChain, getIpTopology, getPeering | 6 |
| Geo + Abuse | getGeolocation, getAbuseContact | 7 |
| Collect | collectGeoip, collectWhois, batchIngestRir | 8 |
| List | listAsns, listIps, batchRegisterIp | 9 |
| Analyze | analyzeIp, analyzeAsn, analyzePrefix | 10 |
| Peering + RIR/NIR | registerPeering, listPeering, registerRir, registerNir, getRir | 11 |
| Final | listRirs, listNirs, getNir, getPrefixContainingIp | **12** |

All 37 commands now have kotoba reference impl. Wire-up to a Worker /
LangServer pod XRPC handler is the next operator task per ADR-2605203000.

## Pattern translation (Option B)

| Vendor (`ipaddress.etzhayyim.com`) | etzhayyim (this PR) |
|---|---|
| `const db = createKyselyDb();` | `import type { Etzhayyim } from "@etzhayyim/sdk"` |
| `db.insertInto("vertex_ip_asn").values({...}).execute()` | `e.write({ collection: "com.etzhayyim.apps.ipaddress.asn", record, rkey })` |
| `db.selectFrom("vertex_ip_asn").where("number","=",n).execute()` | `e.read({ collection, rkey: \`asn-${n}\` })` |
| Duplicate check via `.where(...).limit(1)` | rkey-direct read returns `notFound` if missing |

## Authority-chain DIDs (per ipaddress CLAUDE.md)

ipaddress mints path-based DIDs in a 6-tier authority chain:

```
did:web:ipaddress.etzhayyim.com                       — controller
did:web:ipaddress.etzhayyim.com:rir:{apnic|arin|ripe|lacnic|afrinic}
did:web:ipaddress.etzhayyim.com:nir:{cc}              — JPNIC / CNNIC / etc.
did:web:ipaddress.etzhayyim.com:provider:{slug}       — ISP / cloud / etc.
did:web:ipaddress.etzhayyim.com:asn:{number}          — this slice
did:web:ipaddress.etzhayyim.com:prefix:{cidr}
did:web:ipaddress.etzhayyim.com:ip:{address}
```

DID minting is derived from the natural key (ASN number / CIDR / address) — no per-mint randomness. Same idempotency pattern as tsukuru `manufacturerRegistry` slice (rkey=slug).

## Usage

```ts
import { Etzhayyim } from "@etzhayyim/sdk";
import { registerAsn, getAsn } from "@etzhayyim/ipaddress-kotoba";

const e = new Etzhayyim({
  did: "did:web:ipaddress.etzhayyim.com",
  pdsUrl: "https://pds.etzhayyim.com",
  l2RpcUrl: "https://mainnet.base.org",
  // session or auth
});

// Register
const out = await registerAsn(e, {
  number: 13335,
  name: "Cloudflare",
  country: "US",
  rir: "arin",
  prefixes: ["1.1.1.0/24", "1.0.0.0/24"],
});
// → { status: "registered", asnUri: "at://...", did: "did:web:...:asn:13335" }

// Lookup
const got = await getAsn(e, { number: 13335 });
// → { asn: { number: 13335, name: "Cloudflare", ... } }
```

## Why Option B for ipaddress (not A)

Per ADR-2605203000 Phase E decision matrix:
- **Catalog: A-group open standards** — IP/ASN/WHOIS/GeoIP from public RIR sources
- **Data volume**: small structured records, NOT bulk blobs
- **Write cadence**: bulk-ingest periodic + on-demand register — not GTFS-RT-fast
- **Query pattern**: number / CIDR / address lookups (rkey-direct) + range scans (Phase 3 mst-projector)

Option A (vendor RW mirror) was rejected — no marginal benefit, and ADR-2605172000 mandates kotoba for actor migration.

Option C (IPFS) was rejected — records are small structured data, not blobs. Native PDS storage is the right tool.

## What this package IS / ISN'T

**IS**:
- Reference implementation of 2 ipaddress commands on Option B (PDS XRPC).
- Documentation of the createKyselyDb → e.write() translation per ADR-2605203000.
- Type definitions for ASN tier of the ipaddress authority chain.

**ISN'T**:
- A deployed Worker — no XRPC handler glue (matches open-isco / tsukuru kotoba scaffold state).
- A production replacement for `ipaddress.etzhayyim.com` — vendor `ipaddress` is currently undeployed (HTTP 404), so this slice can land without parallel vendor deploy concerns.
- The full 37-command parity — 35 commands remain (follow-up slices).
- mst-projector views — Phase 3 dependency for range-scan queries.

## Related

- [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md) — Phase E write-target options (this PR)
- [ADR-2605172000](../../../90-docs/adr/2605172000-etzhayyim-kotoba-substrate.md) — kotoba substrate
- [open-isco kotoba](../../etzhayyim-project-open-isco/kotoba/) — Option B seeder + query CLI reference
- [tsukuru kotoba](../../etzhayyim-project-tsukuru/kotoba/) — Option B full app (13/46 commands, escrow pattern)
- vendor `60-apps/etzhayyim-project-ipaddress/appview/.../src/app.ts:331` — original cmdRegisterAsn replaced by this slice
