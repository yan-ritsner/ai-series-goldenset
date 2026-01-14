import type { Interaction, Label } from "../types.js";
import { parseInteractions, parseLabels } from "../ingest/jsonl.js";
import { sanitizeVersionName } from "./helpers.js";
import { join } from "path";
import { existsSync } from "fs";

export interface DiffOptions {
  fromVersion: string;
  toVersion: string;
  datasetsDir: string;
  dimensionKeys?: string[];
}

export interface InteractionDiff {
  added: string[];
  removed: string[];
  unchanged: string[];
}

export interface DimensionDiff {
  [dimensionKey: string]: {
    [value: string]: {
      from: number;
      to: number;
      delta: number;
    };
  };
}

export interface TagDiff {
  [tag: string]: {
    from: number;
    to: number;
    delta: number;
  };
}

export interface LabelDiff {
  added: number;
  removed: number;
  verdictChanges: {
    [change: string]: number; // e.g., "pass->fail": 3
  };
}

export interface DatasetDiff {
  from: string;
  to: string;
  interactions: InteractionDiff;
  dimensions: DimensionDiff;
  tags: TagDiff;
  labels: LabelDiff;
}

const MISSING = "__missing__";

/**
 * Load interactions from a published dataset version
 */
async function loadInteractions(
  versionDir: string
): Promise<Map<string, Interaction>> {
  const interactionsPath = join(versionDir, "interactions.jsonl");
  if (!existsSync(interactionsPath)) {
    throw new Error(`Interactions file not found: ${interactionsPath}`);
  }

  const result = await parseInteractions(interactionsPath);
  if (result.errors.length > 0) {
    throw new Error(
      `Failed to parse interactions: ${result.errors[0].error}`
    );
  }

  const map = new Map<string, Interaction>();
  for (const interaction of result.items) {
    map.set(interaction.interactionId, interaction);
  }
  return map;
}

/**
 * Load labels from a published dataset version
 */
async function loadLabels(
  versionDir: string
): Promise<Map<string, Label>> {
  const labelsPath = join(versionDir, "labels.jsonl");
  if (!existsSync(labelsPath)) {
    // Labels are optional
    return new Map();
  }

  const result = await parseLabels(labelsPath);
  if (result.errors.length > 0) {
    throw new Error(`Failed to parse labels: ${result.errors[0].error}`);
  }

  const map = new Map<string, Label>();
  for (const label of result.items) {
    map.set(label.interactionId, label);
  }
  return map;
}

/**
 * Compute dimension distribution from interactions
 */
function computeDimensionDistribution(
  interactions: Map<string, Interaction>,
  dimensionKeys?: string[]
): Record<string, Record<string, number>> {
  const distribution: Record<string, Record<string, number>> = {};

  // Determine which keys to track
  const keysToTrack = dimensionKeys?.length
    ? [...dimensionKeys]
    : (() => {
      const allKeys = new Set<string>();
      for (const interaction of interactions.values()) {
        if (interaction.dimensions) {
          for (const key of Object.keys(interaction.dimensions)) {
            allKeys.add(key);
          }
        }
      }
      return Array.from(allKeys);
    })();

  // Initialize dimension keys
  for (const key of keysToTrack) {
    distribution[key] = {};
  }

  // Count values
  for (const interaction of interactions.values()) {
    const dims = interaction.dimensions ?? {};
    for (const key of keysToTrack) {
      const value = dims[key] ?? MISSING;
      distribution[key][value] = (distribution[key][value] ?? 0) + 1;
    }
  }

  return distribution;
}

/**
 * Compute tag distribution from interactions
 */
function computeTagDistribution(
  interactions: Map<string, Interaction>
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const interaction of interactions.values()) {
    if (interaction.tags) {
      for (const tag of interaction.tags) {
        distribution[tag] = (distribution[tag] ?? 0) + 1;
      }
    }
  }

  return distribution;
}

/**
 * Compare two dataset versions and compute diff
 */
export async function diffDatasets(
  options: DiffOptions
): Promise<DatasetDiff> {
  const { fromVersion, toVersion, datasetsDir, dimensionKeys } = options;

  const sanitizedFrom = sanitizeVersionName(fromVersion);
  const sanitizedTo = sanitizeVersionName(toVersion);
  const fromDir = join(datasetsDir, sanitizedFrom);
  const toDir = join(datasetsDir, sanitizedTo);

  if (!existsSync(fromDir)) {
    throw new Error(`Dataset version not found: ${fromVersion}`);
  }
  if (!existsSync(toDir)) {
    throw new Error(`Dataset version not found: ${toVersion}`);
  }

  // Load interactions and labels
  const [fromInteractions, toInteractions, fromLabels, toLabels] =
    await Promise.all([
      loadInteractions(fromDir),
      loadInteractions(toDir),
      loadLabels(fromDir),
      loadLabels(toDir),
    ]);

  // Compute interaction diff
  const fromIds = new Set(fromInteractions.keys());
  const toIds = new Set(toInteractions.keys());

  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  for (const id of toIds) {
    if (fromIds.has(id)) {
      unchanged.push(id);
    } else {
      added.push(id);
    }
  }

  for (const id of fromIds) {
    if (!toIds.has(id)) {
      removed.push(id);
    }
  }

  // Sort for determinism
  added.sort();
  removed.sort();
  unchanged.sort();

  // Compute dimension diff
  const fromDims = computeDimensionDistribution(
    fromInteractions,
    dimensionKeys
  );
  const toDims = computeDimensionDistribution(toInteractions, dimensionKeys);

  const dimensionDiff: DimensionDiff = {};
  const allDimensionKeys = new Set([
    ...Object.keys(fromDims),
    ...Object.keys(toDims),
  ]);

  for (const dimKey of allDimensionKeys) {
    dimensionDiff[dimKey] = {};
    const fromDist = fromDims[dimKey] ?? {};
    const toDist = toDims[dimKey] ?? {};

    const allValues = new Set([
      ...Object.keys(fromDist),
      ...Object.keys(toDist),
    ]);

    for (const value of allValues) {
      const fromCount = fromDist[value] ?? 0;
      const toCount = toDist[value] ?? 0;
      const delta = toCount - fromCount;

      if (delta !== 0 || fromCount > 0 || toCount > 0) {
        dimensionDiff[dimKey][value] = {
          from: fromCount,
          to: toCount,
          delta,
        };
      }
    }
  }

  // Compute tag diff
  const fromTags = computeTagDistribution(fromInteractions);
  const toTags = computeTagDistribution(toInteractions);

  const tagDiff: TagDiff = {};
  const allTags = new Set([...Object.keys(fromTags), ...Object.keys(toTags)]);

  for (const tag of allTags) {
    const fromCount = fromTags[tag] ?? 0;
    const toCount = toTags[tag] ?? 0;
    const delta = toCount - fromCount;

    if (delta !== 0 || fromCount > 0 || toCount > 0) {
      tagDiff[tag] = {
        from: fromCount,
        to: toCount,
        delta,
      };
    }
  }

  // Compute label diff
  const labelDiff: LabelDiff = {
    added: 0,
    removed: 0,
    verdictChanges: {},
  };

  // Count added/removed labels
  for (const id of toLabels.keys()) {
    if (!fromLabels.has(id)) {
      labelDiff.added++;
    }
  }

  for (const id of fromLabels.keys()) {
    if (!toLabels.has(id)) {
      labelDiff.removed++;
    }
  }

  // Count verdict changes for interactions that exist in both
  for (const id of unchanged) {
    const fromLabel = fromLabels.get(id);
    const toLabel = toLabels.get(id);

    if (fromLabel && toLabel) {
      const fromVerdict = fromLabel.verdict;
      const toVerdict = toLabel.verdict;

      if (fromVerdict !== toVerdict) {
        const change = `${fromVerdict}->${toVerdict}`;
        labelDiff.verdictChanges[change] =
          (labelDiff.verdictChanges[change] ?? 0) + 1;
      }
    }
  }

  return {
    from: fromVersion,
    to: toVersion,
    interactions: {
      added,
      removed,
      unchanged,
    },
    dimensions: dimensionDiff,
    tags: tagDiff,
    labels: labelDiff,
  };
}
