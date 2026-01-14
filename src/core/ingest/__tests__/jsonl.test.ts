import { describe, it, expect } from "vitest";
import { parseInteractions } from "../jsonl.js";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("parseJsonl", () => {
  async function createTempFile(content: string): Promise<string> {
    const tmpPath = join(tmpdir(), `test-${Date.now()}.jsonl`);
    await writeFile(tmpPath, content, "utf-8");
    return tmpPath;
  }

  it("parses valid JSONL", async () => {
    const content = `{"interactionId":"1","timestamp":"2026-01-01T00:00:00Z","input":{"text":"test"}}
{"interactionId":"2","timestamp":"2026-01-01T00:00:00Z","input":{"text":"test2"}}`;

    const path = await createTempFile(content);
    try {
      const result = await parseInteractions(path);
      expect(result.items).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.items[0].interactionId).toBe("1");
    } finally {
      await unlink(path);
    }
  });

  it("reports invalid JSON with line numbers", async () => {
    const content = `{"interactionId":"1","timestamp":"2026-01-01T00:00:00Z","input":{"text":"test"}}
{invalid json}
{"interactionId":"3","timestamp":"2026-01-01T00:00:00Z","input":{"text":"test3"}}`;

    const path = await createTempFile(content);
    try {
      const result = await parseInteractions(path);
      expect(result.items).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      // JSON.parse gives specific error messages, just verify it's a JSON parsing error
      expect(result.errors[0].error.length).toBeGreaterThan(0);
      expect(result.errors[0].content).toBeDefined();
    } finally {
      await unlink(path);
    }
  });

  it("reports schema errors with path", async () => {
    const content = `{"interactionId":"1","timestamp":"invalid","input":{"text":"test"}}`;

    const path = await createTempFile(content);
    try {
      const result = await parseInteractions(path);
      expect(result.items).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("timestamp");
    } finally {
      await unlink(path);
    }
  });

  it("handles BOM on first line", async () => {
    const content = `\uFEFF{"interactionId":"1","timestamp":"2026-01-01T00:00:00Z","input":{"text":"test"}}`;

    const path = await createTempFile(content);
    try {
      const result = await parseInteractions(path);
      expect(result.items).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    } finally {
      await unlink(path);
    }
  });
});
