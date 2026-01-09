import { Command } from "commander";
import { getStore } from "../core/store/index.js";
import { exportDataset } from "../core/datasets/export.js";

export function exportCommand(): Command {
  const cmd = new Command("export")
    .description("Export a dataset version")
    .requiredOption("--name <name>", "Version name to export")
    .requiredOption("--out <file>", "Output JSONL file path")
    .option("--format <format>", "Export format: jsonl", "jsonl")
    .action(async (options: { name: string; out: string; format?: string }) => {
      try {
        const store = getStore();
        const version = store.getDatasetVersion(options.name);

        if (!version) {
          console.error(`Version '${options.name}' not found.`);
          process.exit(1);
        }

        // Get interactions and labels
        const interactions = store.getInteractions(version.interactionIds);
        const labels = store.getLabels(version.interactionIds);

        // Export
        await exportDataset({
          interactions,
          labels,
          outputPath: options.out,
          format: options.format as "jsonl",
        });

        console.log(`Exported ${interactions.length} interactions to ${options.out}`);
        console.log(`Exported ${labels.length} labels to ${options.out.replace(/\.jsonl$/, "_labels.jsonl")}`);
      } catch (error) {
        console.error("Error exporting dataset:", error);
        process.exit(1);
      }
    });

  return cmd;
}

