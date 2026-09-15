import { describe, expect, it } from "vitest";
import { RouteIqMockClient } from "../src/harness/mockClient";
import { defaultRouteInput } from "../src/harness/fixtures";

describe("RouteIqMockClient (Harness)", () => {
  it("returns expressway recommended scenario by default", async () => {
    const client = new RouteIqMockClient({ latencyMs: 0 });
    const result = await client.analyzeRoute(defaultRouteInput);

    expect(result.routeComparison).toBeDefined();
    expect(result.routeComparison?.recommendedRoute).toBe("expressway");
    expect(result.input.origin).toBe(defaultRouteInput.origin);
  });

  it("returns local recommended scenario when switched", async () => {
    const client = new RouteIqMockClient({ latencyMs: 0 });
    client.setScenario("local_recommended");
    const result = await client.analyzeRoute(defaultRouteInput);

    expect(result.routeComparison?.recommendedRoute).toBe("local");
  });

  it("returns toll unavailable scenario with null total cost", async () => {
    const client = new RouteIqMockClient({ latencyMs: 0 });
    client.setScenario("toll_unavailable");
    const result = await client.analyzeRoute(defaultRouteInput);

    expect(result.routeComparison?.expresswayRoute.tollConfidence).toBe("unavailable");
    expect(result.routeComparison?.expresswayRoute.totalCostYen).toBeNull();
  });

  it("throws error when simulating network failure scenario", async () => {
    const client = new RouteIqMockClient({ latencyMs: 0 });
    client.setScenario("network_error");

    await expect(client.analyzeRoute(defaultRouteInput)).rejects.toThrow("ネットワークエラー");
  });
});
