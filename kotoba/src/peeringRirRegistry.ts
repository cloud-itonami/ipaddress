/**
 * ipaddress kotoba — peering + RIR/NIR registry (slice 11, +5 → 33/37).
 *
 *   registerPeering   — adjacent ASN edge write (canonical fromAsn<toAsn)
 *   listPeering       — cursor listing (paired with getPeering's filter)
 *   registerRir       — RIR (apnic/arin/ripe/lacnic/afrinic) profile write
 *   registerNir       — NIR (jpnic/cnnic/krnic/...) profile write
 *   getRir            — rkey-direct read
 *
 * Slice 11 completes the authority-chain root: RIR → NIR are now first-
 * class records (previously they were enum-only on AsnRecord.rir).
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  IPADDRESS_DID_PREFIX,
  type GetRirInput,
  type GetRirOutput,
  type ListPeeringInput,
  type ListPeeringOutput,
  type NirRecord,
  type PeeringRecord,
  type PeeringView,
  type RegisterNirInput,
  type RegisterNirOutput,
  type RegisterPeeringInput,
  type RegisterPeeringOutput,
  type RegisterRirInput,
  type RegisterRirOutput,
  type RirRecord,
  type RirView,
} from "./types.js";

const PEERING_COLLECTION = "com.etzhayyim.apps.ipaddress.peering";
const RIR_COLLECTION = "com.etzhayyim.apps.ipaddress.rir";
const NIR_COLLECTION = "com.etzhayyim.apps.ipaddress.nir";

function peeringRkey(a: number, b: number): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `peering-${lo}-${hi}`;
}

function rirRkey(rir: string): string {
  return `rir-${rir.toLowerCase()}`;
}

function nirRkey(slug: string): string {
  return `nir-${slug.toLowerCase()}`;
}

export async function registerPeering(
  e: Etzhayyim,
  input: RegisterPeeringInput
): Promise<RegisterPeeringOutput> {
  if (
    typeof input.fromAsn !== "number" ||
    typeof input.toAsn !== "number" ||
    input.fromAsn === input.toAsn
  ) {
    return { status: "rejected", error: "invalidAsns" };
  }
  const [lo, hi] =
    input.fromAsn < input.toAsn
      ? [input.fromAsn, input.toAsn]
      : [input.toAsn, input.fromAsn];
  const rkey = peeringRkey(lo, hi);
  const existing = await e
    .read<PeeringRecord>({ collection: PEERING_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      peeringUri: existing.records[0].uri,
      fromAsn: lo,
      toAsn: hi,
    };
  }
  const record: PeeringRecord = {
    fromAsn: lo,
    toAsn: hi,
    relationship: input.relationship,
    observedAt: input.observedAt ?? new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: PEERING_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    peeringUri: receipt.uri,
    fromAsn: lo,
    toAsn: hi,
  };
}

export async function listPeering(
  e: Etzhayyim,
  input: ListPeeringInput = {}
): Promise<ListPeeringOutput> {
  const limit = Math.min(input.limit ?? 100, 200);
  const resp = await e.read<PeeringRecord>({
    collection: PEERING_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: PeeringView[] = resp.records
    .filter((r) => {
      if (input.relationship && r.value.relationship !== input.relationship) {
        return false;
      }
      return true;
    })
    .map((r) => ({
      ...r.value,
      peeringUri: r.uri,
      neighborAsn:
        input.aroundAsn === r.value.fromAsn
          ? r.value.toAsn
          : input.aroundAsn === r.value.toAsn
            ? r.value.fromAsn
            : r.value.toAsn,
    }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function registerRir(
  e: Etzhayyim,
  input: RegisterRirInput
): Promise<RegisterRirOutput> {
  if (!input.rir || !input.name) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = rirRkey(input.rir);
  const existing = await e
    .read<RirRecord>({ collection: RIR_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      rirUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      rir: input.rir,
    };
  }
  const did = `${IPADDRESS_DID_PREFIX}rir:${input.rir}`;
  const record: RirRecord = {
    did,
    rir: input.rir,
    name: input.name,
    region: input.region,
    homepage: input.homepage,
    rdapBase: input.rdapBase,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: RIR_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    rirUri: receipt.uri,
    did,
    rir: input.rir,
  };
}

export async function registerNir(
  e: Etzhayyim,
  input: RegisterNirInput
): Promise<RegisterNirOutput> {
  if (!input.slug || !input.name || !input.parentRir) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = nirRkey(input.slug);
  const existing = await e
    .read<NirRecord>({ collection: NIR_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      nirUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      slug: input.slug,
    };
  }
  const did = `${IPADDRESS_DID_PREFIX}nir:${input.slug.toLowerCase()}`;
  const record: NirRecord = {
    did,
    slug: input.slug,
    name: input.name,
    parentRir: input.parentRir,
    countryIso3: input.countryIso3,
    homepage: input.homepage,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: NIR_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    nirUri: receipt.uri,
    did,
    slug: input.slug,
  };
}

export async function getRir(
  e: Etzhayyim,
  input: GetRirInput
): Promise<GetRirOutput> {
  if (!input.rir) return { error: "missingRir" };
  const resp = await e
    .read<RirRecord>({ collection: RIR_COLLECTION, rkey: rirRkey(input.rir) })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: RirView = { ...r.value, rirUri: r.uri };
  return { rirRecord: view };
}
