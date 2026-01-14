import type { Interaction } from "../types.js";

const MISSING = "__missing__";

export interface DimensionStats {
  byDimension: Record<string, Record<string, number>>;
  tagCounts: Record<string, number>;
  total: number;
}

/**
 * Compute statistics for interactions
 */
export function computeStats(
  interactions: Interaction[],
  dimensionKeys?: string[]
): DimensionStats {
  const byDimension: Record<string, Record<string, number>> = {};
  const tagCounts: Record<string, number> = {};

  const keysToTrack = dimensionKeys?.length
    ? [...dimensionKeys]
    : extractDimensionKeys(interactions);

  for (const key of keysToTrack) byDimension[key] = {};

  for (const interaction of interactions) {
    const dims = interaction.dimensions ?? {};

    // ✅ Count missing explicitly
    for (const key of keysToTrack) {
      const value = dims[key] ?? MISSING;
      byDimension[key][value] = (byDimension[key][value] ?? 0) + 1;
    }

    if (interaction.tags) {
      for (const tag of interaction.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }
  }

  return { byDimension, tagCounts, total: interactions.length };
}

/**
 * Extract all dimension keys from interactions
 */
function extractDimensionKeys(interactions: Interaction[]): string[] {
  const keys = new Set<string>();

  for (const interaction of interactions) {
    if (interaction.dimensions) {
      for (const key of Object.keys(interaction.dimensions)) {
        keys.add(key);
      }
    }
  }

  return Array.from(keys).sort();
}

/**
 * Format stats for display
 */
export function formatStats(stats: DimensionStats): string {
  const lines: string[] = [];

  lines.push(`Total interactions: ${stats.total}`);
  lines.push("");

  // Dimension breakdowns
  for (const [key, values] of Object.entries(stats.byDimension)) {
    lines.push(`${key}:`);
    const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
    for (const [value, count] of sorted) {
      lines.push(`  ${value}: ${count}`);
    }
    lines.push("");
  }

  // Top tags
  if (Object.keys(stats.tagCounts).length > 0) {
    lines.push("Top tags:");
    const sortedTags = Object.entries(stats.tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [tag, count] of sortedTags) {
      lines.push(`  ${tag}: ${count}`);
    }
  }

  return lines.join("\n");
}

