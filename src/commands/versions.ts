import { Command } from "commander";
import { getStore } from "../core/store/index.js";
import { formatStats } from "../core/analytics/stats.js";

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

  return cmd;
}

