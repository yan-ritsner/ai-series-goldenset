import { describe, it, expect } from "vitest";
import { dedupeExact } from "../dedupe.js";
import type { Interaction } from "../../types.js";

describe("dedupeExact", () => {
  it("dedupes same input text differing by whitespace/case", () => {
    const interactions: Interaction[] = [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "How do I do X?" },
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "  how do i do x?  " }, // Different whitespace/case
      },
      {
        interactionId: "3",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "HOW DO I DO X?" }, // Different case
      },
    ];

    const deduped = dedupeExact(interactions);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].interactionId).toBe("1"); // First wins
  });

  it("keeps different input text", () => {
    const interactions: Interaction[] = [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "How do I do X?" },
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "What is Y?" },
      },
    ];

    const deduped = dedupeExact(interactions);
    expect(deduped).toHaveLength(2);
  });

  it("ensures stable first wins order", () => {
    const interactions: Interaction[] = [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test" },
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test" },
      },
      {
        interactionId: "3",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "test" },
      },
    ];

    const deduped = dedupeExact(interactions);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].interactionId).toBe("1");
  });
});
