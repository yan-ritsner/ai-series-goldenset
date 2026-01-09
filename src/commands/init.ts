import { Command } from "commander";
import { getGoldensetDir, ensureDir } from "../util/fs.js";
import { getStore } from "../core/store/index.js";

export function initCommand(): Command {
  const cmd = new Command("init")
    .description("Initialize goldenset in the current directory")
    .action(async () => {
      try {
        const goldensetDir = getGoldensetDir();
        await ensureDir(goldensetDir);

        // Initialize store (creates DB)
        getStore();

        console.log(`Initialized goldenset in ${goldensetDir}`);
      } catch (error) {
        console.error("Error initializing goldenset:", error);
        process.exit(1);
      }
    });

  return cmd;
}

