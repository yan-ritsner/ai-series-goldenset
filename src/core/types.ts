/**
 * Core type definitions for the Golden Dataset Management Tool
 */

export interface RetrievalItem {
  artifactId?: string;
  chunkId?: string;
  snippetText?: string;
  score?: number;
}

export interface Interaction {
  interactionId: string;
  timestamp: string; // ISO string
  input: {
    text: string;
  };
  output?: {
    text: string;
  };
  context?: {
    retrieval?: {
      items: RetrievalItem[];
    };
  };
  dimensions?: Record<string, string>;
  tags?: string[];
  source?: string;
}

export interface Artifact {
  artifactId: string;
  type: string;
  title?: string;
  uri?: string;
  updatedAt?: string; // ISO string
  meta?: Record<string, string | number | boolean>;
}

export interface Label {
  interactionId: string;
  reviewedAt: string; // ISO string
  reviewer: string;
  verdict: "pass" | "fail" | "needs_clarification";
  notes?: string;
  expected?: {
    expectedAnswer?: string;
    mustInclude?: string[];
    mustNotInclude?: string[];
    allowedArtifactIds?: string[];
    blockedArtifactIds?: string[];
  };
}

export interface DatasetVersion {
  name: string;
  createdAt: string; // ISO string
  description?: string;
  interactionIds: string[];
  stats: {
    byDimension: Record<string, Record<string, number>>;
    tagCounts?: Record<string, number>;
  };
}

export interface DatasetMetadata {
  name: string;
  createdAt: string;
  description?: string;
  interactionIds: string[];
  stats: {
    byDimension: Record<string, Record<string, number>>;
    tagCounts?: Record<string, number>;
  };
}

