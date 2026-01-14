/**
 * Sanitize version name for filesystem
 * Replaces "/" with "_" to create valid directory names
 */
export function sanitizeVersionName(name: string): string {
  return name.replace(/\//g, "_");
}
