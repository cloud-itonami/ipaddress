/**
 * ipaddress kotoba — topology tier (slice 6, +3 → 17/37).
 *
 *   getDelegationChain — RIR → NIR → Provider → ASN delegation walk for one ASN
 *   getIpTopology      — given an IP, derive prefix + ASN + provider + RIR
 *   getPeering         — list adjacent ASNs for one ASN
 *                        (Phase 2 = static from PeeringRecord;
 *                         Phase 3 = live BGP table snapshot via scan tier)
 *
 * Read-side composition only — no new collection. Phase 3 mst-projector
 * adds indexed reverse-lookup views; this slice does in-process joins.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  type AsnRecord,
  type AsnView,
  type DelegationChainOutput,
  type GetDelegationChainInput,
  type GetIpTopologyInput,
  type GetIpTopologyOutput,
  type GetPeeringInput,
  type GetPeeringOutput,
  type IpRecord,
  type PeeringRecord,
  type PrefixRecord,
  type ProviderRecord,
} from "./types.js";

const ASN_COLLECTION = "com.etzhayyim.apps.ipaddress.asn";
const PREFIX_COLLECTION = "com.etzhayyim.apps.ipaddress.prefix";
const PROVIDER_COLLECTION = "com.etzhayyim.apps.ipaddress.provider";
const IP_COLLECTION = "com.etzhayyim.apps.ipaddress.ip";
const PEERING_COLLECTION = "com.etzhayyim.apps.ipaddress.peering";

function asnRkey(num: number): string {
  return `asn-${num}`;
}

function prefixRkey(cidr: string): string {
  return `prefix-${cidr.toLowerCase().replace(/[.:/]/g, "-")}`;
}

function providerRkey(slug: string): string {
  return `provider-${slug.toLowerCase()}`;
}

function ipRkey(address: string): string {
  return `ip-${address.toLowerCase().replace(/[.:]/g, "-")}`;
}

export async function getDelegationChain(
  e: Etzhayyim,
  input: GetDelegationChainInput
): Promise<DelegationChainOutput> {
  if (typeof input.asnNumber !== "number") {
    return { error: "missingAsnNumber" };
  }
  const asnResp = await e
    .read<AsnRecord>({
      collection: ASN_COLLECTION,
      rkey: asnRkey(input.asnNumber),
    })
    .catch(() => ({ records: [] }));
  const asn = asnResp.records[0]?.value;
  if (!asn) return { error: "asnNotFound" };

  // Walk down: ASN → providers it serves (heuristic: first prefix.providerSlug)
  // and up: RIR.
  let providerView: ProviderRecord | undefined;
  if (asn.prefixes && asn.prefixes.length > 0) {
    const firstPrefixResp = await e
      .read<PrefixRecord>({
        collection: PREFIX_COLLECTION,
        rkey: prefixRkey(asn.prefixes[0]),
      })
      .catch(() => ({ records: [] }));
    const firstPrefix = firstPrefixResp.records[0]?.value;
    if (firstPrefix?.providerSlug) {
      const provResp = await e
        .read<ProviderRecord>({
          collection: PROVIDER_COLLECTION,
          rkey: providerRkey(firstPrefix.providerSlug),
        })
        .catch(() => ({ records: [] }));
      providerView = provResp.records[0]?.value;
    }
  }

  return {
    chain: {
      rir: asn.rir,
      provider: providerView,
      asn,
    },
  };
}

export async function getIpTopology(
  e: Etzhayyim,
  input: GetIpTopologyInput
): Promise<GetIpTopologyOutput> {
  if (!input.address) return { error: "missingAddress" };
  const ipResp = await e
    .read<IpRecord>({ collection: IP_COLLECTION, rkey: ipRkey(input.address) })
    .catch(() => ({ records: [] }));
  const ip = ipResp.records[0]?.value;
  if (!ip) return { error: "ipNotFound" };

  let prefix: PrefixRecord | undefined;
  if (ip.prefixCidr) {
    const pr = await e
      .read<PrefixRecord>({
        collection: PREFIX_COLLECTION,
        rkey: prefixRkey(ip.prefixCidr),
      })
      .catch(() => ({ records: [] }));
    prefix = pr.records[0]?.value;
  }

  let asn: AsnRecord | undefined;
  if (ip.asnNumber !== undefined) {
    const ar = await e
      .read<AsnRecord>({
        collection: ASN_COLLECTION,
        rkey: asnRkey(ip.asnNumber),
      })
      .catch(() => ({ records: [] }));
    asn = ar.records[0]?.value;
  }

  let provider: ProviderRecord | undefined;
  if (ip.providerSlug) {
    const prov = await e
      .read<ProviderRecord>({
        collection: PROVIDER_COLLECTION,
        rkey: providerRkey(ip.providerSlug),
      })
      .catch(() => ({ records: [] }));
    provider = prov.records[0]?.value;
  }

  return {
    topology: {
      ip,
      prefix,
      asn,
      provider,
      rir: asn?.rir ?? prefix?.rir,
    },
  };
}

export async function getPeering(
  e: Etzhayyim,
  input: GetPeeringInput
): Promise<GetPeeringOutput> {
  if (typeof input.asnNumber !== "number") {
    return { error: "missingAsnNumber" };
  }
  const limit = Math.min(input.limit ?? 100, 200);
  const resp = await e.read<PeeringRecord>({
    collection: PEERING_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const peers = resp.records
    .filter(
      (r) =>
        r.value.fromAsn === input.asnNumber ||
        r.value.toAsn === input.asnNumber
    )
    .map((r) => ({
      ...r.value,
      peeringUri: r.uri,
      neighborAsn:
        r.value.fromAsn === input.asnNumber
          ? r.value.toAsn
          : r.value.fromAsn,
    }));
  return { asnNumber: input.asnNumber, peers, cursor: resp.cursor };
}

/** Convenience: explicit AsnView re-export so callers don't reach into types. */
export type { AsnView };
