import { neon } from "@neondatabase/serverless";

// Real relational tables here (unlike mapping_documents' single-JSONB-blob shape)
// because Trading Partners genuinely has relational structure — retailers link to
// many suppliers, relationships have their own document-type assignments, and the
// envelope-identifier lookup (findRelationshipByEnvelope) needs to query across
// parties/relationships, not just fetch one document by id.
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS trading_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('retailer','supplier')),
    isa_qualifier TEXT,
    isa_id TEXT,
    gs_code TEXT,
    usage_indicator TEXT CHECK (usage_indicator IN ('T','P')),
    unb_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS partner_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL REFERENCES trading_partners(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES trading_partners(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (retailer_id, supplier_id)
  )`,
  `CREATE TABLE IF NOT EXISTS relationship_document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES partner_relationships(id) ON DELETE CASCADE,
    standard TEXT NOT NULL,
    transaction_code TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (relationship_id, standard, transaction_code, direction)
  )`,
];

export type PartnerRole = "retailer" | "supplier";
export type UsageIndicator = "T" | "P";
export type DocDirection = "inbound" | "outbound";

export interface TradingPartner {
  id: string;
  name: string;
  role: PartnerRole;
  isaQualifier: string | null;
  isaId: string | null;
  gsCode: string | null;
  usageIndicator: UsageIndicator | null;
  unbId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerRelationship {
  id: string;
  retailerId: string;
  supplierId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipDocumentType {
  id: string;
  relationshipId: string;
  standard: string;
  transactionCode: string;
  direction: DocDirection;
}

export class PartnerNotFoundError extends Error {}
export class RelationshipNotFoundError extends Error {}
export class DuplicateRelationshipError extends Error {}

type SqlClient = ReturnType<typeof neon>;

function sql(): SqlClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — add it to .env.local to enable Trading Partners.");
  }
  return neon(connectionString);
}

let schemaReady: Promise<void> | null = null;
async function ensureSchema(client: SqlClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const statement of SCHEMA_STATEMENTS) await client.query(statement);
    })();
  }
  return schemaReady;
}

interface PartnerRow {
  id: string;
  name: string;
  role: PartnerRole;
  isa_qualifier: string | null;
  isa_id: string | null;
  gs_code: string | null;
  usage_indicator: UsageIndicator | null;
  unb_id: string | null;
  created_at: string;
  updated_at: string;
}

function toPartner(row: PartnerRow): TradingPartner {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    isaQualifier: row.isa_qualifier,
    isaId: row.isa_id,
    gsCode: row.gs_code,
    usageIndicator: row.usage_indicator,
    unbId: row.unb_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface RelationshipRow {
  id: string;
  retailer_id: string;
  supplier_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function toRelationship(row: RelationshipRow): PartnerRelationship {
  return {
    id: row.id,
    retailerId: row.retailer_id,
    supplierId: row.supplier_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface DocTypeRow {
  id: string;
  relationship_id: string;
  standard: string;
  transaction_code: string;
  direction: DocDirection;
}

function toDocType(row: DocTypeRow): RelationshipDocumentType {
  return { id: row.id, relationshipId: row.relationship_id, standard: row.standard, transactionCode: row.transaction_code, direction: row.direction };
}

export interface PartnerInput {
  name: string;
  role: PartnerRole;
  isaQualifier?: string | null;
  isaId?: string | null;
  gsCode?: string | null;
  usageIndicator?: UsageIndicator | null;
  unbId?: string | null;
}

export async function listPartners(role?: PartnerRole): Promise<TradingPartner[]> {
  const client = sql();
  await ensureSchema(client);
  const rows = (role
    ? await client.query(`SELECT * FROM trading_partners WHERE role = $1 ORDER BY name`, [role])
    : await client.query(`SELECT * FROM trading_partners ORDER BY name`)) as PartnerRow[];
  return rows.map(toPartner);
}

export async function getPartner(id: string): Promise<TradingPartner> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`SELECT * FROM trading_partners WHERE id = $1`, [id])) as PartnerRow[];
  if (rows.length === 0) throw new PartnerNotFoundError(`No trading partner with id "${id}".`);
  return toPartner(rows[0]);
}

export async function createPartner(input: PartnerInput): Promise<TradingPartner> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(
    `INSERT INTO trading_partners (name, role, isa_qualifier, isa_id, gs_code, usage_indicator, unb_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [input.name, input.role, input.isaQualifier ?? null, input.isaId ?? null, input.gsCode ?? null, input.usageIndicator ?? null, input.unbId ?? null]
  )) as PartnerRow[];
  return toPartner(rows[0]);
}

export async function updatePartner(id: string, input: Partial<PartnerInput>): Promise<TradingPartner> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(
    `UPDATE trading_partners SET
       name = COALESCE($2, name),
       isa_qualifier = COALESCE($3, isa_qualifier),
       isa_id = COALESCE($4, isa_id),
       gs_code = COALESCE($5, gs_code),
       usage_indicator = COALESCE($6, usage_indicator),
       unb_id = COALESCE($7, unb_id),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, input.name ?? null, input.isaQualifier ?? null, input.isaId ?? null, input.gsCode ?? null, input.usageIndicator ?? null, input.unbId ?? null]
  )) as PartnerRow[];
  if (rows.length === 0) throw new PartnerNotFoundError(`No trading partner with id "${id}".`);
  return toPartner(rows[0]);
}

export async function deletePartner(id: string): Promise<void> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`DELETE FROM trading_partners WHERE id = $1 RETURNING id`, [id])) as { id: string }[];
  if (rows.length === 0) throw new PartnerNotFoundError(`No trading partner with id "${id}".`);
}

export interface RelationshipWithPartners extends PartnerRelationship {
  retailer: TradingPartner;
  supplier: TradingPartner;
  documentTypes: RelationshipDocumentType[];
}

export async function listRelationships(filter: { retailerId?: string; supplierId?: string } = {}): Promise<RelationshipWithPartners[]> {
  const client = sql();
  await ensureSchema(client);

  let rows: RelationshipRow[];
  if (filter.retailerId) {
    rows = (await client.query(`SELECT * FROM partner_relationships WHERE retailer_id = $1 ORDER BY created_at`, [filter.retailerId])) as RelationshipRow[];
  } else if (filter.supplierId) {
    rows = (await client.query(`SELECT * FROM partner_relationships WHERE supplier_id = $1 ORDER BY created_at`, [filter.supplierId])) as RelationshipRow[];
  } else {
    rows = (await client.query(`SELECT * FROM partner_relationships ORDER BY created_at`)) as RelationshipRow[];
  }

  const results: RelationshipWithPartners[] = [];
  for (const row of rows) {
    const rel = toRelationship(row);
    const [retailer, supplier, docTypes] = await Promise.all([getPartner(rel.retailerId), getPartner(rel.supplierId), listDocumentTypes(rel.id)]);
    results.push({ ...rel, retailer, supplier, documentTypes: docTypes });
  }
  return results;
}

export async function createRelationship(retailerId: string, supplierId: string): Promise<PartnerRelationship> {
  const client = sql();
  await ensureSchema(client);
  try {
    const rows = (await client.query(
      `INSERT INTO partner_relationships (retailer_id, supplier_id) VALUES ($1, $2) RETURNING *`,
      [retailerId, supplierId]
    )) as RelationshipRow[];
    return toRelationship(rows[0]);
  } catch (e) {
    if (e instanceof Error && /unique/i.test(e.message)) {
      throw new DuplicateRelationshipError("This retailer/supplier relationship already exists.");
    }
    throw e;
  }
}

export async function deleteRelationship(id: string): Promise<void> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(`DELETE FROM partner_relationships WHERE id = $1 RETURNING id`, [id])) as { id: string }[];
  if (rows.length === 0) throw new RelationshipNotFoundError(`No relationship with id "${id}".`);
}

export async function listDocumentTypes(relationshipId: string): Promise<RelationshipDocumentType[]> {
  const client = sql();
  await ensureSchema(client);
  const rows = (await client.query(
    `SELECT * FROM relationship_document_types WHERE relationship_id = $1 ORDER BY standard, transaction_code, direction`,
    [relationshipId]
  )) as DocTypeRow[];
  return rows.map(toDocType);
}

// Replaces the full set of document-type assignments for a relationship — simpler
// and less error-prone for the UI (a checklist of standard/transaction/direction
// combinations) than tracking individual add/remove calls.
export async function setDocumentTypes(
  relationshipId: string,
  assignments: { standard: string; transactionCode: string; direction: DocDirection }[]
): Promise<RelationshipDocumentType[]> {
  const client = sql();
  await ensureSchema(client);
  await client.query(`DELETE FROM relationship_document_types WHERE relationship_id = $1`, [relationshipId]);
  for (const a of assignments) {
    await client.query(
      `INSERT INTO relationship_document_types (relationship_id, standard, transaction_code, direction) VALUES ($1, $2, $3, $4)`,
      [relationshipId, a.standard, a.transactionCode, a.direction]
    );
  }
  return listDocumentTypes(relationshipId);
}

export interface EnvelopeMatch {
  relationship: RelationshipWithPartners;
  senderRole: PartnerRole;
  documentTypeAllowed: boolean | null; // null when no transactionCode was given to check against
}

// The "validation hook" from the BRD: given the sender/receiver interchange
// identifiers off a real or sample envelope, find the trading-partner relationship
// they belong to (matching in either direction — either party could be the sender)
// and, if a transaction code is supplied, whether that relationship allows it.
// `envelopeStandard` picks which identifier column to match against — X12's ISA06/
// ISA08 live in isa_id, EDIFACT's UNB sender/recipient in unb_id — since a party's
// two identifier schemes are independent columns, not a single shared one.
export async function findRelationshipByEnvelope(params: {
  senderIsaId: string;
  receiverIsaId: string;
  envelopeStandard?: "X12" | "EDIFACT";
  standard?: string;
  transactionCode?: string;
}): Promise<EnvelopeMatch | null> {
  const client = sql();
  await ensureSchema(client);

  const idColumn = params.envelopeStandard === "EDIFACT" ? "unb_id" : "isa_id";
  const rows = (await client.query(
    `SELECT r.*, sp.role AS sender_role
     FROM partner_relationships r
     JOIN trading_partners sender ON sender.${idColumn} = $1
     JOIN trading_partners receiver ON receiver.${idColumn} = $2
     JOIN trading_partners sp ON sp.id = sender.id
     WHERE (r.retailer_id = sender.id AND r.supplier_id = receiver.id)
        OR (r.retailer_id = receiver.id AND r.supplier_id = sender.id)
     LIMIT 1`,
    [params.senderIsaId, params.receiverIsaId]
  )) as (RelationshipRow & { sender_role: PartnerRole })[];

  if (rows.length === 0) return null;

  const rel = toRelationship(rows[0]);
  const [retailer, supplier, documentTypes] = await Promise.all([getPartner(rel.retailerId), getPartner(rel.supplierId), listDocumentTypes(rel.id)]);
  const relationship: RelationshipWithPartners = { ...rel, retailer, supplier, documentTypes };

  const documentTypeAllowed =
    params.standard && params.transactionCode
      ? documentTypes.some((d) => d.standard === params.standard && d.transactionCode === params.transactionCode)
      : null;

  return { relationship, senderRole: rows[0].sender_role, documentTypeAllowed };
}
