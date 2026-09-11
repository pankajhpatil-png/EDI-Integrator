import { Client as FtpClient } from "basic-ftp";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getMap } from "@/lib/server/db";
import { findRelationshipByEnvelope } from "@/lib/server/partnersDb";
import { EDI_SCHEMAS } from "@/lib/edi/schemas";
import { generateJsonPreview } from "@/lib/mapping/generateJsonPreview";
import { generateEdiPreview } from "@/lib/mapping/generateEdiPreview";
import { xmlToPayloadObjectServer } from "@/lib/xml/xmlToPayloadObjectServer";
import { parseEnvelope } from "./envelopeParsers";
import type { ProcessDefinition, ProcessNode } from "./types";

export interface RunStep {
  nodeId: string;
  label: string;
  status: "ok" | "error" | "skipped";
  message: string;
}

export interface RunResult {
  success: boolean;
  steps: RunStep[];
  outputText?: string; // the final mapped EDI text, if a Map node produced one
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

// V1 only supports a single linear path — real branching (parallel steps,
// conditional routing) isn't part of this scope; validate that shape explicitly
// rather than silently running just one of several possible paths.
function orderLinearChain(def: ProcessDefinition): ProcessNode[] | { error: string } {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  for (const e of def.edges) {
    const list = outgoing.get(e.source) ?? [];
    list.push(e.target);
    outgoing.set(e.source, list);
  }

  const starts = def.nodes.filter((n) => n.config.type === "start");
  if (starts.length !== 1) return { error: `Expected exactly one Start node, found ${starts.length}.` };

  const ordered: ProcessNode[] = [];
  let current: ProcessNode | undefined = starts[0];
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) return { error: "Cycle detected in the process graph." };
    visited.add(current.id);
    ordered.push(current);
    if (current.config.type === "end") break;

    const nextIds = outgoing.get(current.id) ?? [];
    if (nextIds.length === 0) return { error: `"${current.label}" has no outgoing connection — every node must lead toward End.` };
    if (nextIds.length > 1) return { error: `"${current.label}" branches to multiple nodes — only a single linear path is supported.` };
    current = byId.get(nextIds[0]);
    if (!current) return { error: "A connection points to a node that no longer exists." };
  }

  if (ordered[ordered.length - 1]?.config.type !== "end") return { error: "The process never reaches an End node." };
  return ordered;
}

export async function runProcess(definition: ProcessDefinition): Promise<RunResult> {
  const ordered = orderLinearChain(definition);
  if (!Array.isArray(ordered)) {
    return { success: false, steps: [{ nodeId: "", label: "Process graph", status: "error", message: ordered.error }] };
  }

  const steps: RunStep[] = [];
  let fileContent: string | null = null;
  let outputText: string | null = null;

  for (const node of ordered) {
    try {
      switch (node.config.type) {
        case "start":
          steps.push({ nodeId: node.id, label: node.label, status: "ok", message: "Started." });
          break;

        case "end":
          steps.push({ nodeId: node.id, label: node.label, status: "ok", message: "Completed." });
          break;

        case "input": {
          const source = node.config.source;
          if (!source) throw new Error("No input source configured.");

          if (source.kind === "folder") {
            const files = await fs.readdir(source.folder.path);
            const pattern = source.folder.filePattern ? globToRegExp(source.folder.filePattern) : null;
            const match = files.find((f) => !pattern || pattern.test(f));
            if (!match) throw new Error(`No file matching "${source.folder.filePattern ?? "*"}" found in ${source.folder.path}.`);
            fileContent = await fs.readFile(path.join(source.folder.path, match), "utf-8");
            steps.push({ nodeId: node.id, label: node.label, status: "ok", message: `Read "${match}" from ${source.folder.path} (${fileContent.length} bytes).` });
          } else {
            const client = new FtpClient();
            try {
              await client.access({ host: source.ftp.host, port: source.ftp.port, user: source.ftp.user, password: source.ftp.password, secure: source.ftp.secure });
              if (source.ftp.remoteDir) await client.cd(source.ftp.remoteDir);
              const list = await client.list();
              const pattern = source.ftp.filePattern ? globToRegExp(source.ftp.filePattern) : null;
              const match = list.find((f) => f.isFile && (!pattern || pattern.test(f.name)));
              if (!match) throw new Error(`No file matching "${source.ftp.filePattern ?? "*"}" found on ${source.ftp.host}:${source.ftp.remoteDir || "/"}.`);
              const tmpPath = path.join(os.tmpdir(), `orch-in-${Date.now()}-${match.name}`);
              await client.downloadTo(tmpPath, match.name);
              fileContent = await fs.readFile(tmpPath, "utf-8");
              await fs.unlink(tmpPath).catch(() => {});
              steps.push({ nodeId: node.id, label: node.label, status: "ok", message: `Fetched "${match.name}" from ${source.ftp.host} (${fileContent.length} bytes).` });
            } finally {
              client.close();
            }
          }
          break;
        }

        case "tradingPartner": {
          if (!fileContent) throw new Error("No file fetched yet — an Input node must run first.");
          const envelope = parseEnvelope(fileContent);
          if (!envelope) throw new Error("Could not find an ISA (X12) or UNB (EDIFACT) envelope segment in the fetched file.");
          const match = await findRelationshipByEnvelope({
            senderIsaId: envelope.ids.senderId,
            receiverIsaId: envelope.ids.receiverId,
            envelopeStandard: envelope.standard,
          });
          if (!match) {
            throw new Error(`No trading partner relationship found for sender "${envelope.ids.senderId}" / receiver "${envelope.ids.receiverId}" (${envelope.standard}).`);
          }
          steps.push({
            nodeId: node.id,
            label: node.label,
            status: "ok",
            message: `Matched ${match.relationship.retailer.name} ↔ ${match.relationship.supplier.name} (${envelope.standard}, sender is the ${match.senderRole}).`,
          });
          break;
        }

        case "map": {
          if (!fileContent) throw new Error("No file fetched yet — an Input node must run first.");
          if (!node.config.map.mapId) throw new Error("No saved map selected for this node.");

          const saved = await getMap(node.config.map.mapId);
          const data = saved.data;
          if (!data.sourceXmlTree || !data.targetJsonTree) throw new Error(`Saved map "${saved.name}" has no source/target structure defined.`);

          const xmlPayload = xmlToPayloadObjectServer(fileContent);
          const jsonResult = generateJsonPreview(data.targetJsonTree, data.sourceXmlTree, data.xmlToJsonMappings, xmlPayload, {
            globalVarDecls: data.globalVarDecls,
          });
          const jsonErrors = jsonResult.issues.filter((i) => i.severity === "error");
          if (jsonErrors.length > 0) throw new Error(`XML→JSON mapping failed: ${jsonErrors.map((i) => i.message).join("; ")}`);

          if (!data.selectedEdiTransactionKey) throw new Error(`Saved map "${saved.name}" has no target EDI transaction set chosen.`);
          const schema = EDI_SCHEMAS[data.selectedEdiTransactionKey];
          if (!schema) throw new Error(`Unknown EDI transaction "${data.selectedEdiTransactionKey}".`);

          const ediResult = generateEdiPreview(schema, data.targetJsonTree, data.jsonToEdiMappings, jsonResult.document, {
            globalVarDecls: data.globalVarDecls,
            nodeRules: data.nodeRules,
          });
          const ediErrors = ediResult.issues.filter((i) => i.severity === "error");
          if (ediErrors.length > 0) throw new Error(`JSON→EDI mapping failed: ${ediErrors.map((i) => i.message).join("; ")}`);

          outputText = ediResult.segments.join("\n");
          steps.push({ nodeId: node.id, label: node.label, status: "ok", message: `Mapped via "${saved.name}" — produced ${ediResult.segments.length} EDI segment(s).` });
          break;
        }

        case "script":
          steps.push({
            nodeId: node.id,
            label: node.label,
            status: "skipped",
            message: "Script node runtime/language is not yet decided (see BRD §19 open questions) — passthrough, no-op.",
          });
          break;

        case "output": {
          const destination = node.config.destination;
          if (!destination) throw new Error("No output destination configured.");
          if (!outputText) throw new Error("Nothing to deliver yet — a Map node must run before this one.");

          const filename = `output-${Date.now()}.edi`;
          if (destination.kind === "folder") {
            await fs.mkdir(destination.folder.path, { recursive: true });
            await fs.writeFile(path.join(destination.folder.path, filename), outputText, "utf-8");
            steps.push({ nodeId: node.id, label: node.label, status: "ok", message: `Wrote "${filename}" to ${destination.folder.path}.` });
          } else {
            const client = new FtpClient();
            try {
              await client.access({ host: destination.ftp.host, port: destination.ftp.port, user: destination.ftp.user, password: destination.ftp.password, secure: destination.ftp.secure });
              if (destination.ftp.remoteDir) await client.cd(destination.ftp.remoteDir);
              const tmpPath = path.join(os.tmpdir(), `orch-out-${Date.now()}.edi`);
              await fs.writeFile(tmpPath, outputText, "utf-8");
              await client.uploadFrom(tmpPath, filename);
              await fs.unlink(tmpPath).catch(() => {});
              steps.push({ nodeId: node.id, label: node.label, status: "ok", message: `Uploaded "${filename}" to ${destination.ftp.host}.` });
            } finally {
              client.close();
            }
          }
          break;
        }
      }
    } catch (e) {
      steps.push({ nodeId: node.id, label: node.label, status: "error", message: e instanceof Error ? e.message : "Unknown error." });
      return { success: false, steps, outputText: outputText ?? undefined };
    }
  }

  return { success: true, steps, outputText: outputText ?? undefined };
}
