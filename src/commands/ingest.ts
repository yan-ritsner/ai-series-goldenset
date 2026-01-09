import { Command } from "commander";
import { parseInteractions, parseArtifacts } from "../core/ingest/jsonl.js";
import { getStore } from "../core/store/index.js";

export function ingestCommand(): Command {
  const cmd = new Command("ingest")
    .description("Ingest data from JSONL files");

  cmd
    .command("interactions")
    .description("Ingest interactions from JSONL file")
    .argument("<file>", "Path to JSONL file")
    .option("--upsert", "Update existing interactions", false)
    .action(async (file: string, options: { upsert: boolean }) => {
      try {
        const result = await parseInteractions(file);

        if (result.errors.length > 0) {
          console.error(`Found ${result.errors.length} errors:`);
          for (const error of result.errors) {
            console.error(`  Line ${error.line}: ${error.error}`);
            if (error.content) {
              console.error(`    ${error.content}...`);
            }
          }
          if (result.items.length === 0) {
            process.exit(1);
          }
        }

        const store = getStore();
        let count = 0;

        for (const interaction of result.items) {
          store.upsertInteraction(interaction);
          count++;
        }

        console.log(`Ingested ${count} interactions`);
        if (result.errors.length > 0) {
          console.log(`(Skipped ${result.errors.length} invalid lines)`);
        }
      } catch (error) {
        console.error("Error ingesting interactions:", error);
        process.exit(1);
      }
    });

  cmd
    .command("artifacts")
    .description("Ingest artifacts from JSONL file")
    .argument("<file>", "Path to JSONL file")
    .option("--upsert", "Update existing artifacts", false)
    .action(async (file: string, options: { upsert: boolean }) => {
      try {
        const result = await parseArtifacts(file);

        if (result.errors.length > 0) {
          console.error(`Found ${result.errors.length} errors:`);
          for (const error of result.errors) {
            console.error(`  Line ${error.line}: ${error.error}`);
            if (error.content) {
              console.error(`    ${error.content}...`);
            }
          }
          if (result.items.length === 0) {
            process.exit(1);
          }
        }

        const store = getStore();
        let count = 0;

        for (const artifact of result.items) {
          store.upsertArtifact(artifact);
          count++;
        }

        console.log(`Ingested ${count} artifacts`);
        if (result.errors.length > 0) {
          console.log(`(Skipped ${result.errors.length} invalid lines)`);
        }
      } catch (error) {
        console.error("Error ingesting artifacts:", error);
        process.exit(1);
      }
    });

  return cmd;
}

