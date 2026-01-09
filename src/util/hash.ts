import { createHash } from "crypto";

/**
 * Generate a hash for exact deduplication
 */
export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Hash an interaction's input text for deduplication
 */
export function hashInteraction(interaction: { input: { text: string } }): string {
  return hashString(interaction.input.text.trim().toLowerCase());
}

