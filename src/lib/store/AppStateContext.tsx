"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { SchemaNode } from "@/lib/schema/types";
import type { MappingEdge } from "@/lib/mapping/types";
import type { GlobalVarDecl, NodeRules } from "@/lib/rules/mappingIntegration";
import { EMPTY_SNAPSHOT, loadSnapshotFromLocalStorage, saveSnapshotToLocalStorage, type MapSnapshot } from "./mapSnapshot";

// Shared workbench state across the two mapping stages — the same SchemaNode
// tree shape flows from XML inference into the source panel here, and later
// into the drag-connect canvas on both stages. targetJsonTree is the single JSON
// artifact in the BRD's INGEST -> MODEL(JSON) -> MAP -> MAP AGAIN pipeline: target
// of the XML->JSON stage, and source of the JSON->EDI stage.
interface AppStateValue {
  sourceXmlTree: SchemaNode | null;
  setSourceXmlTree: (tree: SchemaNode | null) => void;
  targetJsonTree: SchemaNode | null;
  setTargetJsonTree: (tree: SchemaNode | null) => void;
  xmlToJsonMappings: MappingEdge[];
  setXmlToJsonMappings: Dispatch<SetStateAction<MappingEdge[]>>;
  sampleXmlText: string;
  setSampleXmlText: Dispatch<SetStateAction<string>>;
  selectedEdiTransactionKey: string | null;
  setSelectedEdiTransactionKey: (key: string | null) => void;
  jsonToEdiMappings: MappingEdge[];
  setJsonToEdiMappings: Dispatch<SetStateAction<MappingEdge[]>>;
  globalVarDecls: GlobalVarDecl[];
  setGlobalVarDecls: Dispatch<SetStateAction<GlobalVarDecl[]>>;
  nodeRules: Record<string, NodeRules>;
  setNodeRules: Dispatch<SetStateAction<Record<string, NodeRules>>>;
  sampleJsonText: string;
  setSampleJsonText: Dispatch<SetStateAction<string>>;

  // Identity of the named map currently loaded from the database, if any — null
  // means "unsaved session" (still autosaved locally, just not yet given a name).
  currentMapId: string | null;
  currentMapName: string | null;
  // Bulk read/write of the whole session — used by the Save/Load controls to hand
  // a snapshot to the API, and to hydrate every field at once after a Load.
  getSnapshot: () => MapSnapshot;
  loadSnapshot: (snapshot: MapSnapshot, identity?: { id: string; name: string } | null) => void;
  markSaved: (identity: { id: string; name: string }) => void;
  resetSession: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const AUTOSAVE_DEBOUNCE_MS = 400;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [sourceXmlTree, setSourceXmlTree] = useState<SchemaNode | null>(null);
  const [targetJsonTree, setTargetJsonTree] = useState<SchemaNode | null>(null);
  const [xmlToJsonMappings, setXmlToJsonMappings] = useState<MappingEdge[]>([]);
  const [sampleXmlText, setSampleXmlText] = useState("");
  const [selectedEdiTransactionKey, setSelectedEdiTransactionKey] = useState<string | null>(null);
  const [jsonToEdiMappings, setJsonToEdiMappings] = useState<MappingEdge[]>([]);
  const [globalVarDecls, setGlobalVarDecls] = useState<GlobalVarDecl[]>([]);
  const [nodeRules, setNodeRules] = useState<Record<string, NodeRules>>({});
  const [sampleJsonText, setSampleJsonText] = useState("");

  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [currentMapName, setCurrentMapName] = useState<string | null>(null);

  // Restore the last autosaved session once, on mount (client-only — SSR renders
  // the empty defaults above, then this hydrates a moment later; no server/client
  // markup mismatch since the swap happens post-hydration, in an effect).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const snapshot = loadSnapshotFromLocalStorage();
    if (!snapshot) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from an
       external source (localStorage) on mount, same pattern as ThemeToggle. */
    setSourceXmlTree(snapshot.sourceXmlTree);
    setTargetJsonTree(snapshot.targetJsonTree);
    setXmlToJsonMappings(snapshot.xmlToJsonMappings);
    setSampleXmlText(snapshot.sampleXmlText);
    setSelectedEdiTransactionKey(snapshot.selectedEdiTransactionKey);
    setJsonToEdiMappings(snapshot.jsonToEdiMappings);
    setGlobalVarDecls(snapshot.globalVarDecls);
    setNodeRules(snapshot.nodeRules);
    setSampleJsonText(snapshot.sampleJsonText);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Debounced autosave to localStorage on every change — the safety net so a
  // refresh/crash never loses in-progress work, independent of any deliberate
  // named Save to the database.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!restored.current) return; // don't overwrite storage with defaults before the restore effect above has run
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSnapshotToLocalStorage({
        sourceXmlTree,
        targetJsonTree,
        xmlToJsonMappings,
        sampleXmlText,
        selectedEdiTransactionKey,
        jsonToEdiMappings,
        globalVarDecls,
        nodeRules,
        sampleJsonText,
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    sourceXmlTree,
    targetJsonTree,
    xmlToJsonMappings,
    sampleXmlText,
    selectedEdiTransactionKey,
    jsonToEdiMappings,
    globalVarDecls,
    nodeRules,
    sampleJsonText,
  ]);

  const value = useMemo<AppStateValue>(
    () => ({
      sourceXmlTree,
      setSourceXmlTree,
      targetJsonTree,
      setTargetJsonTree,
      xmlToJsonMappings,
      setXmlToJsonMappings,
      sampleXmlText,
      setSampleXmlText,
      selectedEdiTransactionKey,
      setSelectedEdiTransactionKey,
      jsonToEdiMappings,
      setJsonToEdiMappings,
      globalVarDecls,
      setGlobalVarDecls,
      nodeRules,
      setNodeRules,
      sampleJsonText,
      setSampleJsonText,
      currentMapId,
      currentMapName,
      getSnapshot: () => ({
        sourceXmlTree,
        targetJsonTree,
        xmlToJsonMappings,
        sampleXmlText,
        selectedEdiTransactionKey,
        jsonToEdiMappings,
        globalVarDecls,
        nodeRules,
        sampleJsonText,
      }),
      loadSnapshot: (snapshot, identity) => {
        setSourceXmlTree(snapshot.sourceXmlTree);
        setTargetJsonTree(snapshot.targetJsonTree);
        setXmlToJsonMappings(snapshot.xmlToJsonMappings);
        setSampleXmlText(snapshot.sampleXmlText);
        setSelectedEdiTransactionKey(snapshot.selectedEdiTransactionKey);
        setJsonToEdiMappings(snapshot.jsonToEdiMappings);
        setGlobalVarDecls(snapshot.globalVarDecls);
        setNodeRules(snapshot.nodeRules);
        setSampleJsonText(snapshot.sampleJsonText);
        setCurrentMapId(identity?.id ?? null);
        setCurrentMapName(identity?.name ?? null);
      },
      markSaved: (identity) => {
        setCurrentMapId(identity.id);
        setCurrentMapName(identity.name);
      },
      resetSession: () => {
        setSourceXmlTree(EMPTY_SNAPSHOT.sourceXmlTree);
        setTargetJsonTree(EMPTY_SNAPSHOT.targetJsonTree);
        setXmlToJsonMappings(EMPTY_SNAPSHOT.xmlToJsonMappings);
        setSampleXmlText(EMPTY_SNAPSHOT.sampleXmlText);
        setSelectedEdiTransactionKey(EMPTY_SNAPSHOT.selectedEdiTransactionKey);
        setJsonToEdiMappings(EMPTY_SNAPSHOT.jsonToEdiMappings);
        setGlobalVarDecls(EMPTY_SNAPSHOT.globalVarDecls);
        setNodeRules(EMPTY_SNAPSHOT.nodeRules);
        setSampleJsonText(EMPTY_SNAPSHOT.sampleJsonText);
        setCurrentMapId(null);
        setCurrentMapName(null);
      },
    }),
    [
      sourceXmlTree,
      targetJsonTree,
      xmlToJsonMappings,
      sampleXmlText,
      selectedEdiTransactionKey,
      jsonToEdiMappings,
      globalVarDecls,
      nodeRules,
      sampleJsonText,
      currentMapId,
      currentMapName,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
