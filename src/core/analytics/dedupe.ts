import type { Interaction } from "../types.js";
import { hashInteraction } from "../../util/hash.js";

/**
 * Remove exact duplicates based on input text hash
 */
export function dedupeExact(interactions: Interaction[]): Interaction[] {
  const seen = new Set<string>();
  const deduped: Interaction[] = [];

  for (const interaction of interactions) {
    const hash = hashInteraction(interaction);
    if (!seen.has(hash)) {
      seen.add(hash);
      deduped.push(interaction);
    }
  }

  return deduped;
}

