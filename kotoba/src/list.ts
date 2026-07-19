/**
 * ipaddress kotoba — list tier (slice 9, +3 → 25/37).
 *
 *   listAsns         — cursor + country/rir filter
 *   listIps          — cursor + prefix/asn/provider/country filter
 *   batchRegisterIp  — bulk write of IpRecords (idempotent per address)
 *
 * Pure read paginators + one bulk write helper. Phase 3 mst-projector
 * pushes the post-fetch filtering server-side.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import { registerIp } from "./ipRegistry.js";
import {
  type AsnRecord,
  type AsnView,
  type BatchRegisterIpInput,
  type BatchRegisterIpOutput,
  type IpRecord,
  type IpView,
  type ListAsnsInput,
  type ListAsnsOutput,
  type ListIpsInput,
  type ListIpsOutput,
} from "./types.js";

const ASN_COLLECTION = "com.etzhayyim.apps.ipaddress.asn";
const IP_COLLECTION = "com.etzhayyim.apps.ipaddress.ip";

export async function listAsns(
  e: Etzhayyim,
  input: ListAsnsInput = {}
): Promise<ListAsnsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<AsnRecord>({
    collection: ASN_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: AsnView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (
        input.country &&
        v.country?.toLowerCase() !== input.country.toLowerCase()
      ) {
        return false;
      }
      if (input.rir && v.rir !== input.rir) return false;
      return true;
    })
    .map((r) => ({ ...r.value, asnUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function listIps(
  e: Etzhayyim,
  input: ListIpsInput = {}
): Promise<ListIpsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<IpRecord>({
    collection: IP_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: IpView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.family && v.family !== input.family) return false;
      if (input.prefixCidr && v.prefixCidr !== input.prefixCidr) return false;
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
      return true;
    })
    .map((r) => ({ ...r.value, ipUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function batchRegisterIp(
  e: Etzhayyim,
  input: BatchRegisterIpInput
): Promise<BatchRegisterIpOutput> {
  if (!input.ips || input.ips.length === 0) {
    return { error: "missingIps" };
  }
  const registered: { address: string; ipUri: string }[] = [];
  const skipped: { address: string; reason: string }[] = [];
  for (const ip of input.ips) {
    const r = await registerIp(e, ip);
    if (r.status === "registered" && r.ipUri) {
      registered.push({ address: r.address!, ipUri: r.ipUri });
    } else if (r.status === "alreadyExists") {
      skipped.push({ address: ip.address, reason: "alreadyExists" });
    } else if (r.status === "rejected") {
      skipped.push({ address: ip.address, reason: r.error ?? "rejected" });
    }
  }
  return { registered, skipped };
}
