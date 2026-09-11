import { neon } from "@neondatabase/serverless";
import type { MapSnapshot } from "@/lib/store/mapSnapshot";

// One row per named map — the whole session (source/target trees, mappings,
// globals, loop rules, sample payload) lives in a single JSONB column rather than
// being normalized across tables. It's fundamentally a nested document (trees,
// edges, rules), not relational data, and this is the only shape that ever needs
// to move as a unit (load a map = read one row; save = write one row).
// gen_random_uuid() is a core Postgres 13+ builtin (no pgcrypto/uuid-ossp extension
// needed) — Neon's driver also rejects multiple statements in one query, so this
// stays a single CREATE TABLE rather than an extension statement plus a table one.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS mapping_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export interface MapSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapRecord extends MapSummary {
  data: MapSnapshot;
}

export class MapNameConflictError extends Error {}
export class MapNotFoundError extends Error {}

type SqlClient = ReturnType<typeof neon>;

function sql(): SqlClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — add it to .env.local to enable saved maps.");
  }
  return neon(connectionString);
}

// Lazy, idempotent — runs before every query rather than as a separate migration
// step, matching this tool's no-build-pipeline / no-ops-step philosophy. Cheap:
// CREATE ... IF NOT EXISTS is a no-op after the first call.
let schemaReady: Promise<void> | null = null;
function ensureSchema(client: SqlClient): Promise<void> {
  if (!schemaReady) schemaReady = client.query(SCHEMA_SQL).then(() => undefined);
  return schemaReady;
}

interface Row {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function toSummary(row: Row): MapSummary {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listMaps(): Promise<MapSummary[]> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(
    `SELECT id, name, created_at, updated_at FROM mapping_documents ORDER BY updated_at DESC`
  )) as Row[];
  return rows.map(toSummary);
}

export async function getMap(id: string): Promise<MapRecord> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`SELECT id, name, data, created_at, updated_at FROM mapping_documents WHERE id = $1`, [
    id,
  ])) as (Row & { data: MapSnapshot })[];
  if (rows.length === 0) throw new MapNotFoundError(`No saved map with id "${id}".`);
  const [row] = rows;
  return { ...toSummary(row), data: row.data };
}

export async function createMap(name: string, data: MapSnapshot): Promise<MapSummary> {
  const client = sql();
  await ensureSchema(client);
  try {
    const rows = (await client.query(
      `INSERT INTO mapping_documents (name, data) VALUES ($1, $2::jsonb) RETURNING id, name, created_at, updated_at`,
      [name, JSON.stringify(data)]
    )) as Row[];
    return toSummary(rows[0]);
  } catch (e) {
    if (e instanceof Error && /unique/i.test(e.message)) {
      throw new MapNameConflictError(`A saved map named "${name}" already exists.`);
    }
    throw e;
  }
}

export async function updateMap(id: string, updates: { name?: string; data?: MapSnapshot }): Promise<MapSummary> {
  const client = sql();
  await ensureSchema(client);
  try {
    const rows = (await client.query(
      `UPDATE mapping_documents
       SET name = COALESCE($2, name), data = COALESCE($3::jsonb, data), updated_at = now()
       WHERE id = $1
       RETURNING id, name, created_at, updated_at`,
      [id, updates.name ?? null, updates.data ? JSON.stringify(updates.data) : null]
    )) as Row[];
    if (rows.length === 0) throw new MapNotFoundError(`No saved map with id "${id}".`);
    return toSummary(rows[0]);
  } catch (e) {
    if (e instanceof MapNotFoundError) throw e;
    if (e instanceof Error && /unique/i.test(e.message)) {
      throw new MapNameConflictError(`A saved map named "${updates.name}" already exists.`);
    }
    throw e;
  }
}

export async function deleteMap(id: string): Promise<void> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`DELETE FROM mapping_documents WHERE id = $1 RETURNING id`, [id])) as { id: string }[];
  if (rows.length === 0) throw new MapNotFoundError(`No saved map with id "${id}".`);
}
