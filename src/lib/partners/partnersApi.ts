import type {
  DocDirection,
  EnvelopeMatch,
  PartnerInput,
  PartnerRole,
  RelationshipDocumentType,
  RelationshipWithPartners,
  TradingPartner,
} from "@/lib/server/partnersDb";

export type { DocDirection, EnvelopeMatch, PartnerInput, PartnerRole, RelationshipDocumentType, RelationshipWithPartners, TradingPartner };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function listPartners(role?: PartnerRole): Promise<{ partners: TradingPartner[] }> {
  return api(`/api/partners${role ? `?role=${role}` : ""}`);
}

export function createPartner(input: PartnerInput): Promise<{ partner: TradingPartner }> {
  return api("/api/partners", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) });
}

export function updatePartner(id: string, input: Partial<PartnerInput>): Promise<{ partner: TradingPartner }> {
  return api(`/api/partners/${id}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(input) });
}

export function deletePartner(id: string): Promise<{ ok: true }> {
  return api(`/api/partners/${id}`, { method: "DELETE" });
}

export function listRelationships(filter: { retailerId?: string; supplierId?: string } = {}): Promise<{ relationships: RelationshipWithPartners[] }> {
  const params = new URLSearchParams();
  if (filter.retailerId) params.set("retailerId", filter.retailerId);
  if (filter.supplierId) params.set("supplierId", filter.supplierId);
  const qs = params.toString();
  return api(`/api/relationships${qs ? `?${qs}` : ""}`);
}

export function createRelationship(retailerId: string, supplierId: string): Promise<{ relationship: { id: string } }> {
  return api("/api/relationships", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ retailerId, supplierId }) });
}

export function deleteRelationship(id: string): Promise<{ ok: true }> {
  return api(`/api/relationships/${id}`, { method: "DELETE" });
}

export function setDocumentTypes(
  relationshipId: string,
  assignments: { standard: string; transactionCode: string; direction: DocDirection }[]
): Promise<{ documentTypes: RelationshipDocumentType[] }> {
  return api(`/api/relationships/${relationshipId}/document-types`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ assignments }),
  });
}

export function validateEnvelope(params: {
  senderIsaId: string;
  receiverIsaId: string;
  standard?: string;
  transactionCode?: string;
}): Promise<{ match: EnvelopeMatch | null }> {
  return api("/api/partners/validate-envelope", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(params) });
}
