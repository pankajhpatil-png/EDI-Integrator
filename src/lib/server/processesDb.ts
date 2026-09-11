import { neon } from "@neondatabase/serverless";
import type { ProcessDefinition } from "@/lib/orchestration/types";

// One row per named process — same single-JSONB-document shape as mapping_documents
// (a process definition is a nested nodes/edges document, not relational data that
// needs cross-process querying, unlike Trading Partners).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export interface ProcessSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessRecord extends ProcessSummary {
  definition: ProcessDefinition;
}

export class ProcessNameConflictError extends Error {}
export class ProcessNotFoundError extends Error {}

type SqlClient = ReturnType<typeof neon>;

function sql(): SqlClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set — add it to .env.local to enable saved processes.");
  return neon(connectionString);
}

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

function toSummary(row: Row): ProcessSummary {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listProcesses(): Promise<ProcessSummary[]> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`SELECT id, name, created_at, updated_at FROM processes ORDER BY updated_at DESC`)) as Row[];
  return rows.map(toSummary);
}

export async function getProcess(id: string): Promise<ProcessRecord> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`SELECT id, name, definition, created_at, updated_at FROM processes WHERE id = $1`, [
    id,
  ])) as (Row & { definition: ProcessDefinition })[];
  if (rows.length === 0) throw new ProcessNotFoundError(`No saved process with id "${id}".`);
  const [row] = rows;
  return { ...toSummary(row), definition: row.definition };
}

export async function createProcess(name: string, definition: ProcessDefinition): Promise<ProcessSummary> {
  const client = sql();
  await ensureSchema(client);
  try {
    const rows = (await client.query(
      `INSERT INTO processes (name, definition) VALUES ($1, $2::jsonb) RETURNING id, name, created_at, updated_at`,
      [name, JSON.stringify(definition)]
    )) as Row[];
    return toSummary(rows[0]);
  } catch (e) {
    if (e instanceof Error && /unique/i.test(e.message)) throw new ProcessNameConflictError(`A saved process named "${name}" already exists.`);
    throw e;
  }
}

export async function updateProcess(id: string, updates: { name?: string; definition?: ProcessDefinition }): Promise<ProcessSummary> {
  const client = sql();
  await ensureSchema(client);
  try {
    const rows = (await client.query(
      `UPDATE processes
       SET name = COALESCE($2, name), definition = COALESCE($3::jsonb, definition), updated_at = now()
       WHERE id = $1
       RETURNING id, name, created_at, updated_at`,
      [id, updates.name ?? null, updates.definition ? JSON.stringify(updates.definition) : null]
    )) as Row[];
    if (rows.length === 0) throw new ProcessNotFoundError(`No saved process with id "${id}".`);
    return toSummary(rows[0]);
  } catch (e) {
    if (e instanceof ProcessNotFoundError) throw e;
    if (e instanceof Error && /unique/i.test(e.message)) throw new ProcessNameConflictError(`A saved process named "${updates.name}" already exists.`);
    throw e;
  }
}

export async function deleteProcess(id: string): Promise<void> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`DELETE FROM processes WHERE id = $1 RETURNING id`, [id])) as { id: string }[];
  if (rows.length === 0) throw new ProcessNotFoundError(`No saved process with id "${id}".`);
}
