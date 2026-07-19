/**
 * ipaddress kotoba — record types.
 *
 * Per ADR-2605203000 Option B (PDS XRPC). Mirrors the bootstrap
 * lexicons at 00-contracts/lexicons/com/etzhayyim/apps/ipaddress/* — those
 * are still `x-bootstrap` stubs; tightening follows in the next slice
 * alongside more command ports.
 *
 * Identity hierarchy (per CLAUDE.md authority-chain):
 *   did:web:ipaddress.etzhayyim.com                — controller
 *   did:web:ipaddress.etzhayyim.com:rir:{rir}      — RIR (apnic/arin/ripe/lacnic/afrinic)
 *   did:web:ipaddress.etzhayyim.com:nir:{cc}       — NIR (jpnic/cnnic/krnic/etc)
 *   did:web:ipaddress.etzhayyim.com:provider:{slug}
 *   did:web:ipaddress.etzhayyim.com:asn:{number}
 *   did:web:ipaddress.etzhayyim.com:prefix:{cidr}
 *   did:web:ipaddress.etzhayyim.com:ip:{address}
 */

export type Rir = "apnic" | "arin" | "ripe" | "lacnic" | "afrinic";

/** Record body for `com.etzhayyim.apps.ipaddress.asn`. */
export interface AsnRecord {
  did: string;
  number: number;
  name?: string;
  country?: string;
  rir?: Rir;
  prefixes?: string[];
  /** Abuse contact fields populated by collectWhois / slice 7. */
  abuseEmail?: string;
  abuseTel?: string;
  abuseSource?: string;
  abuseCollectedAt?: string;
  createdAt: string;
}

export interface AsnView extends AsnRecord {
  asnUri: string;
}

export interface RegisterAsnInput {
  number: number;
  name?: string;
  country?: string;
  rir?: Rir;
  prefixes?: string[];
  /** Abuse contact fields (slice 7+). */
  abuseEmail?: string;
  abuseTel?: string;
  abuseSource?: string;
  abuseCollectedAt?: string;
}

export interface RegisterAsnOutput {
  status: "registered" | "alreadyExists" | "rejected";
  asnUri?: string;
  did?: string;
  number?: number;
  error?: string;
}

export interface GetAsnInput {
  number: number;
}

export interface GetAsnOutput {
  asn?: AsnView;
  error?: string;
}

export const IPADDRESS_DID_PREFIX =
  "did:web:ipaddress.etzhayyim.com:" as const;

/** Build the path-based DID for an ASN. */
export function asnDid(number: number): string {
  return `${IPADDRESS_DID_PREFIX}asn:${number}`;
}

/** rkey from ASN number — used for idempotent re-register. */
export function asnRkey(number: number): string {
  return `asn-${number}`;
}

// ─── Prefix tier (slice 2) ──────────────────────────────────────────

export interface PrefixRecord {
  did: string;
  cidr: string;
  asnNumber?: number;
  providerSlug?: string;
  countryIso3?: string;
  rir?: Rir;
  allocatedAt?: string;
  createdAt: string;
}

export interface PrefixView extends PrefixRecord {
  prefixUri: string;
}

export interface RegisterPrefixInput {
  cidr: string;
  asnNumber?: number;
  providerSlug?: string;
  countryIso3?: string;
  rir?: Rir;
  allocatedAt?: string;
}

export interface RegisterPrefixOutput {
  status: "registered" | "alreadyExists" | "rejected";
  prefixUri?: string;
  did?: string;
  cidr?: string;
  error?: string;
}

export interface GetPrefixInput {
  cidr?: string;
}

export interface GetPrefixOutput {
  prefix?: PrefixView;
  error?: string;
}

// ─── Provider tier (slice 2) ────────────────────────────────────────

export type ProviderKind =
  | "isp"
  | "cloud"
  | "transit"
  | "cdn"
  | "vpn"
  | "satellite";

export interface ProviderRecord {
  did: string;
  slug: string;
  name: string;
  kind?: ProviderKind;
  homepage?: string;
  countryIso3?: string;
  createdAt: string;
}

export interface ProviderView extends ProviderRecord {
  providerUri: string;
}

export interface RegisterProviderInput {
  slug: string;
  name: string;
  kind?: ProviderKind;
  homepage?: string;
  countryIso3?: string;
}

export interface RegisterProviderOutput {
  status: "registered" | "alreadyExists" | "rejected";
  providerUri?: string;
  did?: string;
  slug?: string;
  error?: string;
}

export interface GetProviderInput {
  slug?: string;
}

export interface GetProviderOutput {
  provider?: ProviderView;
  error?: string;
}

// ─── IP tier (slice 3) ──────────────────────────────────────────────

export type IpFamily = "ipv4" | "ipv6";

export interface IpRecord {
  did: string;
  address: string;
  family: IpFamily;
  prefixCidr?: string;
  asnNumber?: number;
  providerSlug?: string;
  countryIso3?: string;
  reverse?: string;
  /** Geo fields populated by collectGeoip / slice 7. */
  geoCity?: string;
  geoRegion?: string;
  geoLatPermille?: number;
  geoLonPermille?: number;
  geoSource?: string;
  geoCollectedAt?: string;
  createdAt: string;
}

export interface IpView extends IpRecord {
  ipUri: string;
}

export interface RegisterIpInput {
  address: string;
  family?: IpFamily;
  prefixCidr?: string;
  asnNumber?: number;
  providerSlug?: string;
  countryIso3?: string;
  reverse?: string;
  /** Geo fields (slice 7+). */
  geoCity?: string;
  geoRegion?: string;
  geoLatPermille?: number;
  geoLonPermille?: number;
  geoSource?: string;
  geoCollectedAt?: string;
}

export interface RegisterIpOutput {
  status: "registered" | "alreadyExists" | "rejected";
  ipUri?: string;
  did?: string;
  address?: string;
  error?: string;
}

export interface GetIpInput {
  address?: string;
}

export interface GetIpOutput {
  ip?: IpView;
  error?: string;
}

// ─── Scan tier (slice 4) ────────────────────────────────────────────

export type ScanKind =
  | "port"
  | "whois"
  | "geoip"
  | "vuln"
  | "rdns"
  | "abuse-contact"
  | "rir-delegation";

export type ScanStatus = "ok" | "partial" | "failed" | "rate-limited";

export interface ScanRecord {
  did: string;
  scanId: string;
  /** Target reference — IP address, CIDR, ASN, or composite did. */
  target: string;
  kind: ScanKind;
  status: ScanStatus;
  scannedAt: string;
  durationMs?: number;
  findings?: string[];
  rawResult?: string;
  sourceUrl?: string;
  createdAt: string;
}

export interface ScanView extends ScanRecord {
  scanUri: string;
}

export interface RegisterScanInput {
  scanId: string;
  target: string;
  kind: ScanKind;
  status?: ScanStatus;
  scannedAt?: string;
  durationMs?: number;
  findings?: string[];
  rawResult?: string;
  sourceUrl?: string;
}

export interface RegisterScanOutput {
  status: "registered" | "alreadyExists" | "rejected";
  scanUri?: string;
  did?: string;
  scanId?: string;
  error?: string;
}

export interface GetScanInput {
  scanId?: string;
}

export interface GetScanOutput {
  scan?: ScanView;
  error?: string;
}

export interface ListScansInput {
  target?: string;
  kind?: ScanKind;
  status?: ScanStatus;
  since?: string;
  limit?: number;
  cursor?: string;
}

export interface ListScansOutput {
  items: ScanView[];
  cursor?: string;
  total: number;
}

// ─── Search tier (slice 5) ──────────────────────────────────────────

export interface SearchProvidersInput {
  query: string;
  kind?: ProviderKind;
  countryIso3?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchProvidersOutput {
  items: ProviderView[];
  cursor?: string;
  total: number;
}

export interface ListProvidersInput {
  kind?: ProviderKind;
  countryIso3?: string;
  limit?: number;
  cursor?: string;
}

export interface ListProvidersOutput {
  items: ProviderView[];
  cursor?: string;
  total: number;
}

export interface ListPrefixesInput {
  asnNumber?: number;
  providerSlug?: string;
  countryIso3?: string;
  rir?: Rir;
  limit?: number;
  cursor?: string;
}

export interface ListPrefixesOutput {
  items: PrefixView[];
  cursor?: string;
  total: number;
}

// ─── Topology tier (slice 6) ────────────────────────────────────────

export interface GetDelegationChainInput {
  asnNumber: number;
}

export interface DelegationChainOutput {
  chain?: {
    rir?: Rir;
    provider?: ProviderRecord;
    asn: AsnRecord;
  };
  error?: string;
}

export interface GetIpTopologyInput {
  address?: string;
}

export interface GetIpTopologyOutput {
  topology?: {
    ip: IpRecord;
    prefix?: PrefixRecord;
    asn?: AsnRecord;
    provider?: ProviderRecord;
    rir?: Rir;
  };
  error?: string;
}

export interface PeeringRecord {
  /** Lower-numbered ASN (canonical ordering). */
  fromAsn: number;
  /** Higher-numbered ASN. */
  toAsn: number;
  relationship?: "peer" | "provider" | "customer";
  observedAt?: string;
}

export interface GetPeeringInput {
  asnNumber: number;
  limit?: number;
  cursor?: string;
}

export interface PeeringView extends PeeringRecord {
  peeringUri: string;
  neighborAsn: number;
}

export interface GetPeeringOutput {
  asnNumber?: number;
  peers?: PeeringView[];
  cursor?: string;
  error?: string;
}

// ─── Geo + Abuse tier (slice 7) ─────────────────────────────────────

export interface GetGeolocationInput {
  address?: string;
}

export interface Geolocation {
  address: string;
  countryIso3?: string;
  geoCity?: string;
  geoRegion?: string;
  /** Latitude × 1000 (AT Lexicon no-float restriction). */
  geoLatPermille?: number;
  /** Longitude × 1000 (AT Lexicon no-float restriction). */
  geoLonPermille?: number;
  source?: string;
  collectedAt?: string;
}

export interface GetGeolocationOutput {
  geolocation?: Geolocation;
  error?: string;
}

export interface GetAbuseContactInput {
  /** Either ASN number or IP address. ASN takes precedence if both provided. */
  asnNumber?: number;
  address?: string;
}

export interface AbuseContact {
  /** Resolved target this contact applies to. */
  target: string;
  asnNumber?: number;
  abuseEmail?: string;
  abuseTel?: string;
  source?: string;
  collectedAt?: string;
}

export interface GetAbuseContactOutput {
  abuseContact?: AbuseContact;
  error?: string;
}

// ─── Extended Register Inputs (slice 7 + 8) ─────────────────────────

// Re-export of registerIp / registerAsn input shapes is handled via
// the registries that own them — collect.ts directly uses Parameters<>.

// ─── Collect tier (slice 8) ─────────────────────────────────────────

export interface GeoipPayload {
  countryIso3?: string;
  geoCity?: string;
  geoRegion?: string;
  geoLatPermille?: number;
  geoLonPermille?: number;
}

export interface CollectGeoipInput {
  address: string;
  payload: GeoipPayload;
  source?: string;
  rawResult?: string;
  scanId?: string;
}

export interface CollectGeoipOutput {
  address?: string;
  ipUri?: string;
  scanUri?: string;
  status?: "registered" | "alreadyExists" | "rejected";
  error?: string;
}

export interface WhoisPayload {
  name?: string;
  country?: string;
  rir?: Rir;
  prefixes?: string[];
  abuseEmail?: string;
  abuseTel?: string;
}

export interface CollectWhoisInput {
  asnNumber: number;
  payload: WhoisPayload;
  source?: string;
  rawResult?: string;
  scanId?: string;
}

export interface CollectWhoisOutput {
  asnNumber?: number;
  asnUri?: string;
  scanUri?: string;
  status?: "registered" | "alreadyExists" | "rejected";
  error?: string;
}

export interface RirEntry {
  kind: "asn" | "prefix";
  asnNumber?: number;
  cidr?: string;
  country?: string;
}

export interface BatchIngestRirInput {
  rir: Rir;
  entries: RirEntry[];
}

export interface BatchIngestRirOutput {
  rir?: Rir;
  asnInserted?: number;
  prefixInserted?: number;
  failed?: { kind: string; key: string; reason: string }[];
  error?: string;
}

// ─── List tier (slice 9) ────────────────────────────────────────────

export interface ListAsnsInput {
  country?: string;
  rir?: Rir;
  limit?: number;
  cursor?: string;
}

export interface ListAsnsOutput {
  items: AsnView[];
  cursor?: string;
  total: number;
}

export interface ListIpsInput {
  family?: IpFamily;
  prefixCidr?: string;
  asnNumber?: number;
  providerSlug?: string;
  countryIso3?: string;
  limit?: number;
  cursor?: string;
}

export interface ListIpsOutput {
  items: IpView[];
  cursor?: string;
  total: number;
}

export interface BatchRegisterIpInput {
  ips: RegisterIpInput[];
}

export interface BatchRegisterIpOutput {
  registered?: { address: string; ipUri: string }[];
  skipped?: { address: string; reason: string }[];
  error?: string;
}

// ─── Analyze tier (slice 10) ────────────────────────────────────────

export interface AnalyzeIpInput {
  address: string;
  recentScans?: number;
}

export interface AnalyzeIpOutput {
  address?: string;
  topology?: GetIpTopologyOutput["topology"];
  geolocation?: Geolocation;
  abuseContact?: AbuseContact;
  recentScans?: ScanView[];
  error?: string;
}

export interface AnalyzeAsnInput {
  asnNumber: number;
  recentScans?: number;
}

export interface AnalyzeAsnOutput {
  asnNumber?: number;
  asn?: AsnRecord;
  prefixDetails?: PrefixRecord[];
  delegationChain?: DelegationChainOutput["chain"];
  recentScans?: ScanView[];
  error?: string;
}

export interface AnalyzePrefixInput {
  cidr: string;
  recentScans?: number;
}

export interface AnalyzePrefixOutput {
  cidr?: string;
  prefix?: PrefixRecord;
  asn?: AsnRecord;
  provider?: ProviderRecord;
  recentScans?: ScanView[];
  error?: string;
}

// ─── Peering + RIR/NIR tier (slice 11) ──────────────────────────────

export interface RegisterPeeringInput {
  fromAsn: number;
  toAsn: number;
  relationship?: "peer" | "provider" | "customer";
  observedAt?: string;
}

export interface RegisterPeeringOutput {
  status: "registered" | "alreadyExists" | "rejected";
  peeringUri?: string;
  fromAsn?: number;
  toAsn?: number;
  error?: string;
}

export interface ListPeeringInput {
  aroundAsn?: number;
  relationship?: "peer" | "provider" | "customer";
  limit?: number;
  cursor?: string;
}

export interface ListPeeringOutput {
  items: PeeringView[];
  cursor?: string;
  total: number;
}

export interface RirRecord {
  did: string;
  rir: Rir;
  name: string;
  region?: string;
  homepage?: string;
  rdapBase?: string;
  createdAt: string;
}

export interface RirView extends RirRecord {
  rirUri: string;
}

export interface RegisterRirInput {
  rir: Rir;
  name: string;
  region?: string;
  homepage?: string;
  rdapBase?: string;
}

export interface RegisterRirOutput {
  status: "registered" | "alreadyExists" | "rejected";
  rirUri?: string;
  did?: string;
  rir?: Rir;
  error?: string;
}

export interface NirRecord {
  did: string;
  slug: string;
  name: string;
  parentRir: Rir;
  countryIso3?: string;
  homepage?: string;
  createdAt: string;
}

export interface RegisterNirInput {
  slug: string;
  name: string;
  parentRir: Rir;
  countryIso3?: string;
  homepage?: string;
}

export interface RegisterNirOutput {
  status: "registered" | "alreadyExists" | "rejected";
  nirUri?: string;
  did?: string;
  slug?: string;
  error?: string;
}

export interface GetRirInput {
  rir?: Rir;
}

export interface GetRirOutput {
  rirRecord?: RirView;
  error?: string;
}

// ─── Final tier (slice 12) ──────────────────────────────────────────

export interface ListRirsInput {
  limit?: number;
  cursor?: string;
}

export interface ListRirsOutput {
  items: RirView[];
  cursor?: string;
  total: number;
}

export interface NirView extends NirRecord {
  nirUri: string;
}

export interface ListNirsInput {
  parentRir?: Rir;
  limit?: number;
  cursor?: string;
}

export interface ListNirsOutput {
  items: NirView[];
  cursor?: string;
  total: number;
}

export interface GetNirInput {
  slug?: string;
}

export interface GetNirOutput {
  nirRecord?: NirView;
  error?: string;
}

export interface GetPrefixContainingIpInput {
  address: string;
  maxScan?: number;
}

export interface GetPrefixContainingIpOutput {
  address?: string;
  prefix?: PrefixView;
  truncated?: boolean;
  error?: string;
}
