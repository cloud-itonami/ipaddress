/**
 * ipaddress kotoba — ip tier (slice 3, +2 → 8/37).
 *
 *   registerIp  — single IPv4/IPv6 address write (idempotent rkey=ip-{address-slug})
 *   getIp       — rkey-direct read
 *
 * Sits below Prefix in the authority chain (each IP belongs to a CIDR).
 * Bulk batchRegisterIp + listIps + searchIps ship in follow-up slices.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  IPADDRESS_DID_PREFIX,
  type GetIpInput,
  type GetIpOutput,
  type IpRecord,
  type IpView,
  type RegisterIpInput,
  type RegisterIpOutput,
} from "./types.js";

const IP_COLLECTION = "com.etzhayyim.apps.ipaddress.ip";

function ipSlug(address: string): string {
  return address.toLowerCase().replace(/[.:]/g, "-");
}

function ipDid(address: string): string {
  return `${IPADDRESS_DID_PREFIX}ip:${ipSlug(address)}`;
}

function ipRkey(address: string): string {
  return `ip-${ipSlug(address)}`;
}

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;
const IPV6_RE = /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

function isValidIp(address: string): boolean {
  return IPV4_RE.test(address) || IPV6_RE.test(address);
}

export async function registerIp(
  e: Etzhayyim,
  input: RegisterIpInput
): Promise<RegisterIpOutput> {
  if (!input.address) {
    return { status: "rejected", error: "missingAddress" };
  }
  if (!isValidIp(input.address)) {
    return { status: "rejected", error: "invalidAddressFormat" };
  }
  const rkey = ipRkey(input.address);
  const existing = await e
    .read<IpRecord>({ collection: IP_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      ipUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      address: input.address,
    };
  }
  const did = ipDid(input.address);
  const record: IpRecord = {
    did,
    address: input.address,
    family: input.family ?? (input.address.includes(":") ? "ipv6" : "ipv4"),
    prefixCidr: input.prefixCidr,
    asnNumber: input.asnNumber,
    providerSlug: input.providerSlug,
    countryIso3: input.countryIso3,
    reverse: input.reverse,
    geoCity: input.geoCity,
    geoRegion: input.geoRegion,
    geoLatPermille: input.geoLatPermille,
    geoLonPermille: input.geoLonPermille,
    geoSource: input.geoSource,
    geoCollectedAt: input.geoCollectedAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: IP_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    ipUri: receipt.uri,
    did,
    address: input.address,
  };
}

export async function getIp(
  e: Etzhayyim,
  input: GetIpInput
): Promise<GetIpOutput> {
  if (!input.address) return { error: "missingAddress" };
  const resp = await e
    .read<IpRecord>({
      collection: IP_COLLECTION,
      rkey: ipRkey(input.address),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: IpView = { ...r.value, ipUri: r.uri };
  return { ip: view };
}
