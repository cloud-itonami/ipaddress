/**
 * ipaddress kotoba — collect tier (slice 8, +3 → 22/37).
 *
 *   collectGeoip      — external geoip → registerIp({...,geo*}) + Scan record
 *   collectWhois      — external whois → registerAsn({...,abuse*}) + Scan record
 *   batchIngestRir    — RIR delegated file → bulk registerAsn + registerPrefix
 *
 * Orchestration helpers — they take already-fetched external payloads
 * (collected server-side in the LangServer pod per ADR-2605111200) and
 * persist via the existing static-registry writers. A Scan record per
 * collect provides provenance + retry idempotency (scan rkey-direct dedup).
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import { registerAsn } from "./asnRegistry.js";
import { registerIp } from "./ipRegistry.js";
import { registerPrefix } from "./prefixRegistry.js";
import { registerScan } from "./scanRegistry.js";
import {
  type BatchIngestRirInput,
  type BatchIngestRirOutput,
  type CollectGeoipInput,
  type CollectGeoipOutput,
  type CollectWhoisInput,
  type CollectWhoisOutput,
} from "./types.js";

export async function collectGeoip(
  e: Etzhayyim,
  input: CollectGeoipInput
): Promise<CollectGeoipOutput> {
  if (!input.address || !input.payload) {
    return { error: "missingRequiredFields" };
  }
  const p = input.payload;
  const ipRes = await registerIp(e, {
    address: input.address,
    countryIso3: p.countryIso3,
    geoCity: p.geoCity,
    geoRegion: p.geoRegion,
    geoLatPermille: p.geoLatPermille,
    geoLonPermille: p.geoLonPermille,
    geoSource: input.source,
    geoCollectedAt: new Date().toISOString(),
  } as Parameters<typeof registerIp>[1]);

  const scanId =
    input.scanId ?? `geoip-${input.address}-${Date.now().toString(36)}`;
  const scanRes = await registerScan(e, {
    scanId,
    target: input.address,
    kind: "geoip",
    status: ipRes.status === "rejected" ? "failed" : "ok",
    scannedAt: new Date().toISOString(),
    sourceUrl: input.source,
    findings: p.geoCity ? [`city=${p.geoCity}`] : undefined,
    rawResult: input.rawResult,
  });

  return {
    address: input.address,
    ipUri: ipRes.ipUri,
    scanUri: scanRes.scanUri,
    status: ipRes.status,
  };
}

export async function collectWhois(
  e: Etzhayyim,
  input: CollectWhoisInput
): Promise<CollectWhoisOutput> {
  if (typeof input.asnNumber !== "number" || !input.payload) {
    return { error: "missingRequiredFields" };
  }
  const p = input.payload;
  const asnRes = await registerAsn(e, {
    number: input.asnNumber,
    name: p.name,
    country: p.country,
    rir: p.rir,
    prefixes: p.prefixes,
    abuseEmail: p.abuseEmail,
    abuseTel: p.abuseTel,
    abuseSource: input.source,
    abuseCollectedAt: new Date().toISOString(),
  } as Parameters<typeof registerAsn>[1]);

  const scanId =
    input.scanId ?? `whois-asn-${input.asnNumber}-${Date.now().toString(36)}`;
  const scanRes = await registerScan(e, {
    scanId,
    target: `asn-${input.asnNumber}`,
    kind: "whois",
    status: asnRes.status === "rejected" ? "failed" : "ok",
    scannedAt: new Date().toISOString(),
    sourceUrl: input.source,
    findings: p.abuseEmail ? [`abuse=${p.abuseEmail}`] : undefined,
    rawResult: input.rawResult,
  });

  return {
    asnNumber: input.asnNumber,
    asnUri: asnRes.asnUri,
    scanUri: scanRes.scanUri,
    status: asnRes.status,
  };
}

export async function batchIngestRir(
  e: Etzhayyim,
  input: BatchIngestRirInput
): Promise<BatchIngestRirOutput> {
  if (!input.rir || !input.entries || input.entries.length === 0) {
    return { error: "missingRequiredFields" };
  }
  const asnInserted: number[] = [];
  const prefixInserted: string[] = [];
  const failed: { kind: string; key: string; reason: string }[] = [];

  for (const entry of input.entries) {
    if (entry.kind === "asn" && typeof entry.asnNumber === "number") {
      const r = await registerAsn(e, {
        number: entry.asnNumber,
        country: entry.country,
        rir: input.rir,
      });
      if (r.status === "registered") asnInserted.push(entry.asnNumber);
      else if (r.status === "rejected") {
        failed.push({
          kind: "asn",
          key: String(entry.asnNumber),
          reason: r.error ?? "unknown",
        });
      }
    } else if (entry.kind === "prefix" && entry.cidr) {
      const r = await registerPrefix(e, {
        cidr: entry.cidr,
        rir: input.rir,
        countryIso3: entry.country,
      });
      if (r.status === "registered") prefixInserted.push(entry.cidr);
      else if (r.status === "rejected") {
        failed.push({
          kind: "prefix",
          key: entry.cidr,
          reason: r.error ?? "unknown",
        });
      }
    }
  }

  return {
    rir: input.rir,
    asnInserted: asnInserted.length,
    prefixInserted: prefixInserted.length,
    failed,
  };
}
