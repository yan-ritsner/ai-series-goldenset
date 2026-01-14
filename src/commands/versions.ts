import { Command } from "commander";
import { getStore } from "../core/store/index.js";
import { formatStats } from "../core/analytics/stats.js";
import { diffDatasets } from "../core/datasets/diff.js";
import { formatDiffText, formatDiffJson } from "../core/datasets/diffFormat.js";
import { getDatasetsDir } from "../util/fs.js";

export function versionsCommand(): Command {
  const cmd = new Command("versions")
    .description("Manage dataset versions");

  cmd
    .command("list")
    .description("List all dataset versions")
    .action(async () => {
      try {
        const store = getStore();
        const versions = store.listDatasetVersions();

        if (versions.length === 0) {
          console.log("No dataset versions found.");
          return;
        }

        console.log("Dataset Versions:");
        console.log("");
        for (const version of versions) {
          console.log(`  ${version.name}`);
          console.log(`    Created: ${version.createdAt}`);
          console.log(`    Interactions: ${version.interactionCount}`);
          if (version.description) {
            console.log(`    Description: ${version.description}`);
          }
          console.log("");
        }
      } catch (error) {
        console.error("Error listing versions:", error);
        process.exit(1);
      }
    });

  cmd
    .command("show")
    .description("Show details of a dataset version")
    .argument("<name>", "Version name")
    .action(async (name: string) => {
      try {
        const store = getStore();
        const version = store.getDatasetVersion(name);

        if (!version) {
          console.error(`Version '${name}' not found.`);
          process.exit(1);
        }

        console.log(`Dataset Version: ${version.name}`);
        console.log(`Created: ${version.createdAt}`);
        if (version.description) {
          console.log(`Description: ${version.description}`);
        }
        console.log(`Interactions: ${version.interactionIds.length}`);
        console.log("");

        // Get interactions to compute stats
        const interactions = store.getInteractions(version.interactionIds);
        const stats = {
          byDimension: version.stats.byDimension,
          tagCounts: version.stats.tagCounts || {},
          total: interactions.length,
        };

        console.log(formatStats(stats));
      } catch (error) {
        console.error("Error showing version:", error);
        process.exit(1);
      }
    });

  cmd
    .command("diff")
    .description("Compare two dataset versions")
    .argument("<fromVersion>", "Source version name (e.g., golden/v1)")
    .argument("<toVersion>", "Target version name (e.g., golden/v2)")
    .option("--format <format>", "Output format: text or json", "text")
    .option(
      "--dimensions <keys>",
      "Comma-separated dimension keys to track (default: all)"
    )
    .option(
      "--limit <number>",
      "Limit number of items shown (default: 10, use 'all' for unlimited)",
      "10"
    )
    .action(
      async (
        fromVersion: string,
        toVersion: string,
        options: {
          format: string;
          dimensions?: string;
          limit: string;
        }
      ) => {
        try {
          const datasetsDir = getDatasetsDir();
          const dimensionKeys = options.dimensions
            ? options.dimensions.split(",").map((k) => k.trim())
            : undefined;

          const limit =
            options.limit === "all" || options.limit === "Infinity"
              ? Infinity
              : parseInt(options.limit, 10);

          if (isNaN(limit) || limit < 0) {
            console.error("Invalid limit value. Must be a positive number or 'all'.");
            process.exit(1);
          }

          const diff = await diffDatasets({
            fromVersion,
            toVersion,
            datasetsDir,
            dimensionKeys,
          });

          if (options.format === "json") {
            console.log(formatDiffJson(diff));
          } else {
            console.log(formatDiffText(diff, { limit }));
          }
        } catch (error) {
          console.error("Error computing diff:", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );

  return cmd;
}

