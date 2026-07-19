/**
 * ipaddress kotoba — scan tier (slice 4, +3 → 11/37).
 *
 *   registerScan  — observation snapshot write (port-scan / whois-refresh /
 *                   geoip-refresh / vuln-scan / etc.)
 *   getScan       — rkey-direct read
 *   listScans     — cursor + target/kind/status filter
 *
 * A scan is a TIME-STAMPED snapshot of an IP/prefix/ASN's state.
 * Unlike the static asn/prefix/provider/ip registries above, scans are
 * append-only observation records — each scan gets its own rkey so the
 * same target can be re-scanned without overwriting prior observations.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  IPADDRESS_DID_PREFIX,
  type GetScanInput,
  type GetScanOutput,
  type ListScansInput,
  type ListScansOutput,
  type RegisterScanInput,
  type RegisterScanOutput,
  type ScanRecord,
  type ScanView,
} from "./types.js";

const SCAN_COLLECTION = "com.etzhayyim.apps.ipaddress.scan";

function scanRkey(scanId: string): string {
  return `scan-${scanId.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

function scanDid(scanId: string): string {
  return `${IPADDRESS_DID_PREFIX}scan:${scanId.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

export async function registerScan(
  e: Etzhayyim,
  input: RegisterScanInput
): Promise<RegisterScanOutput> {
  if (!input.scanId || !input.target || !input.kind) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = scanRkey(input.scanId);
  const existing = await e
    .read<ScanRecord>({ collection: SCAN_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      scanUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      scanId: input.scanId,
    };
  }
  const did = scanDid(input.scanId);
  const record: ScanRecord = {
    did,
    scanId: input.scanId,
    target: input.target,
    kind: input.kind,
    status: input.status ?? "ok",
    scannedAt: input.scannedAt ?? new Date().toISOString(),
    durationMs: input.durationMs,
    findings: input.findings,
    rawResult: input.rawResult,
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: SCAN_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    scanUri: receipt.uri,
    did,
    scanId: input.scanId,
  };
}

export async function getScan(
  e: Etzhayyim,
  input: GetScanInput
): Promise<GetScanOutput> {
  if (!input.scanId) return { error: "missingScanId" };
  const resp = await e
    .read<ScanRecord>({
      collection: SCAN_COLLECTION,
      rkey: scanRkey(input.scanId),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: ScanView = { ...r.value, scanUri: r.uri };
  return { scan: view };
}

export async function listScans(
  e: Etzhayyim,
  input: ListScansInput = {}
): Promise<ListScansOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<ScanRecord>({
    collection: SCAN_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: ScanView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.target && v.target !== input.target) return false;
      if (input.kind && v.kind !== input.kind) return false;
      if (input.status && v.status !== input.status) return false;
      if (input.since && (!v.scannedAt || v.scannedAt < input.since)) {
        return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, scanUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
