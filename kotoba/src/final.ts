/**
 * ipaddress kotoba — final tier (slice 12, +4 → 37/37, 100%).
 *
 *   listRirs                — RIR registry paginator
 *   listNirs                — NIR registry paginator
 *   getNir                  — rkey-direct read
 *   getPrefixContainingIp   — find the most-specific Prefix CIDR that
 *                             contains a given IPv4 / IPv6 address
 *
 * Slice 12 closes ipaddress kotoba Option B reference impl at 37/37.
 *
 * getPrefixContainingIp does CIDR membership in-process (longest-prefix
 * match across PREFIX_COLLECTION up to maxScan). Phase 3 mst-projector
 * adds an indexed prefix tree (radix / patricia) for O(log N) lookup;
 * the in-process scan here is honest about that cost via truncated:
 * boolean response.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  type GetNirInput,
  type GetNirOutput,
  type GetPrefixContainingIpInput,
  type GetPrefixContainingIpOutput,
  type ListNirsInput,
  type ListNirsOutput,
  type ListRirsInput,
  type ListRirsOutput,
  type NirRecord,
  type PrefixRecord,
  type RirRecord,
} from "./types.js";

const RIR_COLLECTION = "com.etzhayyim.apps.ipaddress.rir";
const NIR_COLLECTION = "com.etzhayyim.apps.ipaddress.nir";
const PREFIX_COLLECTION = "com.etzhayyim.apps.ipaddress.prefix";

const DEFAULT_MAX_SCAN = 5000;
const PAGE_LIMIT = 100;

function nirRkey(slug: string): string {
  return `nir-${slug.toLowerCase()}`;
}

// ─── List paginators ────────────────────────────────────────────────

export async function listRirs(
  e: Etzhayyim,
  input: ListRirsInput = {}
): Promise<ListRirsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<RirRecord>({
    collection: RIR_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  return {
    items: resp.records.map((r) => ({ ...r.value, rirUri: r.uri })),
    cursor: resp.cursor,
    total: resp.records.length,
  };
}

export async function listNirs(
  e: Etzhayyim,
  input: ListNirsInput = {}
): Promise<ListNirsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<NirRecord>({
    collection: NIR_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items = resp.records
    .filter((r) => {
      if (input.parentRir && r.value.parentRir !== input.parentRir) {
        return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, nirUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function getNir(
  e: Etzhayyim,
  input: GetNirInput
): Promise<GetNirOutput> {
  if (!input.slug) return { error: "missingSlug" };
  const resp = await e
    .read<NirRecord>({
      collection: NIR_COLLECTION,
      rkey: nirRkey(input.slug),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { nirRecord: { ...r.value, nirUri: r.uri } };
}

// ─── CIDR membership ────────────────────────────────────────────────

function ipv4ToInt(addr: string): bigint | undefined {
  const parts = addr.split(".");
  if (parts.length !== 4) return undefined;
  let n = 0n;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return undefined;
    n = (n << 8n) | BigInt(o);
  }
  return n;
}

function ipv6ToBigInt(addr: string): bigint | undefined {
  const parts = addr.toLowerCase().split("::");
  if (parts.length > 2) return undefined;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts[1] ? parts[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 && parts.length === 2) return undefined;
  const all =
    parts.length === 2
      ? [...head, ...Array(missing).fill("0"), ...tail]
      : head.length === 8
        ? head
        : undefined;
  if (!all || all.length !== 8) return undefined;
  let n = 0n;
  for (const g of all) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return undefined;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

function contains(cidr: string, address: string): number | undefined {
  const [net, prefixStr] = cidr.split("/");
  if (!net || !prefixStr) return undefined;
  const prefixLen = Number(prefixStr);
  if (!Number.isInteger(prefixLen)) return undefined;
  const isV6 = net.includes(":");
  if (isV6 !== address.includes(":")) return undefined;
  const width = isV6 ? 128 : 32;
  if (prefixLen < 0 || prefixLen > width) return undefined;
  const netN = isV6 ? ipv6ToBigInt(net) : ipv4ToInt(net);
  const addrN = isV6 ? ipv6ToBigInt(address) : ipv4ToInt(address);
  if (netN === undefined || addrN === undefined) return undefined;
  const shift = BigInt(width - prefixLen);
  if (shift < 0n) return undefined;
  if (netN >> shift === addrN >> shift) return prefixLen;
  return undefined;
}

export async function getPrefixContainingIp(
  e: Etzhayyim,
  input: GetPrefixContainingIpInput
): Promise<GetPrefixContainingIpOutput> {
  if (!input.address) return { error: "missingAddress" };
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  let cursor: string | undefined;
  let scanned = 0;
  let best: { prefix: PrefixRecord; uri: string; len: number } | undefined;
  while (scanned < maxScan) {
    const page = await e.read<PrefixRecord>({
      collection: PREFIX_COLLECTION,
      cursor,
      limit: PAGE_LIMIT,
    });
    for (const r of page.records) {
      const len = contains(r.value.cidr, input.address);
      if (len !== undefined) {
        if (!best || len > best.len) {
          best = { prefix: r.value, uri: r.uri, len };
        }
      }
    }
    scanned += page.records.length;
    if (!page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  if (!best) {
    return { address: input.address, truncated: scanned >= maxScan };
  }
  return {
    address: input.address,
    prefix: { ...best.prefix, prefixUri: best.uri },
    truncated: scanned >= maxScan,
  };
}
