import { describe, it, expect } from "vitest";
import { diffDatasets } from "../diff.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("diffDatasets", () => {
  let tempDir: string;
  let datasetsDir: string;

  beforeEach(async () => {
    const dirPath = join(tmpdir(), `goldenset-diff-test-${Date.now()}`);
    await mkdir(dirPath, { recursive: true });
    tempDir = dirPath;
    datasetsDir = join(tempDir, "datasets");
    await mkdir(datasetsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function createVersion(
    versionName: string,
    interactions: Array<{
      interactionId: string;
      timestamp: string;
      input: { text: string };
      dimensions?: Record<string, string>;
      tags?: string[];
    }>,
    labels: Array<{
      interactionId: string;
      reviewedAt: string;
      reviewer: string;
      verdict: "pass" | "fail" | "needs_clarification";
    }> = []
  ): Promise<void> {
    const versionDir = join(datasetsDir, versionName);
    await mkdir(versionDir, { recursive: true });

    const interactionsJsonl = interactions
      .map((i) => JSON.stringify(i))
      .join("\n");
    await writeFile(join(versionDir, "interactions.jsonl"), interactionsJsonl);

    if (labels.length > 0) {
      const labelsJsonl = labels.map((l) => JSON.stringify(l)).join("\n");
      await writeFile(join(versionDir, "labels.jsonl"), labelsJsonl);
    }
  }

  it("computes interaction diff correctly", async () => {
    await createVersion("v1", [
      { interactionId: "1", timestamp: "2026-01-01T00:00:00Z", input: { text: "a" } },
      { interactionId: "2", timestamp: "2026-01-01T00:00:00Z", input: { text: "b" } },
      { interactionId: "3", timestamp: "2026-01-01T00:00:00Z", input: { text: "c" } },
    ]);

    await createVersion("v2", [
      { interactionId: "2", timestamp: "2026-01-01T00:00:00Z", input: { text: "b" } },
      { interactionId: "3", timestamp: "2026-01-01T00:00:00Z", input: { text: "c" } },
      { interactionId: "4", timestamp: "2026-01-01T00:00:00Z", input: { text: "d" } },
    ]);

    const diff = await diffDatasets({
      fromVersion: "v1",
      toVersion: "v2",
      datasetsDir,
    });

    expect(diff.interactions.added).toEqual(["4"]);
    expect(diff.interactions.removed).toEqual(["1"]);
    expect(diff.interactions.unchanged).toEqual(["2", "3"]);
  });

  it("computes dimension diff correctly", async () => {
    await createVersion("v1", [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "a" },
        dimensions: { intent: "how_to", dept: "eng" },
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "b" },
        dimensions: { intent: "how_to" },
      },
    ]);

    await createVersion("v2", [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "a" },
        dimensions: { intent: "how_to", dept: "eng" },
      },
      {
        interactionId: "3",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "c" },
        dimensions: { intent: "troubleshooting" },
      },
    ]);

    const diff = await diffDatasets({
      fromVersion: "v1",
      toVersion: "v2",
      datasetsDir,
    });

    expect(diff.dimensions.intent).toBeDefined();
    expect(diff.dimensions.intent["how_to"]).toEqual({ from: 2, to: 1, delta: -1 });
    expect(diff.dimensions.intent["troubleshooting"]).toEqual({
      from: 0,
      to: 1,
      delta: 1,
    });
  });

  it("computes tag diff correctly", async () => {
    await createVersion("v1", [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "a" },
        tags: ["security", "billing"],
      },
      {
        interactionId: "2",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "b" },
        tags: ["security"],
      },
    ]);

    await createVersion("v2", [
      {
        interactionId: "1",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "a" },
        tags: ["security", "billing"],
      },
      {
        interactionId: "3",
        timestamp: "2026-01-01T00:00:00Z",
        input: { text: "c" },
        tags: ["security", "urgent"],
      },
    ]);

    const diff = await diffDatasets({
      fromVersion: "v1",
      toVersion: "v2",
      datasetsDir,
    });

    expect(diff.tags["security"]).toEqual({ from: 2, to: 2, delta: 0 });
    expect(diff.tags["billing"]).toEqual({ from: 1, to: 1, delta: 0 });
    expect(diff.tags["urgent"]).toEqual({ from: 0, to: 1, delta: 1 });
  });

  it("computes label diff correctly", async () => {
    await createVersion(
      "v1",
      [
        { interactionId: "1", timestamp: "2026-01-01T00:00:00Z", input: { text: "a" } },
        { interactionId: "2", timestamp: "2026-01-01T00:00:00Z", input: { text: "b" } },
      ],
      [
        {
          interactionId: "1",
          reviewedAt: "2026-01-01T00:00:00Z",
          reviewer: "alice",
          verdict: "pass",
        },
        {
          interactionId: "2",
          reviewedAt: "2026-01-01T00:00:00Z",
          reviewer: "bob",
          verdict: "fail",
        },
      ]
    );

    await createVersion(
      "v2",
      [
        { interactionId: "1", timestamp: "2026-01-01T00:00:00Z", input: { text: "a" } },
        { interactionId: "3", timestamp: "2026-01-01T00:00:00Z", input: { text: "c" } },
      ],
      [
        {
          interactionId: "1",
          reviewedAt: "2026-01-01T00:00:00Z",
          reviewer: "alice",
          verdict: "fail", // Changed from pass
        },
        {
          interactionId: "3",
          reviewedAt: "2026-01-01T00:00:00Z",
          reviewer: "charlie",
          verdict: "pass", // New label
        },
      ]
    );

    const diff = await diffDatasets({
      fromVersion: "v1",
      toVersion: "v2",
      datasetsDir,
    });

    expect(diff.labels.added).toBe(1); // Label for interaction 3
    expect(diff.labels.removed).toBe(1); // Label for interaction 2
    expect(diff.labels.verdictChanges["pass->fail"]).toBe(1);
  });

  it("handles missing labels gracefully", async () => {
    await createVersion("v1", [
      { interactionId: "1", timestamp: "2026-01-01T00:00:00Z", input: { text: "a" } },
    ]);

    await createVersion("v2", [
      { interactionId: "1", timestamp: "2026-01-01T00:00:00Z", input: { text: "a" } },
    ]);

    const diff = await diffDatasets({
      fromVersion: "v1",
      toVersion: "v2",
      datasetsDir,
    });

    expect(diff.labels.added).toBe(0);
    expect(diff.labels.removed).toBe(0);
  });
});
