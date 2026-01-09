import Database from "better-sqlite3";
import { join } from "path";
import type {
  Interaction,
  Artifact,
  Label,
  DatasetVersion,
} from "../types.js";

export class SQLiteStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Artifacts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        artifactId TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT,
        uri TEXT,
        updatedAt TEXT,
        meta TEXT
      )
    `);

    // Interactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        interactionId TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT,
        context TEXT,
        dimensions TEXT,
        tags TEXT,
        source TEXT
      )
    `);

    // Labels table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS labels (
        interactionId TEXT PRIMARY KEY,
        reviewedAt TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        verdict TEXT NOT NULL,
        notes TEXT,
        expected TEXT,
        FOREIGN KEY (interactionId) REFERENCES interactions(interactionId)
      )
    `);

    // Dataset versions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dataset_versions (
        name TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        description TEXT,
        interactionIds TEXT NOT NULL,
        stats TEXT NOT NULL
      )
    `);

    // Indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_interactions_source ON interactions(source);
    `);
  }

  // Artifact operations
  upsertArtifact(artifact: Artifact): void {
    const stmt = this.db.prepare(`
      INSERT INTO artifacts (artifactId, type, title, uri, updatedAt, meta)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(artifactId) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        uri = excluded.uri,
        updatedAt = excluded.updatedAt,
        meta = excluded.meta
    `);

    stmt.run(
      artifact.artifactId,
      artifact.type,
      artifact.title || null,
      artifact.uri || null,
      artifact.updatedAt || null,
      artifact.meta ? JSON.stringify(artifact.meta) : null
    );
  }

  getArtifact(artifactId: string): Artifact | null {
    const row = this.db
      .prepare("SELECT * FROM artifacts WHERE artifactId = ?")
      .get(artifactId) as any;

    if (!row) return null;

    return {
      artifactId: row.artifactId,
      type: row.type,
      title: row.title || undefined,
      uri: row.uri || undefined,
      updatedAt: row.updatedAt || undefined,
      meta: row.meta ? JSON.parse(row.meta) : undefined,
    };
  }

  // Interaction operations
  upsertInteraction(interaction: Interaction): void {
    const stmt = this.db.prepare(`
      INSERT INTO interactions (interactionId, timestamp, input, output, context, dimensions, tags, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(interactionId) DO UPDATE SET
        timestamp = excluded.timestamp,
        input = excluded.input,
        output = excluded.output,
        context = excluded.context,
        dimensions = excluded.dimensions,
        tags = excluded.tags,
        source = excluded.source
    `);

    stmt.run(
      interaction.interactionId,
      interaction.timestamp,
      JSON.stringify(interaction.input),
      interaction.output ? JSON.stringify(interaction.output) : null,
      interaction.context ? JSON.stringify(interaction.context) : null,
      interaction.dimensions ? JSON.stringify(interaction.dimensions) : null,
      interaction.tags ? JSON.stringify(interaction.tags) : null,
      interaction.source || null
    );
  }

  getInteraction(interactionId: string): Interaction | null {
    const row = this.db
      .prepare("SELECT * FROM interactions WHERE interactionId = ?")
      .get(interactionId) as any;

    if (!row) return null;

    return {
      interactionId: row.interactionId,
      timestamp: row.timestamp,
      input: JSON.parse(row.input),
      output: row.output ? JSON.parse(row.output) : undefined,
      context: row.context ? JSON.parse(row.context) : undefined,
      dimensions: row.dimensions ? JSON.parse(row.dimensions) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      source: row.source || undefined,
    };
  }

  getInteractions(interactionIds: string[]): Interaction[] {
    if (interactionIds.length === 0) return [];

    const placeholders = interactionIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT * FROM interactions WHERE interactionId IN (${placeholders})`)
      .all(...interactionIds) as any[];

    return rows.map((row) => ({
      interactionId: row.interactionId,
      timestamp: row.timestamp,
      input: JSON.parse(row.input),
      output: row.output ? JSON.parse(row.output) : undefined,
      context: row.context ? JSON.parse(row.context) : undefined,
      dimensions: row.dimensions ? JSON.parse(row.dimensions) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      source: row.source || undefined,
    }));
  }

  getAllInteractions(where?: Record<string, string>): Interaction[] {
    let query = "SELECT * FROM interactions";
    const conditions: string[] = [];
    const values: any[] = [];

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        conditions.push(`json_extract(dimensions, '$.${key}') = ?`);
        values.push(value);
      }
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
    }

    const rows = this.db.prepare(query).all(...values) as any[];

    return rows.map((row) => ({
      interactionId: row.interactionId,
      timestamp: row.timestamp,
      input: JSON.parse(row.input),
      output: row.output ? JSON.parse(row.output) : undefined,
      context: row.context ? JSON.parse(row.context) : undefined,
      dimensions: row.dimensions ? JSON.parse(row.dimensions) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      source: row.source || undefined,
    }));
  }

  // Label operations
  upsertLabel(label: Label): void {
    const stmt = this.db.prepare(`
      INSERT INTO labels (interactionId, reviewedAt, reviewer, verdict, notes, expected)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(interactionId) DO UPDATE SET
        reviewedAt = excluded.reviewedAt,
        reviewer = excluded.reviewer,
        verdict = excluded.verdict,
        notes = excluded.notes,
        expected = excluded.expected
    `);

    stmt.run(
      label.interactionId,
      label.reviewedAt,
      label.reviewer,
      label.verdict,
      label.notes || null,
      label.expected ? JSON.stringify(label.expected) : null
    );
  }

  getLabel(interactionId: string): Label | null {
    const row = this.db
      .prepare("SELECT * FROM labels WHERE interactionId = ?")
      .get(interactionId) as any;

    if (!row) return null;

    return {
      interactionId: row.interactionId,
      reviewedAt: row.reviewedAt,
      reviewer: row.reviewer,
      verdict: row.verdict as "pass" | "fail" | "needs_clarification",
      notes: row.notes || undefined,
      expected: row.expected ? JSON.parse(row.expected) : undefined,
    };
  }

  getLabels(interactionIds: string[]): Label[] {
    if (interactionIds.length === 0) return [];

    const placeholders = interactionIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT * FROM labels WHERE interactionId IN (${placeholders})`)
      .all(...interactionIds) as any[];

    return rows.map((row) => ({
      interactionId: row.interactionId,
      reviewedAt: row.reviewedAt,
      reviewer: row.reviewer,
      verdict: row.verdict as "pass" | "fail" | "needs_clarification",
      notes: row.notes || undefined,
      expected: row.expected ? JSON.parse(row.expected) : undefined,
    }));
  }

  // Dataset version operations
  createDatasetVersion(version: DatasetVersion): void {
    const stmt = this.db.prepare(`
      INSERT INTO dataset_versions (name, createdAt, description, interactionIds, stats)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      version.name,
      version.createdAt,
      version.description || null,
      JSON.stringify(version.interactionIds),
      JSON.stringify(version.stats)
    );
  }

  getDatasetVersion(name: string): DatasetVersion | null {
    const row = this.db
      .prepare("SELECT * FROM dataset_versions WHERE name = ?")
      .get(name) as any;

    if (!row) return null;

    return {
      name: row.name,
      createdAt: row.createdAt,
      description: row.description || undefined,
      interactionIds: JSON.parse(row.interactionIds),
      stats: JSON.parse(row.stats),
    };
  }

  listDatasetVersions(): Array<{
    name: string;
    createdAt: string;
    description?: string;
    interactionCount: number;
  }> {
    const rows = this.db
      .prepare("SELECT name, createdAt, description, interactionIds FROM dataset_versions ORDER BY createdAt DESC")
      .all() as any[];

    return rows.map((row) => ({
      name: row.name,
      createdAt: row.createdAt,
      description: row.description || undefined,
      interactionCount: JSON.parse(row.interactionIds).length,
    }));
  }

  close(): void {
    this.db.close();
  }
}

