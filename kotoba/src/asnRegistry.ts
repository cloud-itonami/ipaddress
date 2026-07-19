/**
 * ipaddress kotoba — asn registry (Option B reference).
 *
 * Per ADR-2605203000 Phase E Option B: replace vendor's
 *   const db = createKyselyDb();
 *   await db.insertInto("vertex_ip_asn").values({...}).execute();
 * with:
 *   await e.write({ collection, record, rkey });
 *
 * Vendor reference: `60-apps/etzhayyim-project-ipaddress/appview/
 *   etzhayyim-wasm-ipaddress-n7w1p4d0/src/app.ts:331` (cmdRegisterAsn).
 *
 * Scope: 2 reference commands of 37 total in vendor.
 *   - registerAsn  — write pattern (idempotent via rkey=asn-{number})
 *   - getAsn       — read pattern (rkey-direct lookup)
 *
 * Remaining 35 commands (registerPrefix / registerProvider /
 * registerScan / collectGeoip / collectWhois / batchIngestRir / etc.)
 * follow the same pattern and are deferred to follow-up slices —
 * see CLAUDE.md authority-chain hierarchy for the full surface.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  asnDid,
  asnRkey,
  type AsnRecord,
  type AsnView,
  type GetAsnInput,
  type GetAsnOutput,
  type RegisterAsnInput,
  type RegisterAsnOutput,
} from "./types.js";

const ASN_COLLECTION = "com.etzhayyim.apps.ipaddress.asn";

/**
 * Register an ASN. Uses rkey = "asn-{number}" so re-registration with
 * the same ASN number returns alreadyExists (idempotent — same pattern
 * as tsukuru manufacturerRegistry slice 3 rkey=slug).
 */
export async function registerAsn(
  e: Etzhayyim,
  input: RegisterAsnInput
): Promise<RegisterAsnOutput> {
  if (!input.number || input.number <= 0) {
    return {
      status: "rejected",
      error: "invalidAsnNumber",
    };
  }

  const rkey = asnRkey(input.number);

  // Check duplicate via rkey-direct read.
  const existing = await e
    .read<AsnRecord>({ collection: ASN_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      asnUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      number: input.number,
    };
  }

  const did = asnDid(input.number);
  const record: AsnRecord = {
    did,
    number: input.number,
    name: input.name,
    country: input.country,
    rir: input.rir,
    prefixes: input.prefixes,
    abuseEmail: input.abuseEmail,
    abuseTel: input.abuseTel,
    abuseSource: input.abuseSource,
    abuseCollectedAt: input.abuseCollectedAt,
    createdAt: new Date().toISOString(),
  };

  const receipt = await e.write({
    collection: ASN_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });

  return {
    status: "registered",
    asnUri: receipt.uri,
    did,
    number: input.number,
  };
}

/**
 * Look up an ASN by number. rkey-direct read.
 *
 * Vendor's cmdGetAsn did SELECT WHERE number = ? on vertex_ip_asn;
 * we map that to a deterministic-rkey PDS read. No prefix scan
 * needed (number is the natural ID).
 */
export async function getAsn(
  e: Etzhayyim,
  input: GetAsnInput
): Promise<GetAsnOutput> {
  if (!input.number || input.number <= 0) {
    return { error: "invalidAsnNumber" };
  }

  const resp = await e
    .read<AsnRecord>({
      collection: ASN_COLLECTION,
      rkey: asnRkey(input.number),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) {
    return { error: "notFound" };
  }

  const view: AsnView = { ...r.value, asnUri: r.uri };
  return { asn: view };
}
