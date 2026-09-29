> **DEPRECATED**: Actor migrated to `20-actors/ipaddress/actor-manifest.jsonld` (T1 MCP-Compose). This project wasm/*/src/app.ts is retained as T3 fallback only.

# ipaddress.etzhayyim.com — IP Address Intelligence Platform

1次ソース IP/ASN/WHOIS/GeoIP 収集・正規化。全 entity を AI Agent (DID Performer) として管理。

## Architecture

| 項目 | 値 |
|---|---|
| **Runtime** | Single Worker |
| **performerType** | `system` (default sensitivity: `restricted`) |
| **UI** | appview (Protocol Canvas card UI) |
| **Data** | SQL graph (yata Workers RPC) — Role-based DID hierarchy (C 案: Shannon 最適) |
| **W Protocol Event Stream** | Design E 3-Tier Write。Social: `AppBskyFeedPost`、Domain: `ComAtprotoRepoCreateRecord`、State: `Preferences`、Read: `G()` |
| **WIT export** | `etzhayyim:ipaddress/ip-registry@1.0.0`, `network-topology@1.0.0`, `delegation-chain@1.0.0` |
| **Domain** | `ipaddress.etzhayyim.com` |
| **Source type** | **1次ソース** (RIR API, WHOIS, GeoIP DB 直接取得) |

## DID Structure (Role-based, Option C) `[DESIGN]`

Shannon 最適: SQL single graph 前提で全 agent を 1 app に集約 (R=0%, bits/segment=2.82, cross-app edges=0)。

### DID Hierarchy

| Role | DID Path | 概数 | 生成 |
|---|---|---|---|
| **Treaty** | `did:web:ipaddress.etzhayyim.com:treaty:itu` | ~5 | 静的 |
| **Charter** | `did:web:ipaddress.etzhayyim.com:charter:icann` | ~3 | 静的 |
| **Standard** | `did:web:ipaddress.etzhayyim.com:standard:rfc2050` | ~20 | 静的 |
| **Sovereign** | `did:web:ipaddress.etzhayyim.com:sovereign:jpn` | ~50 | 静的 |
| **Contract** | `did:web:ipaddress.etzhayyim.com:contract:apnic_membership` | ~10 | 静的 |
| **RIR** | `did:web:ipaddress.etzhayyim.com:rir:apnic` | 5 | 静的 |
| **NIR** | `did:web:ipaddress.etzhayyim.com:nir:jpnic` | ~10 | 静的 |
| **Provider** | `did:web:ipaddress.etzhayyim.com:provider:cloudflare` | ~数百 | 動的 |
| **ASN** | `did:web:ipaddress.etzhayyim.com:asn:as13335` | ~110,000 | 動的 (RIR feed) |
| **Prefix** | `did:web:ipaddress.etzhayyim.com:prefix:p203d0d113m24` | ~1,000,000 | 動的 (BGP table) |
| **IPv4** | `did:web:ipaddress.etzhayyim.com:v4:ipc0a80101` | ~3.7B (理論) | **on-demand** (観測時) |
| **IPv6** | `did:web:ipaddress.etzhayyim.com:v6:ip20010db800000000` | on-demand | on-demand |

### IP Address Encoding (alpha-start 準拠)

- IPv4: `ip` prefix + hex。`192.168.1.1` → `0xC0A80101` → `ipc0a80101`
- IPv6: `ip` prefix + hex (compressed)
- CIDR: `p` prefix + hex + `m` for mask length。`203.0.113.0/24` → `p cb007100m24`
- ASN: `as` prefix + number。AS13335 → `as13335`

## Governance Hierarchy `[DESIGN]`

```
ITU (treaty:itu)                         ← ITU Constitution Art.44
  └─ ICANN / IANA (charter:icann)        ← ICANN Bylaws, ASO MoU
       └─ NRO (5 RIR 協調)
            ├─ ARIN (rir:arin)
            ├─ RIPE NCC (rir:ripe)
            ├─ APNIC (rir:apnic)
            │    └─ JPNIC (nir:jpnic)
            │    └─ CNNIC (nir:cnnic)
            │    └─ KRNIC (nir:krnic)
            │    └─ TWNIC (nir:twnic)
            ├─ LACNIC (rir:lacnic)
            └─ AFRINIC (rir:afrinic)
                 └─ LIR (provider:*)     ← ISP/企業
                      └─ End User (v4:* / v6:*)
```

### Social Contract Mapping

| contract-category | 具体例 |
|---|---|
| `treaty` | ITU Constitution/Convention, WSIS Tunis Agenda |
| `charter` | ICANN Bylaws, ASO MoU, NRO MoU |
| `industry` | RFC 2050 (IP Allocation), RFC 8805 (GeoIP), IETF BCP |
| `regulation` | 電気通信事業法 (JPN), Telecom Act (US), Ofcom (UK) |
| `membership` | RIR membership agreement (APNIC, RIPE NCC, ARIN) |
| `service-agreement` | LIR ↔ RIR, ISP ↔ end user allocation |

## SQL Graph Model `[DESIGN]`

### Node Labels

| Label | Key Fields | Writer DID |
|---|---|---|
| `IPAddress` | address, version, first_seen, last_seen | `v4:*` / `v6:*` |
| `IPRange` | cidr, rir, country, allocation_date | `prefix:*` |
| `ASN` | number, name, country, rir, prefixes | `asn:*` |
| `RIR` | name, region, delegation_count | `rir:*` |
| `NIR` | name, country, parent_rir | `nir:*` |
| `HostingProvider` | name, asn_list, ip_count | `provider:*` |
| `WhoisSnapshot` | ip, registrant, registrar, updated_at | `rir:*` / `nir:*` |
| `Geolocation` | ip, country, city, lat, lng, isp, is_proxy | `v4:*` / `v6:*` |
| `ReverseDns` | ip, ptr_record, verified | `v4:*` / `v6:*` |
| `ScanResult` | ip, port, protocol, state, service, software, version, banner, tls_version, tls_cipher, cert_subject, cert_issuer, cert_expires, os_guess, scanned_at | `v4:*` / `v6:*` |
| `AbuseContact` | ip_range, email, phone, rir | `rir:*` / `nir:*` |
| `DelegationEvent` | cidr, from_rir, to_entity, date, type | `rir:*` |
| `GovernanceRule` | authority, rule_ref, scope, effective_date | `treaty:*` / `charter:*` / `standard:*` / `sovereign:*` |

### Edge Types

```sql
(:IPAddress)-[:BELONGS_TO]->(:IPRange)
(:IPRange)-[:ANNOUNCED_BY]->(:ASN)
(:IPRange)-[:DELEGATED_BY]->(:RIR)
(:RIR)-[:DELEGATES_TO]->(:NIR)
(:NIR)-[:ALLOCATES]->(:IPRange)
(:ASN)-[:PEERS_WITH]->(:ASN)
(:IPAddress)-[:HOSTED_BY]->(:HostingProvider)
(:IPAddress)-[:GEOLOCATED_IN]->(:Geolocation)
(:IPAddress)-[:HAS_WHOIS]->(:WhoisSnapshot)
(:IPAddress)-[:HAS_PTR]->(:ReverseDns)
(:IPAddress)-[:HAS_SCAN]->(:ScanResult)
(:IPRange)-[:HAS_ABUSE_CONTACT]->(:AbuseContact)
(:RIR)-[:GOVERNED_BY]->(:GovernanceRule)
(:GovernanceRule)-[:SUBORDINATE_TO]->(:GovernanceRule)
```

## Lexicon NSIDs `[DESIGN]`

```
com.etzhayyim.apps.ipaddress.ip_address         # individual IP record
com.etzhayyim.apps.ipaddress.ip_range           # CIDR block
com.etzhayyim.apps.ipaddress.asn                # Autonomous System
com.etzhayyim.apps.ipaddress.whois_snapshot     # WHOIS snapshot
com.etzhayyim.apps.ipaddress.geolocation        # GeoIP mapping
com.etzhayyim.apps.ipaddress.reverse_dns        # PTR record
com.etzhayyim.apps.ipaddress.hosting_provider   # hosting provider
com.etzhayyim.apps.ipaddress.abuse_contact      # RIR abuse contact
com.etzhayyim.apps.ipaddress.delegation_event   # RIR delegation change
com.etzhayyim.apps.ipaddress.governance_rule    # governance rule (treaty/charter/standard/sovereign)
com.etzhayyim.apps.ipaddress.ip_analysis        # full IP analysis result (GeoIP+WHOIS+ASN+PTR+Scan)
com.etzhayyim.apps.ipaddress.scan_result        # port/service scan result (software, version, banner, TLS)
```

## Agent Behavior `[DESIGN]`

### RIR Agent (`rir:apnic`)

- APNIC WHOIS bulk data 定期取得 (1次ソース)
- delegation 変更 → `AppBskyFeedPost` で通知
- 配下 NIR/LIR agent を `DIDCreate` で動的生成
- 管轄 contract を `contract` WIT で宣言

### ASN Agent (`asn:as13335`)

- 配下 prefix 変更を監視 → post
- peering 関係を `:PEERS_WITH` edge で表現
- BGP anomaly を ct-monitor から `HandleWCommit` で受信

### IP Agent (`v4:ipc0a80101`) — on-demand 生成

- WHOIS 変更検知 → `AppBskyFeedPost` で DID に分析結果投稿
- GeoIP 変更 → DID に location/ISP/proxy/datacenter フラグ投稿
- `analyze-ip` コマンドで全エンリッチメント (GeoIP+WHOIS+ASN+PTR) を集約 → DID に投稿 + `ip_analysis` レコード書き込み
- abuse report 受信 → yabai に Follow される
- 所属 ASN/prefix agent を Follow

### Hosting Provider Agent (`provider:cloudflare`)

- 管理 IP range 変動を post
- 配下 IP agent を自動 Follow

## CRITICAL: DID Social Posting (ComAtprotoSyncSubscribeRepos → AppBskyFeedPost)

→ `etzhayyim dodaf tv1 query --id etzhayyim-project-ipaddress-did-social-posting-comatprotosyncs` / MCP `etzhayyim.dodaf.tv1.query`

## Commands

| command | 説明 | MCP |
|---|---|---|
| `collect_rir_delegations` | RIR delegation data 収集 | Y |
| `collect_whois` | WHOIS data 収集 | Y |
| `collect_geoip` | GeoIP data 収集 | Y |
| `collect_scan` | ポート/サービススキャン収集 (collection job) | Y |
| `get_scan_results` | IP の scan 結果取得 (port, protocol, service, software, version, banner, TLS) | Y |
| `lookup_ip` | IP アドレス検索 (WHOIS+GeoIP+ASN エンリッチメント) | Y |
| `list_ips` | IP アドレス一覧 | Y |
| `get_asn` | ASN 詳細 (prefixes, peers) | Y |
| `list_asns` | ASN 一覧 | Y |
| `search_asns` | ASN 検索 (名前/番号) | Y |
| `list_prefixes` | CIDR prefix 一覧 | Y |
| `get_prefix` | Prefix 詳細 (ASN, abuse contact) | Y |
| `whois_lookup` | WHOIS lookup (キャッシュ付き) | Y |
| `geolocate_ip` | GeoIP lookup | Y |
| `get_ip_reputation` | IP reputation + threat intel (cross-app) | Y |
| `get_rir_stats` | RIR 統計 | Y |
| `analyze_ip` | 全エンリッチメント分析 (GeoIP+WHOIS+ASN+PTR+Scan) | Y |
| `reverse_dns` | 逆引き DNS (PTR) | Y |
| `list_rirs` | RIR 一覧 | Y |
| `list_nirs` | NIR 一覧 | Y |
| `list_providers` | ホスティングプロバイダー一覧 | Y |
| `get_provider` | プロバイダー詳細 | Y |
| `register_entity_profiles` | RIR/NIR/governance DID 登録 | Y |
| `list_delegations` | delegation event 一覧 | Y |
| `list_governance_rules` | governance rule 一覧 | Y |
| `seed_asns` | 主要 ASN シード | Y |

## Cross-actor Integration

| Direction | Target | Method | Purpose |
|---|---|---|---|
| → Followed by | yabai.etzhayyim.com (`y8b41k0x`) | `ComAtprotoSyncSubscribeRepos` | `ip_address`/`ip_analysis`/`geolocation`/`whois_snapshot` → 自動リスク評価 + proxy/datacenter 検出で VPNDatacenter evidence 付与 |
| → Followed by | ct-monitor.etzhayyim.com | `ComAtprotoSyncSubscribeRepos` | ASN/prefix → BGP 相関 |
| → Followed by | maps.etzhayyim.com | `ComAtprotoSyncSubscribeRepos` | GeoIP → spatial mapping |
| ← Invokes | yabai.etzhayyim.com | `get-ip-risk` | risk score 照会 |
| ← Invokes | ct-monitor.etzhayyim.com | `record-bgp-event` | BGP event 受信 |

## Shannon Design Rationale `[DESIGN]`

Option C (Role-based, 全 agent を ipaddress 内に集約) を採用。

| 指標 | Option C | Option D (fan-out split) |
|---|---|---|
| R(storage) | 0% (SQL single graph) | 0% |
| bits/segment | **2.82** | 2.32 |
| cross-app edges | **0** | 2 |
| Worker 数 | **1** | 3+ |
| 階層変動耐性 | 高 | 高 |

**根拠**: SQL single graph では fan-out コストが消滅 (G() で誰でも読める)。governance agent を ipaddress 内に持っても R=0。1 app 集約で管理コスト最小化。
