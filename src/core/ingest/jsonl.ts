import { createReadStream } from "fs";
import { createInterface } from "readline";
import { z } from "zod";
import type { Interaction, Artifact, Label } from "../types.js";

// Zod schemas for validation
// Top-level schemas use looseObject for forward compatibility
// Nested stable shapes use strict object to catch typos

const RetrievalItemSchema = z.looseObject({
  artifactId: z.string().optional(),
  chunkId: z.string().optional(),
  snippetText: z.string().optional(),
  score: z.number().optional(),
});

const InteractionSchema = z.looseObject({
  interactionId: z.string(),
  timestamp: z.iso.datetime(),
  input: z.object({
    text: z.string(),
  }),
  output: z.object({
    text: z.string(),
  }).optional(),
  context: z.looseObject({
    retrieval: z.object({
      items: z.array(RetrievalItemSchema),
    }).optional(),
  }).optional(),
  dimensions: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
});

const ArtifactSchema = z.looseObject({
  artifactId: z.string(),
  type: z.string(),
  title: z.string().optional(),
  uri: z.string().optional(),
  updatedAt: z.iso.datetime().optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const LabelSchema = z.looseObject({
  interactionId: z.string(),
  reviewedAt: z.iso.datetime(),
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

// UTF-8 BOM regex for stripping from first line
const UTF8_BOM_REGEX = /^\uFEFF/;

// Maximum characters of content to include in error messages
const MAX_ERROR_CONTENT_LENGTH = 100;

// Label for root-level validation errors
const ROOT_ERROR_PATH = "<root>";

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
 * Parse JSONL file and validate each line using streaming
 */
export async function parseJsonl<T>(
  filePath: string,
  schema: z.ZodSchema<T>
): Promise<ParseResult<T>> {
  const items: T[] = [];
  const errors: ParseError[] = [];

  const fileStream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  // Handle stream errors
  fileStream.on("error", (e) => {
    errors.push({
      line: lineNumber,
      error: `Read error: ${e.message}`,
    });
  });

  try {
    for await (const line of rl) {
      lineNumber++;
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        continue;
      }

      // Handle UTF-8 BOM on first line
      const normalized =
        lineNumber === 1 ? trimmed.replace(UTF8_BOM_REGEX, "") : trimmed;

      try {
        const json = JSON.parse(normalized);
        const result = schema.safeParse(json);

        if (result.success) {
          items.push(result.data);
        } else {
          errors.push({
            line: lineNumber,
            error: result.error.issues
              .map((e) => `${e.path.join(".") || ROOT_ERROR_PATH}: ${e.message}`)
              .join("; "),
            content: normalized.substring(0, MAX_ERROR_CONTENT_LENGTH),
          });
        }
      } catch (err) {
        errors.push({
          line: lineNumber,
          error: err instanceof Error ? err.message : "Invalid JSON",
          content: normalized.substring(0, MAX_ERROR_CONTENT_LENGTH),
        });
      }
    }
  } finally {
    // Ensure cleanup
    rl.close();
    fileStream.destroy();
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

