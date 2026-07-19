import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  registerAsn,
  getAsn,
  registerPrefix,
  getPrefix,
  registerIp,
  getIp,
  listAsns,
  listIps,
} from "../src/index.js";

describe("ipaddress kotoba", () => {
  let e: any;

  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:ipaddress.etzhayyim.com" });
  });

  describe("registerAsn", () => {
    it("registers a new ASN with valid input", async () => {
      const result = await registerAsn(e, {
        number: 64512,
        name: "Test Network",
        country: "JP",
        rir: "apnic",
      });

      expect(result.status).toBe("registered");
      expect(result.asnUri).toBeDefined();
      expect(result.did).toBeDefined();
      expect(result.number).toBe(64512);
    });

    it("rejects ASN with invalid number (zero)", async () => {
      const result = await registerAsn(e, {
        number: 0,
        name: "Invalid",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("invalidAsnNumber");
    });

    it("rejects ASN with negative number", async () => {
      const result = await registerAsn(e, {
        number: -1,
        name: "Invalid",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("invalidAsnNumber");
    });

    it("is idempotent on number", async () => {
      const input = {
        number: 64512,
        name: "Test Network",
        country: "JP",
      };

      const first = await registerAsn(e, input);
      expect(first.status).toBe("registered");
      const firstDid = first.did;

      const second = await registerAsn(e, input);
      expect(second.status).toBe("alreadyExists");
      expect(second.did).toBe(firstDid);
    });

    it("supports optional prefixes array", async () => {
      const result = await registerAsn(e, {
        number: 64513,
        name: "Network 2",
        prefixes: ["192.0.2.0/24", "198.51.100.0/24"],
      });

      expect(result.status).toBe("registered");
      const asn = await getAsn(e, { number: 64513 });
      expect(asn.asn?.prefixes).toEqual([
        "192.0.2.0/24",
        "198.51.100.0/24",
      ]);
    });
  });

  describe("getAsn", () => {
    beforeEach(async () => {
      await registerAsn(e, {
        number: 64512,
        name: "Test Network",
        country: "JP",
        rir: "apnic",
      });
    });

    it("retrieves an existing ASN", async () => {
      const result = await getAsn(e, { number: 64512 });

      expect(result.error).toBeUndefined();
      expect(result.asn).toBeDefined();
      expect(result.asn?.number).toBe(64512);
    });

    it("returns error for non-existent ASN", async () => {
      const result = await getAsn(e, { number: 99999 });

      expect(result.error).toBe("notFound");
      expect(result.asn).toBeUndefined();
    });

    it("returns error for invalid number (zero)", async () => {
      const result = await getAsn(e, { number: 0 });

      expect(result.error).toBe("invalidAsnNumber");
    });
  });

  describe("registerPrefix", () => {
    it("registers a new prefix with valid CIDR", async () => {
      const result = await registerPrefix(e, {
        cidr: "192.0.2.0/24",
        asnNumber: 64512,
        rir: "apnic",
      });

      expect(result.status).toBe("registered");
      expect(result.prefixUri).toBeDefined();
      expect(result.cidr).toBe("192.0.2.0/24");
    });

    it("rejects prefix with missing CIDR", async () => {
      const result = await registerPrefix(e, {
        cidr: "",
        asnNumber: 64512,
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBeDefined();
    });

    it("is idempotent on CIDR", async () => {
      const input = {
        cidr: "192.0.2.0/24",
        asnNumber: 64512,
      };

      const first = await registerPrefix(e, input);
      expect(first.status).toBe("registered");
      const firstUri = first.prefixUri;

      const second = await registerPrefix(e, input);
      expect(second.status).toBe("alreadyExists");
      expect(second.prefixUri).toBe(firstUri);
    });
  });

  describe("getPrefix", () => {
    beforeEach(async () => {
      await registerPrefix(e, {
        cidr: "192.0.2.0/24",
        asnNumber: 64512,
        rir: "apnic",
      });
    });

    it("retrieves an existing prefix", async () => {
      const result = await getPrefix(e, { cidr: "192.0.2.0/24" });

      expect(result.error).toBeUndefined();
      expect(result.prefix).toBeDefined();
      expect(result.prefix?.cidr).toBe("192.0.2.0/24");
    });

    it("returns error for non-existent prefix", async () => {
      const result = await getPrefix(e, { cidr: "203.0.113.0/24" });

      expect(result.error).toBe("notFound");
    });
  });

  describe("registerIp", () => {
    it("registers a new IP address with valid input", async () => {
      const result = await registerIp(e, {
        address: "192.0.2.1",
        family: "ipv4",
        prefixCidr: "192.0.2.0/24",
      });

      expect(result.status).toBe("registered");
      expect(result.ipUri).toBeDefined();
      expect(result.address).toBe("192.0.2.1");
    });

    it("rejects IP with invalid format", async () => {
      const result = await registerIp(e, {
        address: "invalid",
        family: "ipv4",
      });

      expect(result.status).toBe("rejected");
    });

    it("is idempotent on address", async () => {
      const input = {
        address: "192.0.2.1",
        family: "ipv4" as const,
      };

      const first = await registerIp(e, input);
      expect(first.status).toBe("registered");

      const second = await registerIp(e, input);
      expect(second.status).toBe("alreadyExists");
    });
  });

  describe("getIp", () => {
    beforeEach(async () => {
      await registerIp(e, {
        address: "192.0.2.1",
        family: "ipv4",
        prefixCidr: "192.0.2.0/24",
      });
    });

    it("retrieves an existing IP", async () => {
      const result = await getIp(e, { address: "192.0.2.1" });

      expect(result.error).toBeUndefined();
      expect(result.ip).toBeDefined();
      expect(result.ip?.address).toBe("192.0.2.1");
    });

    it("returns error for non-existent IP", async () => {
      const result = await getIp(e, { address: "203.0.113.1" });

      expect(result.error).toBe("notFound");
    });
  });

  describe("listAsns", () => {
    beforeEach(async () => {
      await registerAsn(e, {
        number: 64512,
        name: "Network JP",
        country: "JP",
        rir: "apnic",
      });
      await registerAsn(e, {
        number: 64513,
        name: "Network US",
        country: "US",
        rir: "arin",
      });
      await registerAsn(e, {
        number: 64514,
        name: "Network JP2",
        country: "JP",
        rir: "apnic",
      });
    });

    it("lists all ASNs", async () => {
      const result = await listAsns(e, {});

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("filters by country", async () => {
      const result = await listAsns(e, { country: "JP" });

      expect(result.items.length).toBe(2);
      expect(result.items.every((a) => a.country === "JP")).toBe(true);
    });

    it("filters by RIR", async () => {
      const result = await listAsns(e, { rir: "arin" });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.rir).toBe("arin");
    });

    it("respects limit parameter", async () => {
      const result = await listAsns(e, { limit: 2 });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe("listIps", () => {
    beforeEach(async () => {
      await registerIp(e, {
        address: "192.0.2.1",
        family: "ipv4",
        prefixCidr: "192.0.2.0/24",
        asnNumber: 64512,
      });
      await registerIp(e, {
        address: "192.0.2.2",
        family: "ipv4",
        prefixCidr: "192.0.2.0/24",
        asnNumber: 64512,
      });
      await registerIp(e, {
        address: "2001:db8::1",
        family: "ipv6",
        prefixCidr: "2001:db8::/32",
        asnNumber: 64513,
      });
    });

    it("lists all IPs", async () => {
      const result = await listIps(e, {});

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("filters by family (ipv4)", async () => {
      const result = await listIps(e, { family: "ipv4" });

      expect(result.items.length).toBe(2);
      expect(result.items.every((ip) => ip.family === "ipv4")).toBe(true);
    });

    it("filters by family (ipv6)", async () => {
      const result = await listIps(e, { family: "ipv6" });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.family).toBe("ipv6");
    });

    it("filters by ASN number", async () => {
      const result = await listIps(e, { asnNumber: 64512 });

      expect(result.items.length).toBe(2);
      expect(result.items.every((ip) => ip.asnNumber === 64512)).toBe(true);
    });

    it("respects limit parameter", async () => {
      const result = await listIps(e, { limit: 2 });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });
});
