import { SQLiteStore } from "./sqlite.js";
import { getGoldensetDir } from "../../util/fs.js";
import { join } from "path";

let storeInstance: SQLiteStore | null = null;

/**
 * Get or create the singleton store instance
 */
export function getStore(projectRoot?: string): SQLiteStore {
  if (!storeInstance) {
    const goldensetDir = getGoldensetDir(projectRoot);
    const dbPath = join(goldensetDir, "db.sqlite");
    storeInstance = new SQLiteStore(dbPath);
  }
  return storeInstance;
}

/**
 * Close the store connection
 */
export function closeStore(): void {
  if (storeInstance) {
    storeInstance.close();
    storeInstance = null;
  }
}

