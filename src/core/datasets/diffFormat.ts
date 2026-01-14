import type { DatasetDiff, DimensionDiff, TagDiff } from "./diff.js";

export interface FormatOptions {
  limit?: number; // Limit number of items shown (default: 10, use Infinity for all)
}

const MISSING = "__missing__";

/**
 * Format dimension diff for text output
 */
function formatDimensionDiff(
  dimensionDiff: DimensionDiff,
  limit: number
): string[] {
  const lines: string[] = [];

  for (const [dimKey, values] of Object.entries(dimensionDiff)) {
    lines.push(`Dimension: ${dimKey}`);

    // Sort by absolute delta descending, then by value name
    const entries = Object.entries(values)
      .map(([value, data]) => ({
        value,
        ...data,
        absDelta: Math.abs(data.delta),
      }))
      .sort((a, b) => {
        if (b.absDelta !== a.absDelta) {
          return b.absDelta - a.absDelta;
        }
        return a.value.localeCompare(b.value);
      });

    // Apply limit
    const limited = limit === Infinity ? entries : entries.slice(0, limit);

    for (const { value, from, to, delta } of limited) {
      const displayValue = value === MISSING ? "__missing__" : value;
      const sign = delta >= 0 ? "+" : "";
      lines.push(
        `  ${displayValue.padEnd(20)} ${String(from).padStart(4)} → ${String(to).padStart(4)}  (${sign}${delta})`
      );
    }

    if (entries.length > limit) {
      lines.push(`  ... and ${entries.length - limit} more`);
    }

    lines.push("");
  }

  return lines;
}

/**
 * Format tag diff for text output
 */
function formatTagDiff(tagDiff: TagDiff, limit: number): string[] {
  const lines: string[] = ["Tags:"];

  // Sort by absolute delta descending, then by tag name
  const entries = Object.entries(tagDiff)
    .map(([tag, data]) => ({
      tag,
      ...data,
      absDelta: Math.abs(data.delta),
    }))
    .sort((a, b) => {
      if (b.absDelta !== a.absDelta) {
        return b.absDelta - a.absDelta;
      }
      return a.tag.localeCompare(b.tag);
    });

  // Apply limit
  const limited = limit === Infinity ? entries : entries.slice(0, limit);

  for (const { tag, from, to, delta } of limited) {
    const sign = delta >= 0 ? "+" : "";
    lines.push(
      `  ${tag.padEnd(20)} ${String(from).padStart(4)} → ${String(to).padStart(4)}  (${sign}${delta})`
    );
  }

  if (entries.length > limit) {
    lines.push(`  ... and ${entries.length - limit} more`);
  }

  return lines;
}

/**
 * Format dataset diff as text
 */
export function formatDiffText(
  diff: DatasetDiff,
  options: FormatOptions = {}
): string {
  const { limit = 10 } = options;
  const lines: string[] = [];

  // Header
  lines.push(`Diff: ${diff.from} → ${diff.to}`);
  lines.push("");

  // Interactions
  lines.push("Interactions:");
  lines.push(`  Added: ${diff.interactions.added.length}`);
  lines.push(`  Removed: ${diff.interactions.removed.length}`);
  lines.push(`  Unchanged: ${diff.interactions.unchanged.length}`);

  // Optionally list IDs when count <= limit
  if (diff.interactions.added.length > 0 && diff.interactions.added.length <= limit) {
    lines.push(`  Added IDs: ${diff.interactions.added.join(", ")}`);
  }
  if (
    diff.interactions.removed.length > 0 &&
    diff.interactions.removed.length <= limit
  ) {
    lines.push(`  Removed IDs: ${diff.interactions.removed.join(", ")}`);
  }
  lines.push("");

  // Dimensions
  const dimensionLines = formatDimensionDiff(diff.dimensions, limit);
  lines.push(...dimensionLines);

  // Tags
  const tagLines = formatTagDiff(diff.tags, limit);
  lines.push(...tagLines);
  lines.push("");

  // Labels
  lines.push("Labels:");
  lines.push(`  New: ${diff.labels.added}`);
  lines.push(`  Removed: ${diff.labels.removed}`);

  if (Object.keys(diff.labels.verdictChanges).length > 0) {
    lines.push("  Verdict changes:");
    for (const [change, count] of Object.entries(diff.labels.verdictChanges)) {
      lines.push(`    ${change}: ${count}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Format dataset diff as JSON
 */
export function formatDiffJson(diff: DatasetDiff): string {
  // Convert to JSON structure
  const json = {
    from: diff.from,
    to: diff.to,
    interactions: {
      added: diff.interactions.added.length,
      removed: diff.interactions.removed.length,
      unchanged: diff.interactions.unchanged.length,
    },
    dimensions: diff.dimensions,
    tags: diff.tags,
    labels: {
      added: diff.labels.added,
      removed: diff.labels.removed,
      verdictChanges: diff.labels.verdictChanges,
    },
  };

  return JSON.stringify(json, null, 2);
}
