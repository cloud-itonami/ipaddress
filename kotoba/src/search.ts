/**
 * ipaddress kotoba — search tier (slice 5, +3 → 14/37).
 *
 *   searchProviders  — Phase 2 client-side text match across name/slug
 *   listProviders    — cursor + kind/country filter (paired query API)
 *   listPrefixes     — cursor + asn/provider/country/rir filter
 *
 * Phase 3 mst-projector + IVF vector index replaces post-fetch filtering
 * with proper indexed views. Same architectural pattern as hanrei
 * searchCases — text matching is a stop-gap until indexed views land.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  type ListPrefixesInput,
  type ListPrefixesOutput,
  type ListProvidersInput,
  type ListProvidersOutput,
  type PrefixRecord,
  type PrefixView,
  type ProviderRecord,
  type ProviderView,
  type SearchProvidersInput,
  type SearchProvidersOutput,
} from "./types.js";

const PREFIX_COLLECTION = "com.etzhayyim.apps.ipaddress.prefix";
const PROVIDER_COLLECTION = "com.etzhayyim.apps.ipaddress.provider";

export async function searchProviders(
  e: Etzhayyim,
  input: SearchProvidersInput
): Promise<SearchProvidersOutput> {
  if (!input.query) return { items: [], total: 0 };
  const limit = Math.min(input.limit ?? 20, 50);
  const resp = await e.read<ProviderRecord>({
    collection: PROVIDER_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const q = input.query.toLowerCase();
  const items: ProviderView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.kind && v.kind !== input.kind) return false;
      if (
        input.countryIso3 &&
        v.countryIso3?.toLowerCase() !== input.countryIso3.toLowerCase()
      ) {
        return false;
      }
      const hay = [v.name, v.slug, v.homepage]
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase());
      return hay.some((h) => h.includes(q));
    })
    .map((r) => ({ ...r.value, providerUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function listProviders(
  e: Etzhayyim,
  input: ListProvidersInput = {}
): Promise<ListProvidersOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<ProviderRecord>({
    collection: PROVIDER_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: ProviderView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.kind && v.kind !== input.kind) return false;
      if (
        input.countryIso3 &&
        v.countryIso3?.toLowerCase() !== input.countryIso3.toLowerCase()
      ) {
        return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, providerUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function listPrefixes(
  e: Etzhayyim,
  input: ListPrefixesInput = {}
): Promise<ListPrefixesOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<PrefixRecord>({
    collection: PREFIX_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: PrefixView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.asnNumber && v.asnNumber !== input.asnNumber) return false;
      if (input.providerSlug && v.providerSlug !== input.providerSlug) {
        return false;
      }
      if (
        input.countryIso3 &&
        v.countryIso3?.toLowerCase() !== input.countryIso3.toLowerCase()
      ) {
        return false;
      }
      if (input.rir && v.rir !== input.rir) return false;
      return true;
    })
    .map((r) => ({ ...r.value, prefixUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
