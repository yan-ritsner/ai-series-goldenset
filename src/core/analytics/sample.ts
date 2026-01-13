import type { Interaction } from "../types.js";

export interface SampleOptions {
  n: number;
  by: string[];
  where?: Record<string, string>;
  seed?: number;

  /**
   * Optional: enforce a minimum number of samples per group (coverage-first).
   * Set to 0 for purely proportional sampling.
   * Default: 1 (matches your previous intent).
   */
  minPerGroup?: number;
}

/**
 * Stratified sampling across dimension keys.
 *
 * Guarantees:
 * - Deterministic when `seed` is provided (independent of input order).
 * - Returns exactly `n` items when possible (i.e. filtered.length >= n).
 * - Allocation is proportional by group size, with optional `minPerGroup` coverage.
 * - Never allocates more than a group contains.
 */
export function stratifiedSample(
  interactions: Interaction[],
  options: SampleOptions
): Interaction[] {
  const { n, by, where, seed, minPerGroup = 1 } = options;

  // Filter by where clause if provided
  const filtered =
    where && Object.keys(where).length > 0
      ? interactions.filter((interaction) => {
        const dims = interaction.dimensions;
        if (!dims) return false;
        for (const [k, v] of Object.entries(where)) {
          if (dims[k] !== v) return false;
        }
        return true;
      })
      : interactions;

  if (n <= 0 || filtered.length === 0) return [];

  // Group by composite dimension keys
  const groups = new Map<string, Interaction[]>();
  for (const interaction of filtered) {
    const key = buildCompositeKey(interaction, by);
    const arr = groups.get(key);
    if (arr) arr.push(interaction);
    else groups.set(key, [interaction]);
  }

  // Determinism: sort group keys, and sort each group by a stable key.
  // (If interactionId isn't guaranteed unique, this still provides stability.)
  const groupKeys = Array.from(groups.keys()).sort();
  for (const key of groupKeys) {
    groups.get(key)!.sort((a, b) =>
      (a.interactionId ?? "").localeCompare(b.interactionId ?? "")
    );
  }

  const totalAvailable = filtered.length;
  const target = Math.min(n, totalAvailable);

  // Allocation per group (proportional + largest remainder), capped by capacity
  const allocations = allocateQuotas(groups, groupKeys, target, minPerGroup);

  // Sample from each group using deterministic RNG
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const sampled: Interaction[] = [];

  for (const key of groupKeys) {
    const group = groups.get(key)!;
    const count = allocations.get(key) ?? 0;
    if (count <= 0) continue;

    // Deterministic per-group sampling: shuffle copy with shared RNG
    // (Because group order is stable, this is stable across runs.)
    sampled.push(...sampleFromGroup(group, count, rng));
  }

  // Safety: if due to capping we somehow sampled less than target, top up
  // from remaining capacity deterministically.
  if (sampled.length < target) {
    const need = target - sampled.length;
    sampled.push(...topUp(groups, groupKeys, allocations, need, rng));
  }

  // If sampled > target (shouldn't happen), trim deterministically
  if (sampled.length > target) {
    sampled.length = target;
  }

  return sampled;
}

/**
 * Build composite key from dimension values.
 * Use JSON.stringify to avoid delimiter collisions.
 */
function buildCompositeKey(interaction: Interaction, keys: string[]): string {
  const values = keys.map((k) => interaction.dimensions?.[k] ?? "__missing__");
  return JSON.stringify(values);
}

/**
 * Allocate quotas across groups:
 * 1) optional minPerGroup (coverage)
 * 2) proportional distribution of remaining via largest remainder
 * 3) final top-up to hit exact target while respecting group capacity
 */
function allocateQuotas(
  groups: Map<string, Interaction[]>,
  groupKeys: string[],
  target: number,
  minPerGroup: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  // Start with 0
  for (const key of groupKeys) allocations.set(key, 0);

  // 1) Min-per-group pass (coverage-first), respecting capacity
  if (minPerGroup > 0) {
    // Only groups with at least 1 item
    const eligible = groupKeys.filter((k) => (groups.get(k)?.length ?? 0) > 0);

    // If we can't give minPerGroup to all eligible, give 1 in deterministic order until we run out.
    // (This matches "if possible" semantics.)
    const maxMinTotal = eligible.reduce(
      (sum, k) => sum + Math.min(minPerGroup, groups.get(k)!.length),
      0
    );
    const minBudget = Math.min(target, maxMinTotal);

    let used = 0;
    for (const k of eligible) {
      if (used >= minBudget) break;
      const cap = groups.get(k)!.length;
      const give = Math.min(minPerGroup, cap, minBudget - used);
      if (give > 0) {
        allocations.set(k, give);
        used += give;
      }
    }
  }

  // Remaining quota after mins
  let allocated = sumAllocations(allocations, groupKeys);
  let remaining = target - allocated;
  if (remaining <= 0) return allocations;

  // 2) Proportional allocation of remaining quota (largest remainder)
  const totalSize = groupKeys.reduce((sum, k) => sum + groups.get(k)!.length, 0);

  // If totalSize is 0, nothing to do
  if (totalSize === 0) return allocations;

  // Compute exact shares for remaining based on group sizes,
  // but limited by remaining capacity in each group.
  type Share = {
    key: string;
    floor: number;
    frac: number;
    capacityLeft: number;
  };

  const shares: Share[] = groupKeys.map((k) => {
    const size = groups.get(k)!.length;
    const current = allocations.get(k) ?? 0;
    const capacityLeft = Math.max(0, size - current);
    if (capacityLeft === 0) {
      return { key: k, floor: 0, frac: 0, capacityLeft: 0 };
    }

    const exact = (size / totalSize) * remaining;
    const fl = Math.floor(exact);
    const floored = Math.min(fl, capacityLeft);
    const frac = exact - fl;
    return { key: k, floor: floored, frac, capacityLeft };
  });

  // Apply floors
  for (const s of shares) {
    if (s.floor > 0) {
      allocations.set(s.key, (allocations.get(s.key) ?? 0) + s.floor);
      remaining -= s.floor;
    }
  }

  if (remaining <= 0) return allocations;

  // Distribute leftovers by largest fractional remainder, respecting capacity
  shares.sort((a, b) => {
    // Higher frac first; tie-break by key for determinism
    if (b.frac !== a.frac) return b.frac - a.frac;
    return a.key.localeCompare(b.key);
  });

  let idx = 0;
  while (remaining > 0 && idx < shares.length) {
    const s = shares[idx];
    const size = groups.get(s.key)!.length;
    const cur = allocations.get(s.key) ?? 0;
    if (cur < size) {
      allocations.set(s.key, cur + 1);
      remaining--;
    } else {
      idx++;
    }
    // When we reach end, restart once more in case earlier groups filled up during loop
    if (idx >= shares.length && remaining > 0) idx = 0;

    // Stop if no one has capacity (prevents infinite loop)
    if (!hasAnyCapacity(groups, groupKeys, allocations)) break;
  }

  // 3) Final safety top-up if still short (capacity may have prevented remainder dist)
  allocated = sumAllocations(allocations, groupKeys);
  remaining = target - allocated;
  if (remaining > 0) {
    // Deterministic order: by key
    for (const k of groupKeys) {
      if (remaining <= 0) break;
      const size = groups.get(k)!.length;
      const cur = allocations.get(k) ?? 0;
      const capLeft = size - cur;
      if (capLeft <= 0) continue;

      const give = Math.min(capLeft, remaining);
      allocations.set(k, cur + give);
      remaining -= give;
    }
  }

  return allocations;
}

function sumAllocations(
  allocations: Map<string, number>,
  keys: string[]
): number {
  let sum = 0;
  for (const k of keys) sum += allocations.get(k) ?? 0;
  return sum;
}

function hasAnyCapacity(
  groups: Map<string, Interaction[]>,
  keys: string[],
  allocations: Map<string, number>
): boolean {
  for (const k of keys) {
    const size = groups.get(k)!.length;
    const cur = allocations.get(k) ?? 0;
    if (cur < size) return true;
  }
  return false;
}

/**
 * Sample n items from a group using Fisher-Yates shuffle (deterministic with rng).
 * Returns the first n after a partial shuffle of the prefix.
 */
function sampleFromGroup<T>(group: T[], n: number, rng: () => number): T[] {
  if (n >= group.length) return [...group];

  const arr = [...group];
  // Shuffle only first n positions
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/**
 * Top up sample if we're short due to capacity caps.
 * Picks additional items deterministically from groups with remaining capacity.
 */
function topUp(
  groups: Map<string, Interaction[]>,
  groupKeys: string[],
  allocations: Map<string, number>,
  need: number,
  rng: () => number
): Interaction[] {
  const extras: Interaction[] = [];
  if (need <= 0) return extras;

  for (const k of groupKeys) {
    if (need <= 0) break;

    const group = groups.get(k)!;
    const current = allocations.get(k) ?? 0;
    if (current >= group.length) continue;

    const remainingCandidates = group.slice(current);
    const take = Math.min(need, remainingCandidates.length);

    extras.push(...sampleFromGroup(remainingCandidates, take, rng));

    allocations.set(k, current + take); // ✅ critical
    need -= take;
  }

  return extras;
}

/**
 * A better seeded RNG than the simple LCG you had.
 * Deterministic, fast, and commonly used.
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
