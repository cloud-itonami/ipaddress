/**
 * ipaddress kotoba — analyze tier (slice 10, +3 → 28/37).
 *
 *   analyzeIp     — composite read: IP + prefix + ASN + provider + geo + abuse + recent scans
 *   analyzeAsn    — composite read: ASN + prefixes + delegation chain + recent scans
 *   analyzePrefix — composite read: prefix + parent ASN + provider + recent scans
 *
 * Single-call materializations that wrap multiple read paths into one
 * coherent report. Phase 3 mst-projector pushes this server-side via
 * indexed composite views — for now these do N parallel reads.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import { getAbuseContact, getGeolocation } from "./geoAbuse.js";
import { getDelegationChain, getIpTopology } from "./topology.js";
import { listScans } from "./scanRegistry.js";
import {
  type AnalyzeAsnInput,
  type AnalyzeAsnOutput,
  type AnalyzeIpInput,
  type AnalyzeIpOutput,
  type AnalyzePrefixInput,
  type AnalyzePrefixOutput,
  type AsnRecord,
  type PrefixRecord,
  type ProviderRecord,
} from "./types.js";

const ASN_COLLECTION = "com.etzhayyim.apps.ipaddress.asn";
const PREFIX_COLLECTION = "com.etzhayyim.apps.ipaddress.prefix";
const PROVIDER_COLLECTION = "com.etzhayyim.apps.ipaddress.provider";

function asnRkey(num: number): string {
  return `asn-${num}`;
}

function prefixRkey(cidr: string): string {
  return `prefix-${cidr.toLowerCase().replace(/[.:/]/g, "-")}`;
}

function providerRkey(slug: string): string {
  return `provider-${slug.toLowerCase()}`;
}

export async function analyzeIp(
  e: Etzhayyim,
  input: AnalyzeIpInput
): Promise<AnalyzeIpOutput> {
  if (!input.address) return { error: "missingAddress" };
  const recentLimit = input.recentScans ?? 5;
  const [topoRes, geoRes, abuseRes, scansRes] = await Promise.all([
    getIpTopology(e, { address: input.address }),
    getGeolocation(e, { address: input.address }),
    getAbuseContact(e, { address: input.address }).catch(() => ({})),
    listScans(e, {
      target: input.address,
      limit: recentLimit,
    }),
  ]);
  if (topoRes.error) return { error: topoRes.error };
  return {
    address: input.address,
    topology: topoRes.topology,
    geolocation: geoRes.geolocation,
    abuseContact: "abuseContact" in abuseRes ? abuseRes.abuseContact : undefined,
    recentScans: scansRes.items,
  };
}

export async function analyzeAsn(
  e: Etzhayyim,
  input: AnalyzeAsnInput
): Promise<AnalyzeAsnOutput> {
  if (typeof input.asnNumber !== "number") {
    return { error: "missingAsnNumber" };
  }
  const recentLimit = input.recentScans ?? 5;
  const [asnResp, chainRes, scansRes] = await Promise.all([
    e
      .read<AsnRecord>({
        collection: ASN_COLLECTION,
        rkey: asnRkey(input.asnNumber),
      })
      .catch(() => ({ records: [] })),
    getDelegationChain(e, { asnNumber: input.asnNumber }),
    listScans(e, {
      target: `asn-${input.asnNumber}`,
      limit: recentLimit,
    }),
  ]);
  const asn = asnResp.records[0]?.value;
  if (!asn) return { error: "asnNotFound" };

  const prefixDetails: PrefixRecord[] = [];
  if (asn.prefixes && asn.prefixes.length > 0) {
    const prefixReads = await Promise.all(
      asn.prefixes.slice(0, 50).map((cidr) =>
        e
          .read<PrefixRecord>({
            collection: PREFIX_COLLECTION,
            rkey: prefixRkey(cidr),
          })
          .catch(() => ({ records: [] }))
      )
    );
    for (const r of prefixReads) {
      if (r.records[0]?.value) prefixDetails.push(r.records[0].value);
    }
  }

  return {
    asnNumber: input.asnNumber,
    asn,
    prefixDetails,
    delegationChain: chainRes.chain,
    recentScans: scansRes.items,
  };
}

export async function analyzePrefix(
  e: Etzhayyim,
  input: AnalyzePrefixInput
): Promise<AnalyzePrefixOutput> {
  if (!input.cidr) return { error: "missingCidr" };
  const recentLimit = input.recentScans ?? 5;
  const prefResp = await e
    .read<PrefixRecord>({
      collection: PREFIX_COLLECTION,
      rkey: prefixRkey(input.cidr),
    })
    .catch(() => ({ records: [] }));
  const prefix = prefResp.records[0]?.value;
  if (!prefix) return { error: "prefixNotFound" };

  let asn: AsnRecord | undefined;
  let provider: ProviderRecord | undefined;
  const reads: Promise<unknown>[] = [];
  if (typeof prefix.asnNumber === "number") {
    reads.push(
      e
        .read<AsnRecord>({
          collection: ASN_COLLECTION,
          rkey: asnRkey(prefix.asnNumber),
        })
        .then((r) => {
          asn = r.records[0]?.value;
        })
        .catch(() => undefined)
    );
  }
  if (prefix.providerSlug) {
    reads.push(
      e
        .read<ProviderRecord>({
          collection: PROVIDER_COLLECTION,
          rkey: providerRkey(prefix.providerSlug),
        })
        .then((r) => {
          provider = r.records[0]?.value;
        })
        .catch(() => undefined)
    );
  }
  const scansRes = await listScans(e, { target: input.cidr, limit: recentLimit });
  await Promise.all(reads);

  return {
    cidr: input.cidr,
    prefix,
    asn,
    provider,
    recentScans: scansRes.items,
  };
}
