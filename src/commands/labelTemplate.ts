import { Command } from "commander";
import { parseInteractions } from "../core/ingest/jsonl.js";
import { writeText } from "../util/fs.js";
import type { Label } from "../core/types.js";

export function labelTemplateCommand(): Command {
  const cmd = new Command("label")
    .description("Label management commands");

  cmd
    .command("template")
    .description("Generate a label template from a sample file")
    .requiredOption("--in <file>", "Input JSONL file with interactions")
    .requiredOption("--out <file>", "Output JSONL file for labels")
    .action(async (options: { in: string; out: string }) => {
      try {
        const result = await parseInteractions(options.in);

        if (result.errors.length > 0) {
          console.error(`Found ${result.errors.length} errors in input file`);
          if (result.items.length === 0) {
            process.exit(1);
          }
        }

        // Generate label templates
        const labels: Label[] = result.items.map((interaction) => ({
          interactionId: interaction.interactionId,
          reviewedAt: new Date().toISOString(),
          reviewer: "anonymous",
          verdict: "needs_clarification",
          notes: "",
        }));

        // Write output
        const jsonl = labels.map((l) => JSON.stringify(l)).join("\n");
        await writeText(options.out, jsonl);

        console.log(`Generated ${labels.length} label templates in ${options.out}`);
        console.log("Edit the file to add reviews and verdicts.");
      } catch (error) {
        console.error("Error generating label template:", error);
        process.exit(1);
      }
    });

  return cmd;
}

