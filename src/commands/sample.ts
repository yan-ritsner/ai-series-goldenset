import { Command } from "commander";
import { getStore } from "../core/store/index.js";
import { stratifiedSample } from "../core/analytics/sample.js";
import { dedupeExact } from "../core/analytics/dedupe.js";
import { writeText } from "../util/fs.js";

export function sampleCommand(): Command {
  const cmd = new Command("sample")
    .description("Generate a stratified sample")
    .requiredOption("--n <number>", "Number of interactions to sample", parseInt)
    .requiredOption("--by <keys>", "Comma-separated dimension keys for stratification")
    .requiredOption("--out <file>", "Output JSONL file path")
    .option("--where <filters>", "Comma-separated key=value filters")
    .option("--dedupe <method>", "Deduplication method: exact", "exact")
    .option("--seed <number>", "Random seed for reproducibility", parseInt)
    .action(async (options: {
      n: number;
      by: string;
      out: string;
      where?: string;
      dedupe?: string;
      seed?: number;
    }) => {
      try {
        const store = getStore();
        let interactions = store.getAllInteractions();

        // Parse where filters
        let whereFilter: Record<string, string> | undefined;
        if (options.where) {
          whereFilter = {};
          for (const filter of options.where.split(",")) {
            const [key, value] = filter.split("=").map((s) => s.trim());
            if (key && value) {
              whereFilter[key] = value;
            }
          }
        }

        // Deduplication
        if (options.dedupe === "exact") {
          interactions = dedupeExact(interactions);
        }

        // Stratified sampling
        const dimensionKeys = options.by.split(",").map((s) => s.trim());
        const sampled = stratifiedSample(interactions, {
          n: options.n,
          by: dimensionKeys,
          where: whereFilter,
          seed: options.seed,
        });

        // Write output
        const jsonl = sampled.map((i) => JSON.stringify(i)).join("\n");
        await writeText(options.out, jsonl);

        console.log(`Sampled ${sampled.length} interactions to ${options.out}`);
      } catch (error) {
        console.error("Error sampling:", error);
        process.exit(1);
      }
    });

  return cmd;
}

