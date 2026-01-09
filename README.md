# Golden Dataset Management Tool ("goldenset")

An open-source tool to **curate, sample, label, version, and export** "golden datasets" for AI/LLM systems.

**Core value:** Dataset governance and repeatability (coverage, drift sampling, versioned snapshots).

## Purpose

`goldenset` helps you maintain high-quality, representative datasets for your AI systems by providing:

- **Coverage visibility** - Understand what's in your dataset across dimensions
- **Stratified sampling** - Generate representative samples for labeling
- **Versioned snapshots** - Immutable, reproducible dataset versions
- **Data interoperability** - Export to any evaluation stack via JSONL

## What This Tool Is Not

This tool is **not**:
- An evaluator, scoring, or judging system
- An observability or monitoring platform
- A prompt testing framework
- A SaaS hosting solution
- A chatbot platform

## Target Users

**Primary:** Staff/Senior/Platform Engineers responsible for shipping and maintaining internal AI assistants who need reproducible datasets, coverage visibility, controlled dataset evolution, and exports to any eval stack.

**Secondary:** Applied AI/ML Engineers (consume exports), PMs/Leadership (consume stats + changelog).

## Design Principles

- **Generic core** via extensible **dimensions** (`Record<string,string>`)
- **Use-case presets** live under `/examples/*` (schemas + dimension vocabularies + sample data)
- **CLI-first** for MVP; optional local UI later
- **Data interoperability** via **JSONL**
- **Local-first** with **SQLite** as primary store (plus folder artifacts for published versions)

## Core Concepts

### Dimensions

`dimensions: Record<string,string>` attached to interactions. The tool treats dimension keys as opaque strings; presets may define allowed vocabularies.

### Artifact

A generic referenced item in retrieval context (doc, wiki, ticket, runbook, etc.).

**Schema:**
- `artifactId: string` (stable, unique; recommended prefix like `doc:`)
- `type: string` (e.g. `doc`, `wiki`, `ticket`)
- `title?: string`
- `uri?: string`
- `updatedAt?: ISO string`
- `meta?: Record<string, string | number | boolean>`

### Interaction

The primary unit ingested and sampled.

**Schema:**
- `interactionId: string`
- `timestamp: ISO string`
- `input: { text: string }`
- `output?: { text: string }`
- `context?: { retrieval?: { items: RetrievalItem[] } }`
- `dimensions?: Record<string,string>`
- `tags?: string[]`
- `source?: string` (e.g. `synthetic`, `logs`)

### Label

Human review attached to an interaction.

**Schema:**
- `interactionId: string`
- `reviewedAt: ISO string`
- `reviewer: string` (or `anonymous`)
- `verdict: "pass" | "fail" | "needs_clarification"`
- `notes?: string`
- `expected?: { expectedAnswer?, mustInclude?, mustNotInclude?, allowedArtifactIds?, blockedArtifactIds? }`

### Dataset Version

A named immutable snapshot of selected interactions (+ labels) with stats.

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
# Initialize the tool
goldenset init

# Ingest interactions
goldenset ingest interactions examples/internal-docs/interactions.jsonl

# View statistics
goldenset stats

# Generate a stratified sample
goldenset sample --n 200 --by intent,department --out sample.jsonl

# Create label template
goldenset label template --in sample.jsonl --out labels.jsonl

# Publish a versioned dataset
goldenset publish --name golden/v1 --sample sample.jsonl --labels labels.jsonl

# List versions
goldenset versions list

# Export a version
goldenset export --name golden/v1 --out golden_v1.jsonl
```

## CLI Commands

### Initialization

```bash
goldenset init
```

Creates `.goldenset/` directory and SQLite database.

### Ingest

```bash
goldenset ingest interactions <file.jsonl> [--upsert]
goldenset ingest artifacts <file.jsonl> [--upsert]
```

Validates and stores JSONL data in SQLite.

### Stats / Coverage

```bash
goldenset stats [--by key1,key2,...] [--where key=value,...]
```

Displays counts by dimension value and top tags.

### Sampling

```bash
goldenset sample --n 200 --by intent,department --out sample.jsonl [--where key=value,...] [--dedupe exact] [--seed 42]
```

Stratified sampling across specified dimension keys. Produces JSONL of selected interactions.

### Label Template

```bash
goldenset label template --in sample.jsonl --out labels.jsonl
```

Generates a JSONL template with verdict set to `needs_clarification` and empty notes for manual editing.

### Publish

```bash
goldenset publish --name golden/v1 --sample sample.jsonl --labels labels.jsonl [--desc "..."]
```

Validates, computes stats, and writes immutable dataset version to `datasets/golden_v1/`.

### Version Management

```bash
goldenset versions list
goldenset versions show <name>
```

List and inspect published dataset versions.

### Export

```bash
goldenset export --name golden/v1 --out golden_v1.jsonl [--format jsonl]
```

Exports interactions and labels in JSONL format.

## Storage Model

### Primary Store (SQLite)

Local database at `.goldenset/db.sqlite` stores:
- Artifacts
- Interactions
- Labels
- Dataset versions

### Published Artifacts

On publish, creates a folder per version:

```
datasets/
  golden_v1/
    dataset.json
    interactions.jsonl
    labels.jsonl
    stats.json
    changelog.md
```

These outputs are shareable and git-friendly.

## Example Presets

See `examples/internal-docs/` for a complete example with:
- Dimension vocabulary (`dimensions.json`)
- Sample artifacts (`artifacts.jsonl`)
- Sample interactions (`interactions.jsonl`)

## License

MIT

## Contributing

This tool uses only synthetic or public data in examples. No references to employer or confidential systems.

