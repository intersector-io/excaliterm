import { describe, it, expect } from "vitest";
import { findNewHostServiceId, getHostServiceIds } from "@/lib/host-services";

describe("host-services", () => {
  it("captures existing host ids for the mobile reveal baseline", () => {
    const services = [{ id: "svc-1" }, { id: "svc-2" }];

    expect(getHostServiceIds(services)).toEqual(new Set(["svc-1", "svc-2"]));
  });

  it("finds the next host service that appeared after the baseline", () => {
    const services = [{ id: "svc-1" }, { id: "svc-2" }];

    expect(findNewHostServiceId(services, new Set(["svc-1"]))).toBe("svc-2");
  });

  it("returns null when no new host service appeared", () => {
    const services = [{ id: "svc-1" }];

    expect(findNewHostServiceId(services, new Set(["svc-1"]))).toBeNull();
  });
});
