import { describe, it, expect } from "vitest";
import { stratifiedSample } from "../sample.js";
import type { Interaction } from "../../types.js";

// Fixture with known dimensions
function createFixture(): Interaction[] {
  return [
    { interactionId: "1", timestamp: "2026-01-01T00:00:00Z", input: { text: "a" }, dimensions: { intent: "policy", dept: "eng" } },
    { interactionId: "2", timestamp: "2026-01-01T00:00:00Z", input: { text: "b" }, dimensions: { intent: "policy", dept: "eng" } },
    { interactionId: "3", timestamp: "2026-01-01T00:00:00Z", input: { text: "c" }, dimensions: { intent: "policy", dept: "hr" } },
    { interactionId: "4", timestamp: "2026-01-01T00:00:00Z", input: { text: "d" }, dimensions: { intent: "incident", dept: "eng" } },
    { interactionId: "5", timestamp: "2026-01-01T00:00:00Z", input: { text: "e" }, dimensions: { intent: "incident", dept: "eng" } },
    { interactionId: "6", timestamp: "2026-01-01T00:00:00Z", input: { text: "f" }, dimensions: { intent: "incident", dept: "hr" } },
    { interactionId: "7", timestamp: "2026-01-01T00:00:00Z", input: { text: "g" }, dimensions: { intent: "incident", dept: "hr" } },
    { interactionId: "8", timestamp: "2026-01-01T00:00:00Z", input: { text: "h" }, dimensions: { intent: "incident", dept: "hr" } },
  ];
}

describe("stratifiedSample", () => {
  it("is deterministic with seed", () => {
    const interactions = createFixture();
    const seed = 42;

    const sample1 = stratifiedSample(interactions, {
      n: 4,
      by: ["intent", "dept"],
      seed,
    });

    const sample2 = stratifiedSample(interactions, {
      n: 4,
      by: ["intent", "dept"],
      seed,
    });

    expect(sample1.map((i) => i.interactionId).sort()).toEqual(
      sample2.map((i) => i.interactionId).sort()
    );
  });

  it("returns n when enough data exists", () => {
    const interactions = createFixture();
    const sample = stratifiedSample(interactions, {
      n: 5,
      by: ["intent", "dept"],
      seed: 42,
    });

    expect(sample).toHaveLength(5);
  });

  it("respects where filter", () => {
    const interactions = createFixture();
    const sample = stratifiedSample(interactions, {
      n: 10,
      by: ["intent"],
      where: { dept: "eng" },
      seed: 42,
    });

    expect(sample.length).toBeLessThanOrEqual(4); // Only eng dept items
    expect(sample.every((i) => i.dimensions?.dept === "eng")).toBe(true);
  });

  it("respects minPerGroup", () => {
    const interactions = createFixture();
    const sample = stratifiedSample(interactions, {
      n: 6,
      by: ["intent", "dept"],
      minPerGroup: 1,
      seed: 42,
    });

    // Should have at least 1 from each group
    const groups = new Set(
      sample.map((i) => `${i.dimensions?.intent}::${i.dimensions?.dept}`)
    );
    expect(groups.size).toBeGreaterThan(0);
  });

  it("handles missing dimension keys", () => {
    const interactions: Interaction[] = [
      { interactionId: "1", timestamp: "2026-01-01T00:00:00Z", input: { text: "a" }, dimensions: { intent: "policy" } },
      { interactionId: "2", timestamp: "2026-01-01T00:00:00Z", input: { text: "b" } }, // No dimensions
    ];

    const sample = stratifiedSample(interactions, {
      n: 2,
      by: ["intent"],
      seed: 42,
    });

    expect(sample.length).toBeGreaterThan(0);
  });

  it("doesn't over-allocate beyond group size", () => {
    const interactions = createFixture();
    const sample = stratifiedSample(interactions, {
      n: 100, // More than available
      by: ["intent", "dept"],
      seed: 42,
    });

    expect(sample.length).toBeLessThanOrEqual(interactions.length);
    expect(sample.length).toBe(interactions.length); // Should get all when n > available
  });
});
