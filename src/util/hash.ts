import { createHash } from "crypto";

/**
 * Generate a hash for exact deduplication
 */
export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Hash an interaction for deduplication.
 *
 * Deduplication policy (v1):
 * - Based on `input.text` only
 * - Case-insensitive
 * - Trims surrounding whitespace
 *
 * Intentionally ignored:
 * - output text
 * - retrieval artifacts
 * - metadata and timestamps
 *
 * Rationale:
 * We want to deduplicate prompts while preserving
 * coverage over responses and context.
 */
export function hashInteraction(interaction: { input: { text: string } }): string {
  return hashString(interaction.input.text.trim().toLowerCase());
}

