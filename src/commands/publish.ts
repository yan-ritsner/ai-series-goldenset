import { Command } from "commander";
import { parseInteractions, parseLabels } from "../core/ingest/jsonl.js";
import { getStore } from "../core/store/index.js";
import { publishDataset } from "../core/datasets/publish.js";

export function publishCommand(): Command {
  const cmd = new Command("publish")
    .description("Publish a versioned dataset")
    .requiredOption("--name <name>", "Version name (e.g., golden/v1)")
    .requiredOption("--sample <file>", "JSONL file with sampled interactions")
    .requiredOption("--labels <file>", "JSONL file with labels")
    .option("--desc <description>", "Description of the dataset version")
    .action(async (options: {
      name: string;
      sample: string;
      labels: string;
      desc?: string;
    }) => {
      try {
        // Parse sample and labels
        const sampleResult = await parseInteractions(options.sample);
        const labelsResult = await parseLabels(options.labels);

        if (sampleResult.errors.length > 0) {
          console.error(`Found ${sampleResult.errors.length} errors in sample file`);
          if (sampleResult.items.length === 0) {
            process.exit(1);
          }
        }

        if (labelsResult.errors.length > 0) {
          console.error(`Found ${labelsResult.errors.length} errors in labels file`);
        }

        // Validate that all label interactionIds exist in sample
        const sampleIds = new Set(sampleResult.items.map((i) => i.interactionId));
        const invalidLabels = labelsResult.items.filter(
          (l) => !sampleIds.has(l.interactionId)
        );

        if (invalidLabels.length > 0) {
          console.error(
            `Found ${invalidLabels.length} labels for interactions not in sample:`
          );
          for (const label of invalidLabels) {
            console.error(`  ${label.interactionId}`);
          }
          process.exit(1);
        }

        // Store labels in database
        const store = getStore();
        for (const label of labelsResult.items) {
          store.upsertLabel(label);
        }

        // Publish dataset
        const version = await publishDataset({
          name: options.name,
          description: options.desc,
          interactions: sampleResult.items,
          labels: labelsResult.items,
        });

        // Store version in database
        store.createDatasetVersion(version);

        console.log(`Published dataset version: ${version.name}`);
        console.log(`  Interactions: ${version.interactionIds.length}`);
        console.log(`  Created: ${version.createdAt}`);
      } catch (error) {
        console.error("Error publishing dataset:", error);
        process.exit(1);
      }
    });

  return cmd;
}

