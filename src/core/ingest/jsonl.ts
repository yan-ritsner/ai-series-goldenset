import { readFile } from "fs/promises";
import { z } from "zod";
import type { Interaction, Artifact, Label } from "../types.js";

// Zod schemas for validation
const RetrievalItemSchema = z.object({
  artifactId: z.string().optional(),
  chunkId: z.string().optional(),
  snippetText: z.string().optional(),
  score: z.number().optional(),
});

const InteractionSchema = z.object({
  interactionId: z.string(),
  timestamp: z.string(),
  input: z.object({
    text: z.string(),
  }),
  output: z
    .object({
      text: z.string(),
    })
    .optional(),
  context: z
    .object({
      retrieval: z
        .object({
          items: z.array(RetrievalItemSchema),
        })
        .optional(),
    })
    .optional(),
  dimensions: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
});

const ArtifactSchema = z.object({
  artifactId: z.string(),
  type: z.string(),
  title: z.string().optional(),
  uri: z.string().optional(),
  updatedAt: z.string().optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const LabelSchema = z.object({
  interactionId: z.string(),
  reviewedAt: z.string(),
  reviewer: z.string(),
  verdict: z.enum(["pass", "fail", "needs_clarification"]),
  notes: z.string().optional(),
  expected: z
    .object({
      expectedAnswer: z.string().optional(),
      mustInclude: z.array(z.string()).optional(),
      mustNotInclude: z.array(z.string()).optional(),
      allowedArtifactIds: z.array(z.string()).optional(),
      blockedArtifactIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export interface ParseError {
  line: number;
  error: string;
  content?: string;
}

export interface ParseResult<T> {
  items: T[];
  errors: ParseError[];
}

/**
 * Parse JSONL file and validate each line
 */
export async function parseJsonl<T>(
  filePath: string,
  schema: z.ZodSchema<T>
): Promise<ParseResult<T>> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  const items: T[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    try {
      const json = JSON.parse(line);
      const result = schema.safeParse(json);

      if (result.success) {
        items.push(result.data);
      } else {
        errors.push({
          line: lineNumber,
          error: result.error.issues.map((e) => e.message).join("; "),
          content: line.substring(0, 100), // First 100 chars for context
        });
      }
    } catch (err) {
      errors.push({
        line: lineNumber,
        error: err instanceof Error ? err.message : "Invalid JSON",
        content: line.substring(0, 100),
      });
    }
  }

  return { items, errors };
}

/**
 * Parse interactions from JSONL file
 */
export async function parseInteractions(
  filePath: string
): Promise<ParseResult<Interaction>> {
  const result = await parseJsonl(filePath, InteractionSchema);
  return result as ParseResult<Interaction>;
}

/**
 * Parse artifacts from JSONL file
 */
export async function parseArtifacts(
  filePath: string
): Promise<ParseResult<Artifact>> {
  const result = await parseJsonl(filePath, ArtifactSchema);
  return result as ParseResult<Artifact>;
}

/**
 * Parse labels from JSONL file
 */
export async function parseLabels(filePath: string): Promise<ParseResult<Label>> {
  return parseJsonl(filePath, LabelSchema);
}

