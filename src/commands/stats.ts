import { Command } from "commander";
import { getStore } from "../core/store/index.js";
import { computeStats, formatStats } from "../core/analytics/stats.js";

export function statsCommand(): Command {
  const cmd = new Command("stats")
    .description("Compute and display statistics")
    .option(
      "--by <keys>",
      "Comma-separated list of dimension keys to group by"
    )
    .option(
      "--where <filters>",
      "Comma-separated key=value filters (e.g., intent=incident,department=eng)"
    )
    .action(async (options: { by?: string; where?: string }) => {
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
          if (whereFilter) {
            interactions = interactions.filter((interaction) => {
              if (!interaction.dimensions) return false;
              for (const [key, value] of Object.entries(whereFilter!)) {
                if (interaction.dimensions[key] !== value) {
                  return false;
                }
              }
              return true;
            });
          }
        }

        // Parse dimension keys
        let dimensionKeys: string[] | undefined;
        if (options.by) {
          dimensionKeys = options.by.split(",").map((s) => s.trim());
        }

        const stats = computeStats(interactions, dimensionKeys);
        console.log(formatStats(stats));
      } catch (error) {
        console.error("Error computing stats:", error);
        process.exit(1);
      }
    });

  return cmd;
}

