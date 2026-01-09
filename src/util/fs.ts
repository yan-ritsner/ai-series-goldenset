import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

/**
 * Write JSON to a file
 */
export async function writeJson<T>(path: string, data: T): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Read and parse JSON from a file
 */
export async function readJson<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Write text to a file
 */
export async function writeText(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, content, "utf-8");
}

/**
 * Check if a file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Get the goldenset data directory path
 */
export function getGoldensetDir(projectRoot: string = process.cwd()): string {
  return join(projectRoot, ".goldenset");
}

/**
 * Get the datasets directory path
 */
export function getDatasetsDir(projectRoot: string = process.cwd()): string {
  return join(projectRoot, "datasets");
}

