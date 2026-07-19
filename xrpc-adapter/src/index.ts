/**
 * ipaddress XRPC adapter — CF Worker.
 *
 * Wires the kotoba reference impl (37 pure TS functions across 12 tiers)
 * into a deployable CF Worker that exposes each function as an XRPC endpoint
 * at https://ipaddress.etzhayyim.com/xrpc/com.etzhayyim.apps.ipaddress.<cmd>
 *
 * Per ADR-2605210000 first execution-layer demonstration. Instantiates the
 * Etzhayyim SDK from env bindings (PDS_URL + session), calls the kotoba
 * function with parsed input, returns the result as JSON, and maps status
 * codes to HTTP responses.
 *
 * Single-file principle: all routing and handler logic here.
 */

import { createAuthedEtzhayyim, extractBearerToken } from "@etzhayyim/sdk-auth";
import * as ipaddressRwFree from "@etzhayyim/ipaddress-kotoba";

interface Env {
  ACTOR_DID: string;
  PDS_URL: string;
  L2_RPC_URL: string;
  PDS_ACCESS_JWT?: string;
  PDS_REFRESH_JWT?: string;
}

type Handler = (e: Etzhayyim, input: unknown) => Promise<unknown>;

const NSID_BASE = "com.etzhayyim.apps.ipaddress";

interface RouteConfig {
  method: "POST" | "GET";
  handler: Handler;
}

const routes: Record<string, RouteConfig> = {
  // ASN Registry tier (2 commands)
  [`${NSID_BASE}.registerAsn`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerAsn(e, input as any),
  },
  [`${NSID_BASE}.getAsn`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getAsn(e, input as any),
  },

  // Prefix Registry tier (2 commands)
  [`${NSID_BASE}.registerPrefix`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerPrefix(e, input as any),
  },
  [`${NSID_BASE}.getPrefix`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getPrefix(e, input as any),
  },

  // Provider Registry tier (2 commands)
  [`${NSID_BASE}.registerProvider`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerProvider(e, input as any),
  },
  [`${NSID_BASE}.getProvider`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getProvider(e, input as any),
  },

  // IP Registry tier (2 commands)
  [`${NSID_BASE}.registerIp`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerIp(e, input as any),
  },
  [`${NSID_BASE}.getIp`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getIp(e, input as any),
  },

  // Scan Registry tier (3 commands)
  [`${NSID_BASE}.registerScan`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerScan(e, input as any),
  },
  [`${NSID_BASE}.getScan`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getScan(e, input as any),
  },
  [`${NSID_BASE}.listScans`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listScans(e, input as any),
  },

  // Search tier (3 commands)
  [`${NSID_BASE}.searchProviders`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.searchProviders(e, input as any),
  },
  [`${NSID_BASE}.listProviders`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listProviders(e, input as any),
  },
  [`${NSID_BASE}.listPrefixes`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listPrefixes(e, input as any),
  },

  // Topology tier (3 commands)
  [`${NSID_BASE}.getDelegationChain`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getDelegationChain(e, input as any),
  },
  [`${NSID_BASE}.getIpTopology`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getIpTopology(e, input as any),
  },
  [`${NSID_BASE}.getPeering`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getPeering(e, input as any),
  },

  // Geo/Abuse tier (2 commands)
  [`${NSID_BASE}.getGeolocation`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getGeolocation(e, input as any),
  },
  [`${NSID_BASE}.getAbuseContact`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getAbuseContact(e, input as any),
  },

  // Collect tier (3 commands)
  [`${NSID_BASE}.collectGeoip`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.collectGeoip(e, input as any),
  },
  [`${NSID_BASE}.collectWhois`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.collectWhois(e, input as any),
  },
  [`${NSID_BASE}.batchIngestRir`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.batchIngestRir(e, input as any),
  },

  // List tier (3 commands)
  [`${NSID_BASE}.listAsns`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listAsns(e, input as any),
  },
  [`${NSID_BASE}.listIps`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listIps(e, input as any),
  },
  [`${NSID_BASE}.batchRegisterIp`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.batchRegisterIp(e, input as any),
  },

  // Analyze tier (3 commands)
  [`${NSID_BASE}.analyzeIp`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.analyzeIp(e, input as any),
  },
  [`${NSID_BASE}.analyzeAsn`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.analyzeAsn(e, input as any),
  },
  [`${NSID_BASE}.analyzePrefix`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.analyzePrefix(e, input as any),
  },

  // Peering/RIR Registry tier (5 commands)
  [`${NSID_BASE}.registerPeering`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerPeering(e, input as any),
  },
  [`${NSID_BASE}.listPeering`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listPeering(e, input as any),
  },
  [`${NSID_BASE}.registerRir`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerRir(e, input as any),
  },
  [`${NSID_BASE}.registerNir`]: {
    method: "POST",
    handler: (e, input) => ipaddressRwFree.registerNir(e, input as any),
  },
  [`${NSID_BASE}.getRir`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getRir(e, input as any),
  },

  // Final tier (4 commands)
  [`${NSID_BASE}.listRirs`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listRirs(e, input as any),
  },
  [`${NSID_BASE}.listNirs`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.listNirs(e, input as any),
  },
  [`${NSID_BASE}.getNir`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getNir(e, input as any),
  },
  [`${NSID_BASE}.getPrefixContainingIp`]: {
    method: "GET",
    handler: (e, input) => ipaddressRwFree.getPrefixContainingIp(e, input as any),
  },
};

/**
 * Maps result.status to HTTP status code.
 *   - rejected / invalidIsin / invalidChecksum / invalidLei / invalidGtin / missingRequiredFields / invalidPaperId → 400
 *   - notFound / paperNotFound / itemNotFound / accountNotFound / asnNotFound / prefixNotFound / certificateNotFound / fermentNotFound / requestNotFound / artifactNotFound / vulnMatchNotFound / absorbNotFound → 404
 *   - alreadyExists / alreadyProcessed / alreadyReleased / alreadyAnchored → 200 (idempotent)
 *   - other / default → 200
 *   - exception → 500
 */
function mapStatus(status?: string): number {
  if (
    status === "rejected" ||
    status === "invalidIsin" ||
    status === "invalidChecksum" ||
    status === "invalidLei" ||
    status === "invalidGtin" ||
    status === "missingRequiredFields" ||
    status === "invalidPaperId"
  ) {
    return 400;
  }
  if (
    status === "notFound" ||
    status === "paperNotFound" ||
    status === "itemNotFound" ||
    status === "accountNotFound" ||
    status === "asnNotFound" ||
    status === "prefixNotFound" ||
    status === "certificateNotFound" ||
    status === "fermentNotFound" ||
    status === "requestNotFound" ||
    status === "artifactNotFound" ||
    status === "vulnMatchNotFound" ||
    status === "absorbNotFound"
  ) {
    return 404;
  }
  if (
    status === "alreadyExists" ||
    status === "alreadyProcessed" ||
    status === "alreadyReleased" ||
    status === "alreadyAnchored"
  ) {
    return 200;
  }
  return 200;
}

function jsonResponse(
  body: unknown,
  status: number = 200,
  init?: ResponseInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Only handle /xrpc/* paths
    if (!url.pathname.startsWith("/xrpc/")) {
      return jsonResponse({ error: "NotFound" }, 404);
    }

    const nsid = url.pathname.slice("/xrpc/".length);
    const route = routes[nsid];

    if (!route) {
      return jsonResponse({ error: "MethodNotFound", nsid }, 404);
    }

    if (req.method !== route.method) {
      return jsonResponse({ error: "MethodNotAllowed" }, 405);
    }

    // Instantiate Etzhayyim SDK with auth
    const bearerToken = extractBearerToken(req);
    const e = createAuthedEtzhayyim({ env, bearerToken });

    // Parse input based on method
    let input: unknown;
    try {
      if (route.method === "POST") {
        input = await req.json().catch(() => ({}));
      } else {
        // GET: parse query params
        input = Object.fromEntries(url.searchParams.entries());
        // Coerce common numeric/boolean fields
        const typed = input as Record<string, unknown>;
        const numericFields = [
          "limit",
          "offset",
          "maxScan",
          "amountMinor",
          "seq",
          "depth",
          "recentScans",
          "asnNumber",
          "scorePermille",
          "capacityFactorPermille",
          "voltageV",
          "primaryVoltageKv",
          "secondaryVoltageKv",
          "capacityMva",
          "capacityKw",
          "customerCount",
          "lengthM",
          "kwhCumulative",
          "kwDemand",
          "targetReductionKw",
          "actualReductionKw",
          "outputKw",
          "articleCount",
          "snapshotCount",
          "ruleSeq",
          "readingSeq",
          "outputSeq",
          "deviationPercentPermille",
          "affectedCustomers",
          "confidencePermille",
        ];
        numericFields.forEach((field) => {
          if (typed[field]) {
            typed[field] = Number(typed[field]);
          }
        });
        const booleanFields = [
          "includeBalance",
          "publicNoticeOnly",
          "publicDomainOnly",
          "released",
        ];
        booleanFields.forEach((field) => {
          if (typed[field]) {
            typed[field] = typed[field] === "true";
          }
        });
      }
    } catch (err) {
      return jsonResponse(
        {
          error: "InvalidInput",
          message: `Failed to parse ${route.method === "POST" ? "JSON" : "query params"}`,
        },
        400
      );
    }

    // Call handler
    try {
      const result = await route.handler(e, input);
      const status = mapStatus(
        (result as Record<string, unknown>)?.status as string | undefined
      );
      return jsonResponse(result, status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse(
        {
          error: "InternalError",
          message,
          nsid,
        },
        500
      );
    }
  },
} satisfies ExportedHandler<Env>;
