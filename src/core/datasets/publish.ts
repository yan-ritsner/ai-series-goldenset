import type { Interaction, Label, DatasetVersion } from "../types.js";
import { computeStats } from "../analytics/stats.js";
import { getDatasetsDir, ensureDir, writeJson, writeText } from "../../util/fs.js";
import { join } from "path";
import { createWriteStream } from "fs";
import { existsSync } from "fs";
import { once } from "events";

export interface PublishOptions {
  name: string;
  description?: string;
  interactions: Interaction[];
  labels: Label[];
  projectRoot?: string;
}

/**
 * Write JSONL file using streaming (memory-efficient for large datasets)
 */
async function writeJsonl(path: string, rows: unknown[]): Promise<void> {
  const ws = createWriteStream(path, { encoding: "utf-8" });

  for (const row of rows) {
    if (!ws.write(JSON.stringify(row) + "\n")) {
      await once(ws, "drain");
    }
  }

  ws.end();
  await once(ws, "finish");
}

/**
 * Publish a dataset version
 */
export async function publishDataset(
  options: PublishOptions
): Promise<DatasetVersion> {
  const { name, description, interactions, labels, projectRoot } = options;

  // Validate label references
  const ids = new Set(interactions.map((i) => i.interactionId));
  const unknown = labels.filter((l) => !ids.has(l.interactionId));
  if (unknown.length > 0) {
    throw new Error(
      `Labels reference unknown interactionIds (e.g. ${unknown[0].interactionId})`
    );
  }

  // Compute stats
  const stats = computeStats(interactions);

  // Create dataset version
  const version: DatasetVersion = {
    name,
    createdAt: new Date().toISOString(),
    description,
    interactionIds: interactions.map((i) => i.interactionId),
    stats: {
      byDimension: stats.byDimension,
      tagCounts: stats.tagCounts,
    },
  };

  // Write to disk
  const datasetsDir = getDatasetsDir(projectRoot);
  const versionDir = join(datasetsDir, sanitizeVersionName(name));

  // Prevent overwrite
  if (existsSync(versionDir)) {
    throw new Error(`Dataset version already exists: ${name}`);
  }

  await ensureDir(versionDir);

  // Write dataset.json
  await writeJson(join(versionDir, "dataset.json"), version);

  // Write interactions.jsonl (streaming)
  await writeJsonl(join(versionDir, "interactions.jsonl"), interactions);

  // Write labels.jsonl (streaming)
  await writeJsonl(join(versionDir, "labels.jsonl"), labels);

  // Write stats.json
  await writeJson(join(versionDir, "stats.json"), stats);

  // Write changelog.md
  const changelog = generateChangelog(version, stats);
  await writeText(join(versionDir, "changelog.md"), changelog);

  return version;
}

/**
 * Sanitize version name for filesystem
 */
function sanitizeVersionName(name: string): string {
  return name.replace(/\//g, "_");
}

/**
 * Generate changelog markdown
 */
function generateChangelog(
  version: DatasetVersion,
  stats: ReturnType<typeof computeStats>
): string {
  const lines: string[] = [];

  lines.push(`# Dataset Version: ${version.name}`);
  lines.push("");
  lines.push(`**Created:** ${version.createdAt}`);
  if (version.description) {
    lines.push(`**Description:** ${version.description}`);
  }
  lines.push("");
  lines.push(`**Total Interactions:** ${version.interactionIds.length}`);
  lines.push("");

  // Dimension breakdown
  if (Object.keys(stats.byDimension).length > 0) {
    lines.push("## Distribution by Dimensions");
    lines.push("");
    for (const [key, values] of Object.entries(stats.byDimension)) {
      lines.push(`### ${key}`);
      const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
      for (const [value, count] of sorted) {
        lines.push(`- ${value}: ${count}`);
      }
      lines.push("");
    }
  }

  // Top tags
  if (Object.keys(stats.tagCounts).length > 0) {
    lines.push("## Top Tags");
    lines.push("");
    const sortedTags = Object.entries(stats.tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    for (const [tag, count] of sortedTags) {
      lines.push(`- ${tag}: ${count}`);
    }
  }

  return lines.join("\n");
}

