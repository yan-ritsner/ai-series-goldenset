import type { Interaction, Label } from "../types.js";
import { writeText } from "../../util/fs.js";

export interface ExportOptions {
  interactions: Interaction[];
  labels: Label[];
  outputPath: string;
  format?: "jsonl";
}

/**
 * Export interactions and labels to JSONL files
 */
export async function exportDataset(
  options: ExportOptions
): Promise<void> {
  const { interactions, labels, outputPath, format = "jsonl" } = options;

  if (format === "jsonl") {
    // Write interactions
    const interactionsJsonl = interactions
      .map((i) => JSON.stringify(i))
      .join("\n");
    await writeText(outputPath, interactionsJsonl);

    // Write labels to separate file
    const labelsPath = outputPath.replace(/\.jsonl$/, "_labels.jsonl");
    const labelsJsonl = labels.map((l) => JSON.stringify(l)).join("\n");
    await writeText(labelsPath, labelsJsonl);
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
}

