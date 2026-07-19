/**
 * ipaddress kotoba — geo + abuse tier (slice 7, +2 → 19/37).
 *
 *   getGeolocation  — derive Geolocation from IpRecord geo fields
 *   getAbuseContact — derive AbuseContact from AsnRecord (or IP → ASN walk)
 *
 * Both are read-side projections over existing IP / ASN records.
 * Population of the geo* / abuse* fields is the job of (future) slices:
 *   collectGeoip  — calls external geoip provider, then registerIp({...,geo*})
 *   collectWhois  — calls external whois, then registerAsn({...,abuse*})
 *
 * Both fields use permille for lat/lon to satisfy the AT Lexicon
 * no-float restriction per root CLAUDE.md.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  type AbuseContact,
  type AsnRecord,
  type GetAbuseContactInput,
  type GetAbuseContactOutput,
  type GetGeolocationInput,
  type GetGeolocationOutput,
  type Geolocation,
  type IpRecord,
} from "./types.js";

const ASN_COLLECTION = "com.etzhayyim.apps.ipaddress.asn";
const IP_COLLECTION = "com.etzhayyim.apps.ipaddress.ip";

function asnRkey(num: number): string {
  return `asn-${num}`;
}

function ipRkey(address: string): string {
  return `ip-${address.toLowerCase().replace(/[.:]/g, "-")}`;
}

export async function getGeolocation(
  e: Etzhayyim,
  input: GetGeolocationInput
): Promise<GetGeolocationOutput> {
  if (!input.address) return { error: "missingAddress" };
  const resp = await e
    .read<IpRecord>({ collection: IP_COLLECTION, rkey: ipRkey(input.address) })
    .catch(() => ({ records: [] }));
  const ip = resp.records[0]?.value;
  if (!ip) return { error: "ipNotFound" };
  const geolocation: Geolocation = {
    address: ip.address,
    countryIso3: ip.countryIso3,
    geoCity: ip.geoCity,
    geoRegion: ip.geoRegion,
    geoLatPermille: ip.geoLatPermille,
    geoLonPermille: ip.geoLonPermille,
    source: ip.geoSource,
    collectedAt: ip.geoCollectedAt,
  };
  return { geolocation };
}

export async function getAbuseContact(
  e: Etzhayyim,
  input: GetAbuseContactInput
): Promise<GetAbuseContactOutput> {
  let asnNumber = input.asnNumber;
  let target: string | undefined;

  if (typeof asnNumber !== "number") {
    if (!input.address) return { error: "missingAsnOrAddress" };
    const ipResp = await e
      .read<IpRecord>({
        collection: IP_COLLECTION,
        rkey: ipRkey(input.address),
      })
      .catch(() => ({ records: [] }));
    const ip = ipResp.records[0]?.value;
    if (!ip) return { error: "ipNotFound" };
    if (typeof ip.asnNumber !== "number") {
      return { error: "ipHasNoAsn" };
    }
    asnNumber = ip.asnNumber;
    target = input.address;
  } else {
    target = `asn-${asnNumber}`;
  }

  const asnResp = await e
    .read<AsnRecord>({ collection: ASN_COLLECTION, rkey: asnRkey(asnNumber) })
    .catch(() => ({ records: [] }));
  const asn = asnResp.records[0]?.value;
  if (!asn) return { error: "asnNotFound" };
  const abuseContact: AbuseContact = {
    target: target!,
    asnNumber,
    abuseEmail: asn.abuseEmail,
    abuseTel: asn.abuseTel,
    source: asn.abuseSource,
    collectedAt: asn.abuseCollectedAt,
  };
  return { abuseContact };
}
