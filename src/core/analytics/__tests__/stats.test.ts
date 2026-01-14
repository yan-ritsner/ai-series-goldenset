import { describe, it, expect } from "vitest";
import { computeStats } from "../stats.js";
import type { Interaction } from "../../types.js";

describe("computeStats", () => {
  it("counts totals", () => {
    const interactions: Interaction[] = [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test" },
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test2" },
      },
    ];

    const stats = computeStats(interactions);
    expect(stats.total).toBe(2);
  });

  it("counts __missing__ when dimension absent", () => {
    const interactions: Interaction[] = [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test" },
        dimensions: { intent: "policy" },
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test2" },
        // No dimensions
      },
    ];

    const stats = computeStats(interactions, ["intent"]);
    expect(stats.byDimension.intent["__missing__"]).toBe(1);
    expect(stats.byDimension.intent["policy"]).toBe(1);
  });

  it("tag counts aggregated correctly", () => {
    const interactions: Interaction[] = [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test" },
        tags: ["tag1", "tag2"],
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test2" },
        tags: ["tag1"],
      },
    ];

    const stats = computeStats(interactions);
    expect(stats.tagCounts["tag1"]).toBe(2);
    expect(stats.tagCounts["tag2"]).toBe(1);
  });

  it("dimensionKeys filter works", () => {
    const interactions: Interaction[] = [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test" },
        dimensions: { intent: "policy", department: "eng", extra: "value" },
      },
    ];

    const stats = computeStats(interactions, ["intent", "department"]);
    expect(stats.byDimension.intent).toBeDefined();
    expect(stats.byDimension.department).toBeDefined();
    expect(stats.byDimension.extra).toBeUndefined();
  });
});
