/**
 * ipaddress kotoba — prefix + provider registry (slice 2).
 *
 *   registerPrefix      — CIDR prefix (e.g., 1.0.0.0/24)
 *   getPrefix           — rkey-direct lookup
 *   registerProvider    — ISP / cloud / etc.
 *   getProvider         — rkey-direct lookup
 *
 * Per ADR-2605203000 Option B (PDS XRPC). Idempotency via rkey:
 *   prefix-{cidr-slug}    (e.g., prefix-1-0-0-0-24)
 *   provider-{slug}
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  IPADDRESS_DID_PREFIX,
  type GetPrefixInput,
  type GetPrefixOutput,
  type GetProviderInput,
  type GetProviderOutput,
  type PrefixRecord,
  type PrefixView,
  type ProviderRecord,
  type ProviderView,
  type RegisterPrefixInput,
  type RegisterPrefixOutput,
  type RegisterProviderInput,
  type RegisterProviderOutput,
} from "./types.js";

const PREFIX_COLLECTION = "com.etzhayyim.apps.ipaddress.prefix";
const PROVIDER_COLLECTION = "com.etzhayyim.apps.ipaddress.provider";

function prefixSlug(cidr: string): string {
  return cidr.toLowerCase().replace(/[.:/]/g, "-");
}

function prefixDid(cidr: string): string {
  return `${IPADDRESS_DID_PREFIX}prefix:${prefixSlug(cidr)}`;
}

function prefixRkey(cidr: string): string {
  return `prefix-${prefixSlug(cidr)}`;
}

function providerDid(slug: string): string {
  return `${IPADDRESS_DID_PREFIX}provider:${slug.toLowerCase()}`;
}

function providerRkey(slug: string): string {
  return `provider-${slug.toLowerCase()}`;
}

// ─── Prefix ─────────────────────────────────────────────────────────

export async function registerPrefix(
  e: Etzhayyim,
  input: RegisterPrefixInput
): Promise<RegisterPrefixOutput> {
  if (!input.cidr) {
    return { status: "rejected", error: "missingCidr" };
  }
  const rkey = prefixRkey(input.cidr);
  const existing = await e
    .read<PrefixRecord>({ collection: PREFIX_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      prefixUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      cidr: input.cidr,
    };
  }
  const did = prefixDid(input.cidr);
  const record: PrefixRecord = {
    did,
    cidr: input.cidr,
    asnNumber: input.asnNumber,
    providerSlug: input.providerSlug,
    countryIso3: input.countryIso3,
    rir: input.rir,
    allocatedAt: input.allocatedAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: PREFIX_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    prefixUri: receipt.uri,
    did,
    cidr: input.cidr,
  };
}

export async function getPrefix(
  e: Etzhayyim,
  input: GetPrefixInput
): Promise<GetPrefixOutput> {
  if (!input.cidr) return { error: "missingCidr" };
  const resp = await e
    .read<PrefixRecord>({
      collection: PREFIX_COLLECTION,
      rkey: prefixRkey(input.cidr),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: PrefixView = { ...r.value, prefixUri: r.uri };
  return { prefix: view };
}

// ─── Provider ───────────────────────────────────────────────────────

export async function registerProvider(
  e: Etzhayyim,
  input: RegisterProviderInput
): Promise<RegisterProviderOutput> {
  if (!input.slug || !input.name) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = providerRkey(input.slug);
  const existing = await e
    .read<ProviderRecord>({ collection: PROVIDER_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      providerUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      slug: input.slug,
    };
  }
  const did = providerDid(input.slug);
  const record: ProviderRecord = {
    did,
    slug: input.slug,
    name: input.name,
    kind: input.kind,
    homepage: input.homepage,
    countryIso3: input.countryIso3,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: PROVIDER_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    providerUri: receipt.uri,
    did,
    slug: input.slug,
  };
}

export async function getProvider(
  e: Etzhayyim,
  input: GetProviderInput
): Promise<GetProviderOutput> {
  if (!input.slug) return { error: "missingSlug" };
  const resp = await e
    .read<ProviderRecord>({
      collection: PROVIDER_COLLECTION,
      rkey: providerRkey(input.slug),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: ProviderView = { ...r.value, providerUri: r.uri };
  return { provider: view };
}
