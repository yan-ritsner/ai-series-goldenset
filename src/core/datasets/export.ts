import type { Interaction, Label } from "../types.js";
import { createWriteStream } from "fs";
import { once } from "events";

export interface ExportOptions {
  interactions: Interaction[];
  labels: Label[];
  outputPath: string;
  format?: "jsonl";
}

async function writeJsonl(path: string, rows: unknown[]): Promise<void> {
  const ws = createWriteStream(path, { encoding: "utf-8" });

  // Fail fast on write errors
  const done = Promise.race([
    once(ws, "finish"),
    once(ws, "error").then(([e]) => Promise.reject(e)),
  ]);

  for (const row of rows) {
    if (!ws.write(JSON.stringify(row) + "\n")) {
      await once(ws, "drain");
    }
  }

  ws.end();
  await done;
}

function labelsOutputPath(outputPath: string): string {
  // If caller passed foo.jsonl -> foo_labels.jsonl
  if (outputPath.endsWith(".jsonl")) {
    return outputPath.replace(/\.jsonl$/, "_labels.jsonl");
  }
  // Otherwise -> foo_labels.jsonl (don't risk overwriting)
  return `${outputPath}_labels.jsonl`;
}

/**
 * Export interactions and labels to JSONL files
 */
export async function exportDataset(options: ExportOptions): Promise<void> {
  const { interactions, labels, outputPath, format = "jsonl" } = options;

  if (format !== "jsonl") {
    throw new Error(`Unsupported export format: ${format}`);
  }

  await writeJsonl(outputPath, interactions);
  await writeJsonl(labelsOutputPath(outputPath), labels);
}
