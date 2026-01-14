import { Command } from "commander";
import { getGoldensetDir, getDatasetsDir } from "../util/fs.js";
import { rm } from "fs/promises";
import { existsSync } from "fs";

export function cleanCommand(): Command {
  const cmd = new Command("clean")
    .description("Clean up goldenset data (removes .goldenset/ and optionally datasets/)")
    .option("--datasets", "Also remove published datasets directory")
    .action(async (options: { datasets?: boolean }) => {
      try {
        const goldensetDir = getGoldensetDir();
        const datasetsDir = getDatasetsDir();

        let cleaned = false;

        // Remove .goldenset/ directory
        if (existsSync(goldensetDir)) {
          await rm(goldensetDir, { recursive: true, force: true });
          console.log(`Removed ${goldensetDir}`);
          cleaned = true;
        } else {
          console.log(`No .goldenset/ directory found`);
        }

        // Optionally remove datasets/
        if (options.datasets) {
          if (existsSync(datasetsDir)) {
            await rm(datasetsDir, { recursive: true, force: true });
            console.log(`Removed ${datasetsDir}`);
            cleaned = true;
          } else {
            console.log(`No datasets/ directory found`);
          }
        }

        if (!cleaned) {
          console.log("Nothing to clean");
        } else {
          console.log("Cleanup complete");
        }
      } catch (error) {
        console.error("Error during cleanup:", error);
        process.exit(1);
      }
    });

  return cmd;
}
