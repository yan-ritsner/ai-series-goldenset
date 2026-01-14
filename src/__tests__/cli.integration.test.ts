import { describe, it, expect } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "dist", "src", "cli.js");

describe("CLI integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "goldenset-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("runs end-to-end: init → ingest → stats", async () => {
    // Build first
    await execFileAsync("npm", ["run", "build"], { cwd: process.cwd() });

    // Init
    const { stdout: initOut } = await execFileAsync("node", [cliPath, "init"], {
      cwd: tempDir,
    });
    expect(initOut).toContain("Initialized");

    // Verify database exists
    expect(existsSync(join(tempDir, ".goldenset", "db.sqlite"))).toBe(true);

    // Ingest
    const examplePath = join(process.cwd(), "examples", "internal-docs", "interactions.jsonl");
    const { stdout: ingestOut } = await execFileAsync(
      "node",
      [cliPath, "ingest", "interactions", examplePath],
      { cwd: tempDir }
    );
    expect(ingestOut).toContain("Ingested");

    // Stats
    const { stdout: statsOut } = await execFileAsync("node", [cliPath, "stats"], {
      cwd: tempDir,
    });
    expect(statsOut).toContain("Total interactions:");
  }, 30000);
});
