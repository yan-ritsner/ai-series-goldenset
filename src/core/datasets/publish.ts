import type { Interaction, Label, DatasetVersion } from "../types.js";
import { computeStats } from "../analytics/stats.js";
import { getDatasetsDir, ensureDir, writeJson, writeText } from "../../util/fs.js";
import { join } from "path";

export interface PublishOptions {
  name: string;
  description?: string;
  interactions: Interaction[];
  labels: Label[];
  projectRoot?: string;
}

/**
 * Publish a dataset version
 */
export async function publishDataset(
  options: PublishOptions
): Promise<DatasetVersion> {
  const { name, description, interactions, labels, projectRoot } = options;

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
  await ensureDir(versionDir);

  // Write dataset.json
  await writeJson(join(versionDir, "dataset.json"), version);

  // Write interactions.jsonl
  const interactionsJsonl = interactions
    .map((i) => JSON.stringify(i))
    .join("\n");
  await writeText(join(versionDir, "interactions.jsonl"), interactionsJsonl);

  // Write labels.jsonl
  const labelsJsonl = labels.map((l) => JSON.stringify(l)).join("\n");
  await writeText(join(versionDir, "labels.jsonl"), labelsJsonl);

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

