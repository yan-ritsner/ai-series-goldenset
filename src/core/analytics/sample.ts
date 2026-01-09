import type { Interaction } from "../types.js";

export interface SampleOptions {
  n: number;
  by: string[];
  where?: Record<string, string>;
  seed?: number;
}

/**
 * Stratified sampling across dimension keys
 * Allocates quota proportionally with minimum 1 per group if possible
 */
export function stratifiedSample(
  interactions: Interaction[],
  options: SampleOptions
): Interaction[] {
  const { n, by, where, seed } = options;

  // Filter by where clause if provided
  let filtered = interactions;
  if (where) {
    filtered = interactions.filter((interaction) => {
      if (!interaction.dimensions) return false;
      for (const [key, value] of Object.entries(where)) {
        if (interaction.dimensions[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  // Group by composite dimension keys
  const groups = new Map<string, Interaction[]>();

  for (const interaction of filtered) {
    const key = buildCompositeKey(interaction, by);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(interaction);
  }

  // Allocate quota proportionally
  const groupSizes = Array.from(groups.values()).map((g) => g.length);
  const totalSize = groupSizes.reduce((a, b) => a + b, 0);

  if (totalSize === 0) return [];

  const allocations = new Map<string, number>();
  let allocated = 0;

  // First pass: allocate minimum 1 per group if possible
  for (const [key, group] of groups.entries()) {
    if (allocated < n && group.length > 0) {
      allocations.set(key, 1);
      allocated++;
    } else {
      allocations.set(key, 0);
    }
  }

  // Second pass: allocate remaining quota proportionally
  const remaining = n - allocated;
  if (remaining > 0) {
    const groupEntries = Array.from(groups.entries());
    const weights = groupEntries.map(([, group]) => group.length / totalSize);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight > 0) {
      for (let i = 0; i < groupEntries.length && allocated < n; i++) {
        const [key, group] = groupEntries[i];
        const currentAlloc = allocations.get(key) || 0;
        const proportional = Math.floor((weights[i] / totalWeight) * remaining);
        const newAlloc = Math.min(
          currentAlloc + proportional,
          group.length,
          n - allocated + currentAlloc
        );
        allocations.set(key, newAlloc);
        allocated = allocated - currentAlloc + newAlloc;
      }
    }
  }

  // Sample from each group
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;
  const sampled: Interaction[] = [];

  for (const [key, group] of groups.entries()) {
    const count = allocations.get(key) || 0;
    if (count > 0) {
      const selected = sampleFromGroup(group, count, rng);
      sampled.push(...selected);
    }
  }

  return sampled;
}

/**
 * Build composite key from dimension values
 */
function buildCompositeKey(
  interaction: Interaction,
  keys: string[]
): string {
  const values: string[] = [];
  for (const key of keys) {
    const value = interaction.dimensions?.[key] || "__missing__";
    values.push(value);
  }
  return values.join("::");
}

/**
 * Sample n items from a group using Fisher-Yates shuffle
 */
function sampleFromGroup<T>(
  group: T[],
  n: number,
  rng: () => number
): T[] {
  if (n >= group.length) {
    return [...group];
  }

  const shuffled = [...group];
  for (let i = shuffled.length - 1; i > shuffled.length - 1 - n; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(-n);
}

/**
 * Create a seeded random number generator
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

