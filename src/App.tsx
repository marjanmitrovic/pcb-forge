import { useEffect, useMemo, useRef, useState } from "react";
import { BoardSettingsPanel } from "./components/BoardSettingsPanel";
import { BomPanel } from "./components/BomPanel";
import { ComponentLibrary } from "./components/ComponentLibrary";
import { DrcPanel } from "./components/DrcPanel";
import { DesignRulesPanel } from "./components/DesignRulesPanel";
import { FootprintEditor } from "./components/FootprintEditor";
import { FootprintLibraryPanel } from "./components/FootprintLibraryPanel";
import { LayerPanel } from "./components/LayerPanel";
import { NetPanel } from "./components/NetPanel";
import { NetlistPanel } from "./components/NetlistPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { RoutePanel } from "./components/RoutePanel";
import { LiveCatalogSearch } from "./components/LiveCatalogSearch";
import { SchematicWorkspace, type SchematicToPcbPayload } from "./components/SchematicWorkspace";
import { createComponent, createCustomFootprintComponent, createLibraryComponent } from "./factories/components";
import { getLibraryComponentById, type LibraryComponentTemplate } from "./library/componentCatalog";
import { predefinedFootprints } from "./library/footprintLibrary";
import type { AngleMode, Board, ComponentType, CopperZone, DesignRules, Footprint, Layer, MountingHole, SilkscreenItem, PCBComponent, Point, Tool, Trace, Via } from "./model/pcb";
import { runDrc, type DrcIssue } from "./utils/drc";
import { exportManufacturingPackage } from "./utils/manufacturingExport";
import { GRID, getAbsolutePads, snap, uid } from "./utils/geometry";

const BOARD_OFFSET = { x: 80, y: 80 };
const BOARD_WIDTH = 760;
const BOARD_HEIGHT = 460;
const HISTORY_LIMIT = 80;
const DEFAULT_VIEWBOX = { x: 0, y: 0, width: 1000, height: 650 };
const MIN_VIEW_WIDTH = 260;
const MAX_VIEW_WIDTH = 2200;
const PROJECT_FILE_VERSION = "0.6.0";
const AUTOSAVE_KEY = "pcb-forge-autosave";

const DEFAULT_DESIGN_RULES: DesignRules = {
  minTraceWidth: 4,
  minClearance: 8,
  minDrill: 6,
  minViaDiameter: 12,
  minZoneClearance: 8,
  minSilkscreenTextSize: 10,
  copperToBoardEdge: 10,
};

const initialBoard: Board = {
  name: "PCB Forge Demo Board",
  width: BOARD_WIDTH,
  height: BOARD_HEIGHT,
  components: [],
  traces: [],
  vias: [],
  mountingHoles: [],
  silkscreenItems: [],
  copperZones: [],
  nets: [
    { id: "net_gnd", name: "GND", color: "#111827" },
    { id: "net_vcc", name: "VCC", color: "#dc2626" },
    { id: "net_signal_1", name: "SIGNAL_1", color: "#2563eb" },
  ],
  footprints: [],
  designRules: DEFAULT_DESIGN_RULES,
};

type RouteDraft = {
  points: Point[];
  netId: string;
  layer: Layer;
};

type LayerVisibility = {
  topCopper: boolean;
  bottomCopper: boolean;
  vias: boolean;
  copperZones: boolean;
  silkscreen: boolean;
  mountingHoles: boolean;
  ratsnest: boolean;
};

const defaultLayerVisibility: LayerVisibility = {
  topCopper: true,
  bottomCopper: true,
  vias: true,
  copperZones: true,
  silkscreen: true,
  mountingHoles: true,
  ratsnest: true,
};

type LiveCatalogPart = {
  mpn: string;
  description: string;
  totalAvail: number;
};

type ProjectDocument = {
  fileType: "pcbforge-project";
  version: string;
  savedAt: string;
  board: Board;
  liveLibraryComponents: LibraryComponentTemplate[];
};

type RatsnestMode = "all" | "active";

type SelectableObjectType = "components" | "traces" | "vias" | "mountingHoles" | "silkscreen" | "copperZones";

type SelectionFilter = Record<SelectableObjectType, boolean>;
type ObjectLocks = Record<SelectableObjectType, boolean>;

const defaultSelectionFilter: SelectionFilter = {
  components: true,
  traces: true,
  vias: true,
  mountingHoles: true,
  silkscreen: true,
  copperZones: true,
};

const defaultObjectLocks: ObjectLocks = {
  components: false,
  traces: false,
  vias: false,
  mountingHoles: false,
  silkscreen: false,
  copperZones: false,
};

type RatsnestConnection = {
  id: string;
  netId: string;
  from: Point;
  to: Point;
  fromLabel: string;
  toLabel: string;
};

function migrateBoard(input: Board): Board {
  const safeNets = Array.isArray(input.nets) && input.nets.length > 0 ? input.nets : initialBoard.nets;

  return {
    ...initialBoard,
    ...input,
    components: Array.isArray(input.components) ? input.components : [],
    traces: Array.isArray(input.traces) ? input.traces : [],
    vias: Array.isArray(input.vias) ? input.vias : [],
    mountingHoles: Array.isArray(input.mountingHoles) ? input.mountingHoles : [],
    silkscreenItems: Array.isArray(input.silkscreenItems) ? input.silkscreenItems : [],
    copperZones: Array.isArray(input.copperZones) ? input.copperZones : [],
    footprints: Array.isArray(input.footprints) ? input.footprints : [],
    designRules: { ...DEFAULT_DESIGN_RULES, ...(input.designRules ?? {}) },
    nets: safeNets.map((net) => ({
      ...net,
      color: net.color ?? "#64748b",
    })),
  };
}

function safeFilename(name: string) {
  return name.trim().replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "pcb_forge_project";
}

function createProjectDocument(board: Board, liveLibraryComponents: LibraryComponentTemplate[]): ProjectDocument {
  return {
    fileType: "pcbforge-project",
    version: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    board,
    liveLibraryComponents,
  };
}

function parseProjectPayload(text: string): { board: Board; liveLibraryComponents?: LibraryComponentTemplate[] } {
  const parsed = JSON.parse(text);

  if (parsed?.fileType === "pcbforge-project" && parsed?.board) {
    return {
      board: migrateBoard(parsed.board as Board),
      liveLibraryComponents: Array.isArray(parsed.liveLibraryComponents) ? parsed.liveLibraryComponents : [],
    };
  }

  return {
    board: migrateBoard(parsed as Board),
  };
}

function oppositeLayer(value: Layer): Layer {
  return value === "top" ? "bottom" : "top";
}

function constrainPoint(from: Point, raw: Point, angleMode: AngleMode): Point {
  const dx = raw.x - from.x;
  const dy = raw.y - from.y;

  if (dx === 0 && dy === 0) return raw;

  if (angleMode === "orthogonal") {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: raw.x, y: from.y };
    }
    return { x: from.x, y: raw.y };
  }

  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snappedAngle = Math.round(angle / step) * step;
  const length = Math.sqrt(dx * dx + dy * dy);

  return {
    x: snap(from.x + Math.cos(snappedAngle) * length),
    y: snap(from.y + Math.sin(snappedAngle) * length),
  };
}

function last<T>(items: T[]): T | null {
  return items.length ? items[items.length - 1] : null;
}

export default function App() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [historyState, setHistoryState] = useState<{ items: Board[]; index: number }>({
    items: [initialBoard],
    index: 0,
  });
  const restoringHistoryRef = useRef(false);
  const [tool, setTool] = useState<Tool>("select");
  const [layer, setLayer] = useState<Layer>("top");
  const [angleMode, setAngleMode] = useState<AngleMode>("orthogonal");
  const [traceWidth, setTraceWidth] = useState<number>(8);
  const [gridStep, setGridStep] = useState<number>(GRID);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [activeNetId, setActiveNetId] = useState<string>("net_gnd");
  const [showRatsnest, setShowRatsnest] = useState<boolean>(true);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(defaultLayerVisibility);
  const [ratsnestMode, setRatsnestMode] = useState<RatsnestMode>("all");
  const [highlightActiveNet, setHighlightActiveNet] = useState<boolean>(false);
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>(defaultSelectionFilter);
  const [objectLocks, setObjectLocks] = useState<ObjectLocks>(defaultObjectLocks);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedFootprintId, setSelectedFootprintId] = useState<string | null>(null);
  const [selectedLibraryComponentId, setSelectedLibraryComponentId] = useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedViaId, setSelectedViaId] = useState<string | null>(null);
  const [selectedMountingHoleId, setSelectedMountingHoleId] = useState<string | null>(null);
  const [selectedSilkscreenId, setSelectedSilkscreenId] = useState<string | null>(null);
  const [selectedCopperZoneId, setSelectedCopperZoneId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [drcIssues, setDrcIssues] = useState<DrcIssue[]>([]);
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; viewBox: typeof DEFAULT_VIEWBOX } | null>(null);
  const [pendingCatalogPart, setPendingCatalogPart] = useState<LiveCatalogPart | null>(null);
  const [measureStart, setMeasureStart] = useState<Point | null>(null);
  const [measureEnd, setMeasureEnd] = useState<Point | null>(null);
  const [liveLibraryComponents, setLiveLibraryComponents] = useState<LibraryComponentTemplate[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pcb-forge-live-library") || "[]");
    } catch {
      return [];
    }
  });
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (!saved) return null;
      return JSON.parse(saved)?.savedAt ?? null;
    } catch {
      return null;
    }
  });

  const [activePanel, setActivePanel] = useState<ActivePanel>("components");
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("pcb-forge-theme") === "dark");
  const [toolsCollapsed, setToolsCollapsed] = useState<boolean>(() => localStorage.getItem("pcb-forge-tools-collapsed") === "true");
  const [inspectorCollapsed, setInspectorCollapsed] = useState<boolean>(() => localStorage.getItem("pcb-forge-inspector-collapsed") === "true");
  const [boardSideMode, setBoardSideMode] = useState<"top" | "bottom" | "both">(() => {
    const saved = localStorage.getItem("pcb-forge-board-side-mode");
    return saved === "top" || saved === "bottom" || saved === "both" ? saved : "both";
  });
  const [flipBottomView, setFlipBottomView] = useState<boolean>(() => localStorage.getItem("pcb-forge-flip-bottom-view") === "true");

  const selectedComponent = useMemo(
    () => board.components.find((c) => c.id === selectedComponentId) ?? null,
    [board.components, selectedComponentId]
  );

  const selectedTrace = useMemo(
    () => board.traces.find((trace) => trace.id === selectedTraceId) ?? null,
    [board.traces, selectedTraceId]
  );

  const selectedVia = useMemo(
    () => board.vias.find((via) => via.id === selectedViaId) ?? null,
    [board.vias, selectedViaId]
  );

  const selectedMountingHole = useMemo(
    () => board.mountingHoles.find((hole) => hole.id === selectedMountingHoleId) ?? null,
    [board.mountingHoles, selectedMountingHoleId]
  );

  const selectedSilkscreenItem = useMemo(
    () => board.silkscreenItems.find((item) => item.id === selectedSilkscreenId) ?? null,
    [board.silkscreenItems, selectedSilkscreenId]
  );

  const selectedCopperZone = useMemo(
    () => board.copperZones.find((zone) => zone.id === selectedCopperZoneId) ?? null,
    [board.copperZones, selectedCopperZoneId]
  );

  const previewPoint = useMemo(() => {
    if (!routeDraft) return null;
    const from = last(routeDraft.points);
    if (!from) return null;
    return constrainPoint(from, mousePos, angleMode);
  }, [angleMode, mousePos, routeDraft]);


  const ratsnestConnections = useMemo<RatsnestConnection[]>(() => {
    if (!showRatsnest) return [];

    const endpointsByNet = new Map<string, { point: Point; label: string }[]>();

    board.components.forEach((component) => {
      getAbsolutePads(component).forEach((pad) => {
        if (!pad.netId) return;
        if (ratsnestMode === "active" && pad.netId !== activeNetId) return;

        const label = `${component.name}.${pad.pinName ?? pad.id.split("_").slice(-1)[0] ?? pad.id}`;
        const existing = endpointsByNet.get(pad.netId) ?? [];
        existing.push({ point: { x: pad.x, y: pad.y }, label });
        endpointsByNet.set(pad.netId, existing);
      });
    });

    board.vias.forEach((via) => {
      if (ratsnestMode === "active" && via.netId !== activeNetId) return;
      const existing = endpointsByNet.get(via.netId) ?? [];
      existing.push({ point: { x: via.x, y: via.y }, label: `via ${via.id.slice(-4)}` });
      endpointsByNet.set(via.netId, existing);
    });

    const distance = (a: Point, b: Point) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const connections: RatsnestConnection[] = [];

    endpointsByNet.forEach((endpoints, netId) => {
      if (endpoints.length < 2) return;

      const unused = [...endpoints].sort((a, b) => a.label.localeCompare(b.label));
      let current = unused.shift();
      if (!current) return;

      while (unused.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        unused.forEach((candidate, index) => {
          const d = distance(current!.point, candidate.point);
          if (d < nearestDistance) {
            nearestDistance = d;
            nearestIndex = index;
          }
        });

        const next = unused.splice(nearestIndex, 1)[0];
        connections.push({
          id: `ratsnest-${netId}-${connections.length}`,
          netId,
          from: current.point,
          to: next.point,
          fromLabel: current.label,
          toLabel: next.label,
        });
        current = next;
      }
    });

    return connections;
  }, [activeNetId, board.components, board.vias, ratsnestMode, showRatsnest]);

  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.items.length - 1;

  useEffect(() => {
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      return;
    }

    setHistoryState((prev) => {
      const current = prev.items[prev.index];
      if (JSON.stringify(current) === JSON.stringify(board)) return prev;

      const base = prev.items.slice(0, prev.index + 1);
      const nextItems = [...base, board];
      const limitedItems = nextItems.length > HISTORY_LIMIT ? nextItems.slice(nextItems.length - HISTORY_LIMIT) : nextItems;

      return { items: limitedItems, index: limitedItems.length - 1 };
    });
  }, [board]);

  useEffect(() => {
    try {
      const document = createProjectDocument(board, liveLibraryComponents);
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(document));
      setLastAutosaveAt(document.savedAt);
    } catch {
      // Autosave must never block the editor.
    }
  }, [board, liveLibraryComponents]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("pcb-forge-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("pcb-forge-tools-collapsed", String(toolsCollapsed));
  }, [toolsCollapsed]);

  useEffect(() => {
    localStorage.setItem("pcb-forge-inspector-collapsed", String(inspectorCollapsed));
  }, [inspectorCollapsed]);

  useEffect(() => {
    localStorage.setItem("pcb-forge-board-side-mode", boardSideMode);
    localStorage.setItem("pcb-forge-flip-bottom-view", String(flipBottomView));
  }, [boardSideMode, flipBottomView]);


  function restoreHistoryAt(index: number) {
    const snapshot = historyState.items[index];
    if (!snapshot) return;

    restoringHistoryRef.current = true;
    setBoard(snapshot);
    setHistoryState((prev) => ({ ...prev, index }));
    setRouteDraft(null);
    clearSelection();
    setDrcIssues([]);
  }

  function undoLastAction() {
    if (!canUndo) return;
    restoreHistoryAt(historyState.index - 1);
  }

  function redoLastAction() {
    if (!canRedo) return;
    restoreHistoryAt(historyState.index + 1);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const control = event.ctrlKey || event.metaKey;

      if (control && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoLastAction();
        return;
      }

      if ((control && key === "y") || (control && event.shiftKey && key === "z")) {
        event.preventDefault();
        redoLastAction();
        return;
      }

      if (event.key === "Escape") {
        setRouteDraft(null);
        if (tool === "measure") {
          setMeasureStart(null);
          setMeasureEnd(null);
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTyping = !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (isTyping || control || event.altKey) return;

      if (key === "v") {
        setTool("select");
        return;
      }

      if (key === "r") {
        setActivePanel("routing");
        setTool("route");
        return;
      }

      if (key === "t") {
        setActivePanel("silkscreen");
        setTool("add-silkscreen-text");
        return;
      }

      if (key === "m") {
        setActivePanel("board");
        setTool("measure");
        return;
      }

      if (key === "h") {
        setActivePanel("mechanical");
        setTool("add-mounting-hole");
        return;
      }

      if (key === "z") {
        setActivePanel("zones");
        setTool("add-copper-zone");
        return;
      }

      if (key === "c") {
        setActivePanel("components");
        return;
      }

      if (key === "l") {
        setActivePanel("catalog");
        return;
      }

      if (key === "d") {
        setActivePanel("checks");
        return;
      }

      if (key === "b") {
        setActivePanel("bom");
        return;
      }

      if (key === "p") {
        setActivePanel("project");
        return;
      }

      if (key === "s") {
        setActivePanel("schematic");
        return;
      }

      if (key === "?") {
        setActivePanel("shortcuts");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, historyState, selectedComponentId, selectedTraceId, selectedViaId, selectedMountingHoleId, selectedSilkscreenId, selectedCopperZoneId]);

  function clearDrc() {
    if (drcIssues.length > 0) setDrcIssues([]);
  }

  function setLayerVisibilityValue(key: keyof LayerVisibility, value: boolean) {
    setLayerVisibility((prev) => ({ ...prev, [key]: value }));
  }

  function showAllDisplayLayers() {
    setLayerVisibility(defaultLayerVisibility);
    setShowRatsnest(true);
  }

  function hideNonEssentialLayers() {
    setLayerVisibility({
      topCopper: true,
      bottomCopper: true,
      vias: true,
      copperZones: false,
      silkscreen: false,
      mountingHoles: false,
      ratsnest: false,
    });
    setShowRatsnest(false);
  }

  function updateBoardSettings(patch: Partial<Pick<Board, "name" | "width" | "height">>) {
    setBoard((prev) => ({ ...prev, ...patch }));
    clearDrc();
  }

  function updateDesignRules(patch: Partial<DesignRules>) {
    setBoard((prev) => ({
      ...prev,
      designRules: { ...prev.designRules, ...patch },
    }));
    clearDrc();
  }

  function updateSelectedComponent(patch: Partial<PCBComponent>) {
    if (!selectedComponentId) return;
    setBoard((prev) => ({
      ...prev,
      components: prev.components.map((component) =>
        component.id === selectedComponentId ? { ...component, ...patch } : component
      ),
    }));
    clearDrc();
  }

  function updateSelectedTrace(patch: Partial<Trace>) {
    if (!selectedTraceId) return;

    setBoard((prev) => ({
      ...prev,
      traces: prev.traces.map((trace) =>
        trace.id === selectedTraceId ? { ...trace, ...patch } : trace
      ),
    }));

    clearDrc();
  }

  function updateSelectedVia(patch: Partial<Via>) {
    if (!selectedViaId) return;

    setBoard((prev) => ({
      ...prev,
      vias: prev.vias.map((via) =>
        via.id === selectedViaId ? { ...via, ...patch } : via
      ),
    }));

    clearDrc();
  }

  function updateSelectedMountingHole(patch: Partial<MountingHole>) {
    if (!selectedMountingHoleId) return;

    setBoard((prev) => ({
      ...prev,
      mountingHoles: prev.mountingHoles.map((hole) =>
        hole.id === selectedMountingHoleId ? { ...hole, ...patch } : hole
      ),
    }));

    clearDrc();
  }

  function updateSelectedSilkscreenItem(patch: Partial<SilkscreenItem>) {
    if (!selectedSilkscreenId) return;

    setBoard((prev) => ({
      ...prev,
      silkscreenItems: prev.silkscreenItems.map((item) =>
        item.id === selectedSilkscreenId ? { ...item, ...patch } : item
      ),
    }));

    clearDrc();
  }

  function updateSelectedCopperZone(patch: Partial<CopperZone>) {
    if (!selectedCopperZoneId) return;

    setBoard((prev) => ({
      ...prev,
      copperZones: prev.copperZones.map((zone) =>
        zone.id === selectedCopperZoneId ? { ...zone, ...patch } : zone
      ),
    }));

    clearDrc();
  }

  function canSelectObject(type: SelectableObjectType) {
    return selectionFilter[type] && !objectLocks[type];
  }

  function setSelectionFilterValue(type: SelectableObjectType, value: boolean) {
    setSelectionFilter((prev) => ({ ...prev, [type]: value }));
  }

  function setObjectLockValue(type: SelectableObjectType, value: boolean) {
    setObjectLocks((prev) => ({ ...prev, [type]: value }));
    if (value) {
      if (type === "components") setSelectedComponentId(null);
      if (type === "traces") setSelectedTraceId(null);
      if (type === "vias") setSelectedViaId(null);
      if (type === "mountingHoles") setSelectedMountingHoleId(null);
      if (type === "silkscreen") setSelectedSilkscreenId(null);
      if (type === "copperZones") setSelectedCopperZoneId(null);
    }
  }

  function unlockAllObjects() {
    setObjectLocks(defaultObjectLocks);
  }

  function enableAllSelection() {
    setSelectionFilter(defaultSelectionFilter);
  }

  function selectOnly(type: SelectableObjectType) {
    setSelectionFilter({
      components: false,
      traces: false,
      vias: false,
      mountingHoles: false,
      silkscreen: false,
      copperZones: false,
      [type]: true,
    });
  }

  function selectComponent(id: string) {
    if (!canSelectObject("components")) return;
    setSelectedComponentId(id);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setSelectedSilkscreenId(null);
    setSelectedCopperZoneId(null);
  }

  function selectTrace(id: string) {
    if (!canSelectObject("traces")) return;
    setSelectedTraceId(id);
    setSelectedComponentId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setSelectedSilkscreenId(null);
    setSelectedCopperZoneId(null);
  }

  function selectVia(id: string) {
    if (!canSelectObject("vias")) return;
    setSelectedViaId(id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedMountingHoleId(null);
    setSelectedSilkscreenId(null);
    setSelectedCopperZoneId(null);
  }

  function selectMountingHole(id: string) {
    if (!canSelectObject("mountingHoles")) return;
    setSelectedMountingHoleId(id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedSilkscreenId(null);
    setSelectedCopperZoneId(null);
  }

  function selectSilkscreenItem(id: string) {
    if (!canSelectObject("silkscreen")) return;
    setSelectedSilkscreenId(id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setSelectedCopperZoneId(null);
  }

  function selectCopperZone(id: string) {
    if (!canSelectObject("copperZones")) return;
    setSelectedCopperZoneId(id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setSelectedSilkscreenId(null);
  }

  function clearSelection() {
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setSelectedSilkscreenId(null);
    setSelectedCopperZoneId(null);
  }

  function getNetName(netId: string) {
    return board.nets.find((net) => net.id === netId)?.name ?? netId;
  }

  function handleMeasurePoint(point: Point) {
    clearSelection();

    if (!measureStart || (measureStart && measureEnd)) {
      setMeasureStart(point);
      setMeasureEnd(null);
      return;
    }

    setMeasureEnd(point);
  }

  function clearMeasurement() {
    setMeasureStart(null);
    setMeasureEnd(null);
  }

  function getMeasurement() {
    if (!measureStart || !measureEnd) return null;
    const dx = measureEnd.x - measureStart.x;
    const dy = measureEnd.y - measureStart.y;
    const lengthGridUnits = Math.sqrt(dx * dx + dy * dy);
    return {
      dx,
      dy,
      lengthGridUnits,
      dxMm: dx / 10,
      dyMm: dy / 10,
      lengthMm: lengthGridUnits / 10,
    };
  }

  function getComponentTypeFromTool(toolName: Tool): ComponentType | null {
    if (toolName === "add-resistor") return "resistor";
    if (toolName === "add-capacitor") return "capacitor";
    if (toolName === "add-led") return "led";
    if (toolName === "add-ic") return "ic";
    if (toolName === "add-connector") return "connector";
    return null;
  }

  function inferPrefixFromCatalog(type: ComponentType, text: string) {
    if (type === "resistor") return "R";
    if (type === "capacitor") return "C";
    if (type === "led") {
      if (text.includes("diode") || text.includes("rectifier") || text.includes("schottky")) return "D";
      return "LED";
    }
    if (type === "connector") return "J";
    return "U";
  }

  function findFootprintById(id: string) {
    return predefinedFootprints.find((footprint) => footprint.id === id) ?? predefinedFootprints[0];
  }

  function inferFootprintFromCatalog(type: ComponentType, text: string) {
    const normalized = text.toLowerCase();

    if (normalized.includes("esp32")) return findFootprintById("fp-esp32-wroom-32");

    if (normalized.includes("atmega328") || normalized.includes("atmega328p")) {
      if (normalized.includes("tqfp") || normalized.includes("smd")) return findFootprintById("fp-soic-14");
      return findFootprintById("fp-dip-28");
    }

    if (normalized.includes("uln2003")) {
      if (normalized.includes("soic") || normalized.includes("so-16") || normalized.includes("sop-16")) return findFootprintById("fp-soic-14");
      return findFootprintById("fp-dip-16");
    }

    if (normalized.includes("cd4017")) {
      if (normalized.includes("soic") || normalized.includes("so-16") || normalized.includes("sop-16")) return findFootprintById("fp-soic-14");
      return findFootprintById("fp-dip-16");
    }

    if (normalized.includes("lm358") || normalized.includes("ne555") || normalized.includes("555")) {
      if (normalized.includes("tssop") || normalized.includes("pwr") || normalized.includes("pw")) return findFootprintById("fp-soic-8");
      if (normalized.includes("soic") || normalized.includes("so-8") || normalized.includes("sop-8") || normalized.includes("dr") || normalized.includes("d-8")) return findFootprintById("fp-soic-8");
      return findFootprintById("fp-dip-8");
    }

    if (normalized.includes("sot-23") || normalized.includes("sot23")) return findFootprintById("fp-sot-23");
    if (normalized.includes("to-220") || normalized.includes("irfz") || normalized.includes("l7805") || normalized.includes("7805")) return findFootprintById("fp-to-220-3");
    if (normalized.includes("to-92") || normalized.includes("bc547") || normalized.includes("2n3904") || normalized.includes("2n3906")) return findFootprintById("fp-to-92-inline");

    if (normalized.includes("1n400") || normalized.includes("1n4148") || normalized.includes("do-41") || normalized.includes("rectifier")) return findFootprintById("fp-d-do41");
    if (normalized.includes("led") && !normalized.includes("driver")) return findFootprintById("fp-led-d5");

    if (normalized.includes("terminal") || normalized.includes("screw")) {
      if (normalized.includes("3") || normalized.includes("03")) return findFootprintById("fp-terminalblock-3p-5mm");
      return findFootprintById("fp-terminalblock-2p-5mm");
    }

    if (normalized.includes("header") || normalized.includes("pin header")) {
      if (normalized.includes("4") || normalized.includes("04")) return findFootprintById("fp-pinheader-1x04");
      if (normalized.includes("3") || normalized.includes("03")) return findFootprintById("fp-pinheader-1x03");
      return findFootprintById("fp-pinheader-1x02");
    }

    if (type === "resistor") {
      if (normalized.includes("0603")) return findFootprintById("fp-r-0603");
      if (normalized.includes("0805") || normalized.includes("2012")) return findFootprintById("fp-r-0805");
      return findFootprintById("fp-r-axial-din0207-p762");
    }

    if (type === "capacitor") {
      if (normalized.includes("0603")) return findFootprintById("fp-c-0603");
      if (normalized.includes("0805") || normalized.includes("2012")) return findFootprintById("fp-c-0805");
      if (normalized.includes("6.3") || normalized.includes("6,3")) return findFootprintById("fp-c-radial-d6-3-p250");
      return findFootprintById("fp-c-radial-d5-p250");
    }

    if (type === "connector") return findFootprintById("fp-pinheader-1x03");
    if (type === "led") return findFootprintById("fp-d-do41");

    if (normalized.includes("soic") || normalized.includes("so-8") || normalized.includes("sop-8")) return findFootprintById("fp-soic-8");
    if (normalized.includes("dip-14") || normalized.includes("pdip-14")) return findFootprintById("fp-dip-14");
    if (normalized.includes("dip-16") || normalized.includes("pdip-16")) return findFootprintById("fp-dip-16");
    if (normalized.includes("dip-28") || normalized.includes("pdip-28")) return findFootprintById("fp-dip-28");
    return findFootprintById("fp-dip-8");
  }

  function pinNamesForCatalog(part: LiveCatalogPart, pinCount: number) {
    const text = `${part.mpn} ${part.description}`.toLowerCase();

    if (text.includes("ne555") || text.includes("555")) {
      return ["GND", "TRIG", "OUT", "RESET", "CTRL", "THRESH", "DISCH", "VCC"];
    }

    if (text.includes("lm358")) {
      return ["OUT A", "IN- A", "IN+ A", "V-", "IN+ B", "IN- B", "OUT B", "V+"];
    }

    if (text.includes("bc547") || text.includes("2n3904") || text.includes("2n3906")) {
      return ["C", "B", "E"];
    }

    if (text.includes("irfz") || text.includes("mosfet")) {
      return ["G", "D", "S"];
    }

    if (text.includes("7805") || text.includes("l7805")) {
      return ["IN", "GND", "OUT"];
    }

    if (text.includes("diode") || text.includes("rectifier") || text.includes("1n400") || text.includes("1n4148")) {
      return ["A", "K"];
    }

    return Array.from({ length: pinCount }, (_, index) => String(index + 1));
  }

  function makePadsFromFootprint(part: LiveCatalogPart, type: ComponentType) {
    const text = `${part.mpn} ${part.description}`.toLowerCase();
    const footprint = inferFootprintFromCatalog(type, text);
    const pinNames = pinNamesForCatalog(part, footprint.pads.length);

    return footprint.pads.map((pad, index) => ({
      ...pad,
      pinName: pinNames[index] ?? pad.pinName ?? pad.id,
    }));
  }

  function createLiveLibraryTemplate(part: LiveCatalogPart): LibraryComponentTemplate {
    const text = `${part.mpn} ${part.description}`.toLowerCase();
    const type = inferComponentTypeFromCatalog(part);
    const footprint = inferFootprintFromCatalog(type, text);
    const prefix = inferPrefixFromCatalog(type, text);
    const mountType = footprint.mountType ?? (footprint.name.includes("SO") || footprint.name.includes("SOT") ? "SMD" : "THT");

    return {
      id: `live-${part.mpn.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      category:
        type === "resistor" ? "Resistors" :
        type === "capacitor" ? "Capacitors" :
        type === "led" ? "Diodes" :
        type === "connector" ? "Connectors" : "ICs",
      label: `${part.mpn} · ${footprint.name}`,
      type,
      prefix,
      value: part.mpn,
      packageName: footprint.name,
      manufacturer: "From live catalog",
      mpn: part.mpn,
      supplier: "Nexar / Octopart live search",
      supplierSku: part.mpn,
      catalogCode: `LIVE-${part.mpn}`,
      orderCode: part.mpn,
      marking: part.mpn,
      mountType,
      description: part.description,
      parameters: {
        Source: "Nexar / Octopart live search",
        "Total availability": String(part.totalAvail),
        Footprint: footprint.name,
        "Footprint category": footprint.category,
        "Footprint description": footprint.description,
        Pitch: footprint.pitch ?? "",
      },
      bodyWidth: footprint.bodyWidth,
      bodyHeight: footprint.bodyHeight,
      pads: makePadsFromFootprint(part, type),
    };
  }

  function addLiveCatalogPartToLocalLibrary(part: LiveCatalogPart) {
    const template = createLiveLibraryTemplate(part);

    setLiveLibraryComponents((prev) => {
      const withoutDuplicate = prev.filter((item) => item.id !== template.id);
      const next = [template, ...withoutDuplicate];
      localStorage.setItem("pcb-forge-live-library", JSON.stringify(next));
      return next;
    });

    setSelectedFootprintId(null);
    setSelectedLibraryComponentId(template.id);
    setTool("add-library-component");
    alert(`Added to local library:\n${template.label}\n\nNow click on the green PCB board to place it.`);
  }

  function inferComponentTypeFromCatalog(part: LiveCatalogPart): ComponentType {
    const text = `${part.mpn} ${part.description}`.toLowerCase();

    if (text.includes("resistor") || text.includes("ohm") || text.includes("Ω")) return "resistor";
    if (text.includes("capacitor") || text.includes("µf") || text.includes("uf") || text.includes("nf") || text.includes("pf")) return "capacitor";
    if (text.includes("diode") || text.includes("rectifier") || text.includes("schottky") || text.includes("led")) return "led";
    if (text.includes("connector") || text.includes("terminal") || text.includes("header")) return "connector";

    return "ic";
  }

  function addLiveCatalogPart(part: LiveCatalogPart) {
    const componentType = inferComponentTypeFromCatalog(part);

    setPendingCatalogPart(part);

    if (componentType === "ic") setTool("add-ic");
    if (componentType === "resistor") setTool("add-resistor");
    if (componentType === "capacitor") setTool("add-capacitor");
    if (componentType === "led") setTool("add-led");
    if (componentType === "connector") setTool("add-connector");

    alert(`Selected catalog part:\n${part.mpn}\n\nNow click on the green PCB board to place it.`);
  }

  function getNetColor(netId: string) {
    return board.nets.find((net) => net.id === netId)?.color ?? "#64748b";
  }

  function getPadNetId(componentId: string, padId: string) {
    const component = board.components.find((item) => item.id === componentId);
    const pad = component?.pads.find((item) => item.id === padId);
    return pad?.netId;
  }

  function assignNetToPad(componentId: string, padId: string, netId: string) {
    setBoard((prev) => ({
      ...prev,
      components: prev.components.map((component) => {
        if (component.id !== componentId) return component;
        return {
          ...component,
          pads: component.pads.map((pad) => (pad.id === padId ? { ...pad, netId } : pad)),
        };
      }),
    }));
    clearDrc();
  }

  function addNet() {
    const name = window.prompt("Net name, for example: SDA, SCL, RESET");
    if (!name) return;

    const cleanName = name.trim().toUpperCase();
    if (!cleanName) return;

    const exists = board.nets.some((net) => net.name === cleanName);
    if (exists) {
      alert("Net already exists.");
      return;
    }

    const colors = ["#9333ea", "#0891b2", "#16a34a", "#ea580c", "#be123c", "#475569"];
    const net = {
      id: `net_${cleanName.toLowerCase()}`,
      name: cleanName,
      color: colors[board.nets.length % colors.length],
    };

    setBoard((prev) => ({ ...prev, nets: [...prev.nets, net] }));
    setActiveNetId(net.id);
    clearDrc();
  }

  function clampPointToBoard(point: Point): Point {
    return {
      x: Math.max(0, Math.min(board.width, point.x)),
      y: Math.max(0, Math.min(board.height, point.y)),
    };
  }

  function selectDrcTarget(issue: DrcIssue) {
    clearSelection();
    if (!issue.targetId) return;
    if (issue.targetType === "component") selectComponent(issue.targetId);
    if (issue.targetType === "trace") selectTrace(issue.targetId);
    if (issue.targetType === "via") selectVia(issue.targetId);
    if (issue.targetType === "zone") selectCopperZone(issue.targetId);
    setActivePanel("checks");
  }

  function applyDrcQuickFix(issue: DrcIssue) {
    if (!issue.targetId) return;

    if (issue.targetType === "trace") {
      setBoard((prev) => ({
        ...prev,
        traces: prev.traces
          .filter((trace) => !(issue.title.toLowerCase().includes("too short") && trace.id === issue.targetId))
          .map((trace) => {
            if (trace.id !== issue.targetId) return trace;
            if (issue.title.toLowerCase().includes("invalid trace net")) {
              return { ...trace, netId: activeNetId };
            }
            if (issue.title.toLowerCase().includes("width")) {
              return { ...trace, width: Math.max(trace.width, prev.designRules.minTraceWidth) };
            }
            if (issue.title.toLowerCase().includes("outside")) {
              return { ...trace, points: trace.points.map(clampPointToBoard) };
            }
            return trace;
          }),
      }));
      clearDrc();
      setTimeout(runDrcCheck, 0);
      return;
    }

    if (issue.targetType === "via") {
      setBoard((prev) => ({
        ...prev,
        vias: prev.vias.map((via) => via.id === issue.targetId
          ? {
              ...via,
              drill: Math.max(via.drill, prev.designRules.minDrill),
              diameter: Math.max(via.diameter, prev.designRules.minViaDiameter),
              x: Math.max(0, Math.min(prev.width, via.x)),
              y: Math.max(0, Math.min(prev.height, via.y)),
            }
          : via
        ),
      }));
      clearDrc();
      setTimeout(runDrcCheck, 0);
      return;
    }

    if (issue.targetType === "zone") {
      setBoard((prev) => ({
        ...prev,
        copperZones: prev.copperZones.map((zone) => zone.id === issue.targetId
          ? {
              ...zone,
              clearance: Math.max(zone.clearance, prev.designRules.minZoneClearance),
              x: Math.max(prev.designRules.copperToBoardEdge, Math.min(prev.width - zone.width - prev.designRules.copperToBoardEdge, zone.x)),
              y: Math.max(prev.designRules.copperToBoardEdge, Math.min(prev.height - zone.height - prev.designRules.copperToBoardEdge, zone.y)),
            }
          : zone
        ),
      }));
      clearDrc();
      setTimeout(runDrcCheck, 0);
      return;
    }

    if (issue.targetType === "component") {
      setBoard((prev) => ({
        ...prev,
        components: prev.components.map((component) => component.id === issue.targetId
          ? { ...component, x: Math.max(30, Math.min(prev.width - 30, component.x)), y: Math.max(30, Math.min(prev.height - 30, component.y)) }
          : component
        ),
      }));
      clearDrc();
      setTimeout(runDrcCheck, 0);
      return;
    }

    if (issue.title.toLowerCase().includes("unconnected")) {
      alert("Suggestion: assign this pad to a net by selecting Route, choosing the correct net, and clicking the pad.");
      return;
    }

    alert("This DRC issue needs manual review. The object has been selected when possible.");
    selectDrcTarget(issue);
  }

  function handleDrcAction(action: string, issue: DrcIssue) {
    if (action === "select") {
      selectDrcTarget(issue);
      return;
    }
    if (action === "rules") {
      setActivePanel("checks");
      return;
    }
    if (action === "quickfix") {
      applyDrcQuickFix(issue);
    }
  }

  function syncSchematicToPcb(payload: SchematicToPcbPayload) {
    const colors = ["#111827", "#dc2626", "#2563eb", "#9333ea", "#0891b2", "#16a34a", "#ea580c"];
    const normalizeNetId = (name: string) => `net_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

    setBoard((prev) => {
      const existingNetIds = new Set(prev.nets.map((net) => net.id));
      const newNets = payload.netNames
        .map((name, index) => ({ id: normalizeNetId(name), name: name.toUpperCase(), color: colors[(prev.nets.length + index) % colors.length] }))
        .filter((net) => !existingNetIds.has(net.id));

      const existingBySource = new Map(prev.components.map((component) => [component.parameters?.schematicSymbolId, component]));
      const components = [...prev.components];

      payload.symbols.forEach((symbol, index) => {
        const existing = existingBySource.get(symbol.id);
        const type = symbol.type === "led" ? "led" : symbol.type;
        const base = existing ?? createComponent(type as ComponentType, 120 + (index % 5) * 120, 90 + Math.floor(index / 5) * 100, components.length + 1);
        const pads = base.pads.map((pad, padIndex) => {
          const pin = symbol.pins[padIndex] ?? symbol.pins.find((item) => item.id === pad.id);
          return {
            ...pad,
            pinName: pin?.name ?? pad.pinName,
            netId: pin?.netName ? normalizeNetId(pin.netName) : pad.netId,
          };
        });
        const nextComponent: PCBComponent = {
          ...base,
          name: existing?.name ?? symbol.name,
          value: symbol.value,
          parameters: { ...(base.parameters ?? {}), schematicSymbolId: symbol.id },
          pads,
        };
        if (existing) {
          const idx = components.findIndex((component) => component.id === existing.id);
          if (idx >= 0) components[idx] = nextComponent;
        } else {
          components.push(nextComponent);
        }
      });

      return { ...prev, nets: [...prev.nets, ...newNets], components };
    });

    setActivePanel("components");
    clearDrc();
  }

  function runDrcCheck() {
    setDrcIssues(runDrc(board));
  }

  function clientToSvgPoint(event: React.MouseEvent<SVGSVGElement | SVGElement>): Point {
    const svg = event.currentTarget.ownerSVGElement || (event.currentTarget as SVGSVGElement);
    const rect = svg.getBoundingClientRect();

    return {
      x: viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width,
      y: viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height,
    };
  }

  function zoomView(factor: number, center?: Point) {
    setViewBox((prev) => {
      const nextWidth = Math.max(MIN_VIEW_WIDTH, Math.min(MAX_VIEW_WIDTH, prev.width * factor));
      const nextHeight = nextWidth * (DEFAULT_VIEWBOX.height / DEFAULT_VIEWBOX.width);
      const zoomCenter = center ?? {
        x: prev.x + prev.width / 2,
        y: prev.y + prev.height / 2,
      };
      const ratioX = (zoomCenter.x - prev.x) / prev.width;
      const ratioY = (zoomCenter.y - prev.y) / prev.height;

      return {
        x: zoomCenter.x - ratioX * nextWidth,
        y: zoomCenter.y - ratioY * nextHeight,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

  function zoomIn() {
    zoomView(0.8);
  }

  function zoomOut() {
    zoomView(1.25);
  }

  function resetView() {
    setViewBox(DEFAULT_VIEWBOX);
  }

  function fitBoardView() {
    setViewBox({
      x: BOARD_OFFSET.x - 60,
      y: BOARD_OFFSET.y - 60,
      width: board.width + 120,
      height: Math.max(420, board.height + 120),
    });
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const center = clientToSvgPoint(event);
    zoomView(event.deltaY < 0 ? 0.88 : 1.12, center);
  }

  function startPan(event: React.MouseEvent<SVGSVGElement>) {
    if (event.button !== 1 && !event.shiftKey) return;
    event.preventDefault();
    setIsPanning(true);
    setPanStart({ clientX: event.clientX, clientY: event.clientY, viewBox });
  }

  function updatePan(event: React.MouseEvent<SVGSVGElement>) {
    if (!isPanning || !panStart) return;

    const svg = event.currentTarget.ownerSVGElement || (event.currentTarget as SVGSVGElement);
    const rect = svg.getBoundingClientRect();
    const dx = ((event.clientX - panStart.clientX) / rect.width) * panStart.viewBox.width;
    const dy = ((event.clientY - panStart.clientY) / rect.height) * panStart.viewBox.height;

    setViewBox({
      ...panStart.viewBox,
      x: panStart.viewBox.x - dx,
      y: panStart.viewBox.y - dy,
    });
  }

  function endPan() {
    setIsPanning(false);
    setPanStart(null);
  }

  function snapToCurrentGrid(value: number) {
    if (!snapEnabled) return Math.round(value * 10) / 10;
    return Math.round(value / gridStep) * gridStep;
  }

  const isBottomMirrored = boardSideMode === "bottom" && flipBottomView;

  function isLayerVisibleForSide(itemLayer: Layer) {
    return boardSideMode === "both" || boardSideMode === itemLayer;
  }

  function clientToBoardPoint(event: React.MouseEvent<SVGSVGElement | SVGElement>): Point {
    const svgPoint = clientToSvgPoint(event);
    const rawX = svgPoint.x - BOARD_OFFSET.x;
    const rawY = svgPoint.y - BOARD_OFFSET.y;

    return {
      x: snapToCurrentGrid(isBottomMirrored ? board.width - rawX : rawX),
      y: snapToCurrentGrid(rawY),
    };
  }

  function isInsideBoard(point: Point) {
    return point.x >= 0 && point.y >= 0 && point.x <= board.width && point.y <= board.height;
  }

  function getNextLibraryIndex(prefix: string) {
    const cleanPrefix = prefix || "X";
    const used = board.components
      .map((component) => component.name)
      .filter((name) => name.startsWith(cleanPrefix))
      .map((name) => Number(name.replace(cleanPrefix, "")))
      .filter((value) => Number.isFinite(value));

    return used.length ? Math.max(...used) + 1 : 1;
  }

  function addLibraryComponent(point: Point) {
    const template = liveLibraryComponents.find((item) => item.id === selectedLibraryComponentId) ?? getLibraryComponentById(selectedLibraryComponentId);

    if (!template) {
      alert("Select a component from the library first.");
      return;
    }

    setBoard((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        createLibraryComponent(template, point.x, point.y, getNextLibraryIndex(template.prefix)),
      ],
    }));

    clearDrc();
    setTool("select");
  }

  function getNextIndexFromComponents(components: PCBComponent[], prefix: string) {
    const cleanPrefix = prefix || "X";
    const used = components
      .map((component) => component.name)
      .filter((name) => name.startsWith(cleanPrefix))
      .map((name) => Number(name.replace(cleanPrefix, "")))
      .filter((value) => Number.isFinite(value));

    return used.length ? Math.max(...used) + 1 : 1;
  }

  function addComponent(type: ComponentType, point: Point) {
    setBoard((prev) => {
      if (pendingCatalogPart) {
        const template = createLiveLibraryTemplate(pendingCatalogPart);
        const index = getNextIndexFromComponents(prev.components, template.prefix);
        const component = createLibraryComponent(template, point.x, point.y, index);

        return {
          ...prev,
          components: [
            ...prev.components,
            {
              ...component,
              totalAvailability: pendingCatalogPart.totalAvail,
              catalogDescription: pendingCatalogPart.description,
            },
          ],
        };
      }

      const baseComponent = createComponent(type, point.x, point.y, prev.components.length + 1);

      return {
        ...prev,
        components: [...prev.components, baseComponent],
      };
    });

    setPendingCatalogPart(null);
    clearDrc();
    setTool("select");
  }

  function addCustomComponent(point: Point) {
    const footprint = board.footprints.find((item) => item.id === selectedFootprintId);
    if (!footprint) {
      alert("Select a custom footprint first.");
      return;
    }

    setBoard((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        createCustomFootprintComponent(footprint, point.x, point.y, prev.components.length + 1),
      ],
    }));
    clearDrc();
    setTool("select");
  }

  function addFootprint(footprint: Footprint) {
    setBoard((prev) => ({ ...prev, footprints: [...prev.footprints, footprint] }));
    setSelectedFootprintId(footprint.id);
    clearDrc();
  }

  function deleteFootprint(id: string) {
    const used = board.components.some((component) => component.footprintId === id);
    if (used) {
      alert("This footprint is used by a component. Delete that component first.");
      return;
    }

    setBoard((prev) => ({ ...prev, footprints: prev.footprints.filter((footprint) => footprint.id !== id) }));
    if (selectedFootprintId === id) setSelectedFootprintId(null);
    clearDrc();
  }

  function updateComponentPosition(id: string, point: Point) {
    setBoard((prev) => ({
      ...prev,
      components: prev.components.map((component) =>
        component.id === id ? { ...component, x: point.x, y: point.y } : component
      ),
    }));
    clearDrc();
  }

  function rotateSelected() {
    if (!selectedComponentId) return;
    setBoard((prev) => ({
      ...prev,
      components: prev.components.map((component) =>
        component.id === selectedComponentId ? { ...component, rotation: (component.rotation + 90) % 360 } : component
      ),
    }));
    clearDrc();
  }

  function deleteSelected() {
    if (!selectedComponentId && !selectedTraceId && !selectedViaId && !selectedMountingHoleId && !selectedSilkscreenId && !selectedCopperZoneId) return;

    setBoard((prev) => ({
      ...prev,
      components: selectedComponentId && !objectLocks.components
        ? prev.components.filter((component) => component.id !== selectedComponentId)
        : prev.components,
      traces: selectedTraceId && !objectLocks.traces
        ? prev.traces.filter((trace) => trace.id !== selectedTraceId)
        : prev.traces,
      vias: selectedViaId && !objectLocks.vias
        ? prev.vias.filter((via) => via.id !== selectedViaId)
        : prev.vias,
      mountingHoles: selectedMountingHoleId && !objectLocks.mountingHoles
        ? prev.mountingHoles.filter((hole) => hole.id !== selectedMountingHoleId)
        : prev.mountingHoles,
      silkscreenItems: selectedSilkscreenId && !objectLocks.silkscreen
        ? prev.silkscreenItems.filter((item) => item.id !== selectedSilkscreenId)
        : prev.silkscreenItems,
      copperZones: selectedCopperZoneId && !objectLocks.copperZones
        ? prev.copperZones.filter((zone) => zone.id !== selectedCopperZoneId)
        : prev.copperZones,
    }));

    clearSelection();
    clearDrc();
  }



  function duplicateSelected() {
    if (selectedComponent && !objectLocks.components) {
      const newId = uid("cmp");
      const clone: PCBComponent = {
        ...selectedComponent,
        id: newId,
        name: `${selectedComponent.name}_COPY`,
        x: selectedComponent.x + 30,
        y: selectedComponent.y + 30,
        pads: selectedComponent.pads.map((pad) => ({
          ...pad,
          id: `${newId}_${pad.id}`,
          componentId: newId,
        })),
      };

      setBoard((prev) => ({ ...prev, components: [...prev.components, clone] }));
      setSelectedComponentId(newId);
      clearDrc();
      return;
    }

    if (selectedTrace && !objectLocks.traces) {
      const newId = uid("trace");
      const clone: Trace = {
        ...selectedTrace,
        id: newId,
        points: selectedTrace.points.map((point) => ({ x: point.x + 20, y: point.y + 20 })),
      };

      setBoard((prev) => ({ ...prev, traces: [...prev.traces, clone] }));
      selectTrace(newId);
      clearDrc();
      return;
    }

    if (selectedVia && !objectLocks.vias) {
      const newId = uid("via");
      const clone: Via = { ...selectedVia, id: newId, x: selectedVia.x + 20, y: selectedVia.y + 20 };
      setBoard((prev) => ({ ...prev, vias: [...prev.vias, clone] }));
      selectVia(newId);
      clearDrc();
      return;
    }

    if (selectedMountingHole && !objectLocks.mountingHoles) {
      const newId = uid("hole");
      const clone: MountingHole = { ...selectedMountingHole, id: newId, x: selectedMountingHole.x + 30, y: selectedMountingHole.y + 30 };
      setBoard((prev) => ({ ...prev, mountingHoles: [...prev.mountingHoles, clone] }));
      selectMountingHole(newId);
      clearDrc();
      return;
    }

    if (selectedSilkscreenItem && !objectLocks.silkscreen) {
      const newId = uid("text");
      const clone: SilkscreenItem = { ...selectedSilkscreenItem, id: newId, x: selectedSilkscreenItem.x + 30, y: selectedSilkscreenItem.y + 20 };
      setBoard((prev) => ({ ...prev, silkscreenItems: [...prev.silkscreenItems, clone] }));
      selectSilkscreenItem(newId);
      clearDrc();
      return;
    }

    if (selectedCopperZone && !objectLocks.copperZones) {
      const newId = uid("zone");
      const clone: CopperZone = { ...selectedCopperZone, id: newId, name: `${selectedCopperZone.name} copy`, x: selectedCopperZone.x + 40, y: selectedCopperZone.y + 40 };
      setBoard((prev) => ({ ...prev, copperZones: [...prev.copperZones, clone] }));
      selectCopperZone(newId);
      clearDrc();
    }
  }

  function addMountingHole(point: Point) {
    const hole: MountingHole = {
      id: uid("mh"),
      x: point.x,
      y: point.y,
      diameter: 36,
      drill: 30,
      plated: false,
    };

    setBoard((prev) => ({
      ...prev,
      mountingHoles: [...prev.mountingHoles, hole],
    }));

    setSelectedMountingHoleId(hole.id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedSilkscreenId(null);
    setTool("select");
    clearDrc();
  }

  function addCornerMountingHoles() {
    const margin = 50;
    const positions = [
      { x: margin, y: margin },
      { x: board.width - margin, y: margin },
      { x: board.width - margin, y: board.height - margin },
      { x: margin, y: board.height - margin },
    ];

    setBoard((prev) => ({
      ...prev,
      mountingHoles: [
        ...prev.mountingHoles,
        ...positions.map((position) => ({
          id: uid("mh"),
          x: position.x,
          y: position.y,
          diameter: 36,
          drill: 30,
          plated: false,
        })),
      ],
    }));

    clearSelection();
    clearDrc();
  }

  function addSilkscreenText(point: Point) {
    const text = window.prompt("Silkscreen text, for example: GND, VCC, IN, OUT, PCB v1.0", "GND");
    if (!text || !text.trim()) {
      setTool("select");
      return;
    }

    const item: SilkscreenItem = {
      id: uid("silk"),
      text: text.trim(),
      x: point.x,
      y: point.y,
      rotation: 0,
      size: 16,
      layer,
    };

    setBoard((prev) => ({
      ...prev,
      silkscreenItems: [...prev.silkscreenItems, item],
    }));

    setSelectedSilkscreenId(item.id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setTool("select");
    clearDrc();
  }

  function addCopperZone(point: Point) {
    const zoneWidth = Math.max(80, board.width - point.x - 30);
    const zoneHeight = Math.max(60, board.height - point.y - 30);

    const zone: CopperZone = {
      id: uid("zone"),
      name: `${getNetName(activeNetId)} copper pour`,
      netId: activeNetId,
      layer,
      x: point.x,
      y: point.y,
      width: Math.min(220, zoneWidth),
      height: Math.min(160, zoneHeight),
      clearance: 8,
      opacity: 0.22,
    };

    setBoard((prev) => ({
      ...prev,
      copperZones: [...prev.copperZones, zone],
    }));

    setSelectedCopperZoneId(zone.id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setSelectedSilkscreenId(null);
    setTool("select");
    clearDrc();
  }

  function addFullBoardCopperZone() {
    const zone: CopperZone = {
      id: uid("zone"),
      name: `${getNetName(activeNetId)} full board pour`,
      netId: activeNetId,
      layer,
      x: 20,
      y: 20,
      width: Math.max(20, board.width - 40),
      height: Math.max(20, board.height - 40),
      clearance: 8,
      opacity: 0.18,
    };

    setBoard((prev) => ({
      ...prev,
      copperZones: [...prev.copperZones, zone],
    }));

    setSelectedCopperZoneId(zone.id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
    setSelectedMountingHoleId(null);
    setSelectedSilkscreenId(null);
    setTool("select");
    clearDrc();
  }

  function addTrace(points: Point[], netId: string, traceLayer: Layer) {
    if (points.length < 2) return;

    const trace: Trace = {
      id: uid("trace"),
      netId,
      layer: traceLayer,
      width: traceWidth,
      points,
    };

    setBoard((prev) => ({ ...prev, traces: [...prev.traces, trace] }));
    clearDrc();
  }

  function appendRoutePoint(rawPoint: Point, exact = false, netId = activeNetId) {
    if (!routeDraft) {
      setRouteDraft({ points: [rawPoint], netId, layer });
      setTool("route");
      return;
    }

    const from = last(routeDraft.points);
    if (!from) return;

    const point = exact ? rawPoint : constrainPoint(from, rawPoint, angleMode);

    if (point.x === from.x && point.y === from.y) return;

    setRouteDraft({
      ...routeDraft,
      points: [...routeDraft.points, point],
    });
  }

  function finishRoute() {
    if (!routeDraft) return;
    addTrace(routeDraft.points, routeDraft.netId, routeDraft.layer);
    setRouteDraft(null);
  }

  function finishRouteAt(rawPoint: Point) {
    if (!routeDraft) return;

    const from = last(routeDraft.points);
    if (!from) return;

    const point = constrainPoint(from, rawPoint, angleMode);
    const points = point.x === from.x && point.y === from.y
      ? routeDraft.points
      : [...routeDraft.points, point];

    addTrace(points, routeDraft.netId, routeDraft.layer);
    setRouteDraft(null);
  }

  function cancelRoute() {
    setRouteDraft(null);
  }

  function placeVia() {
    const viaPoint = routeDraft ? last(routeDraft.points) : mousePos;
    if (!viaPoint || !isInsideBoard(viaPoint)) return;

    const fromLayer = routeDraft?.layer ?? layer;
    const toLayer = oppositeLayer(fromLayer);
    const netId = routeDraft?.netId ?? activeNetId;

    if (routeDraft && routeDraft.points.length >= 2) {
      addTrace(routeDraft.points, routeDraft.netId, routeDraft.layer);
    }

    const via: Via = {
      id: uid("via"),
      netId,
      x: viaPoint.x,
      y: viaPoint.y,
      fromLayer,
      toLayer,
      diameter: 22,
      drill: 10,
    };

    setBoard((prev) => ({ ...prev, vias: [...prev.vias, via] }));
    setLayer(toLayer);
    setRouteDraft({ points: [viaPoint], netId, layer: toLayer });
    setTool("route");
    clearDrc();
  }

  function onBoardClick(event: React.MouseEvent<SVGSVGElement>) {
    const point = clientToBoardPoint(event);
    if (!isInsideBoard(point)) return;

    if (tool === "measure") {
      handleMeasurePoint(point);
      return;
    }

    if (tool === "select") {
      clearSelection();
      return;
    }

    if (tool === "add-library-component") {
      addLibraryComponent(point);
      return;
    }

    if (tool === "add-mounting-hole") {
      addMountingHole(point);
      return;
    }

    if (tool === "add-silkscreen-text") {
      addSilkscreenText(point);
      return;
    }

    if (tool === "add-copper-zone") {
      addCopperZone(point);
      return;
    }

    const componentType = getComponentTypeFromTool(tool);
    if (componentType) {
      addComponent(componentType, point);
      return;
    }

    if (tool === "add-custom-footprint") {
      addCustomComponent(point);
      return;
    }

    if (tool === "route") appendRoutePoint(point);
  }

  function applyLoadedProject(nextBoard: Board, nextLiveLibrary?: LibraryComponentTemplate[]) {
    restoringHistoryRef.current = true;
    setBoard(nextBoard);
    setHistoryState({ items: [nextBoard], index: 0 });
    if (nextLiveLibrary) {
      setLiveLibraryComponents(nextLiveLibrary);
      localStorage.setItem("pcb-forge-live-library", JSON.stringify(nextLiveLibrary));
    }
    clearSelection();
    setRouteDraft(null);
    setDrcIssues([]);
  }

  function downloadTextFile(filename: string, content: string, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportProjectFile() {
    const document = createProjectDocument(board, liveLibraryComponents);
    downloadTextFile(`${safeFilename(board.name)}.pcbforge`, JSON.stringify(document, null, 2));
  }

  function exportJson() {
    downloadTextFile(`${safeFilename(board.name)}.json`, JSON.stringify(board, null, 2));
  }

  async function exportManufacturing() {
    await exportManufacturingPackage(board);
  }

  function saveLocal() {
    const document = createProjectDocument(board, liveLibraryComponents);
    localStorage.setItem("pcb-forge-project", JSON.stringify(document));
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(document));
    setLastAutosaveAt(document.savedAt);
    alert("Project saved in browser.");
  }

  function loadLocal() {
    const saved = localStorage.getItem("pcb-forge-project");
    if (!saved) {
      alert("No saved project found.");
      return;
    }

    try {
      const parsed = parseProjectPayload(saved);
      applyLoadedProject(parsed.board, parsed.liveLibraryComponents);
    } catch {
      alert("Saved project is corrupted.");
    }
  }

  function restoreAutosave() {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) {
      alert("No autosave found.");
      return;
    }

    try {
      const parsed = parseProjectPayload(saved);
      applyLoadedProject(parsed.board, parsed.liveLibraryComponents);
    } catch {
      alert("Autosave is corrupted.");
    }
  }

  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
    setLastAutosaveAt(null);
  }

  function importJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pcbforge,application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = parseProjectPayload(text);

        if (!parsed.board.name || !Array.isArray(parsed.board.components) || !Array.isArray(parsed.board.traces)) {
          alert("Invalid PCB project file.");
          return;
        }

        applyLoadedProject(parsed.board, parsed.liveLibraryComponents);
      } catch {
        alert("Cannot import project file.");
      }
    };
    input.click();
  }

  const activeNetName = board.nets.find((n) => n.id === activeNetId)?.name ?? activeNetId;
  const routePointCount = routeDraft?.points.length ?? 0;
  const routeLastPoint = routeDraft ? last(routeDraft.points) : null;
  const inspectorSummary = selectedComponent
    ? {
        type: "Component",
        title: selectedComponent.name,
        subtitle: `${selectedComponent.type}${selectedComponent.value ? ` · ${selectedComponent.value}` : ""}`,
        meta: selectedComponent.packageName || selectedComponent.footprintName || selectedComponent.mpn || "PCB component",
        locked: objectLocks.components,
      }
    : selectedTrace
      ? {
          type: "Trace",
          title: selectedTrace.id,
          subtitle: `${getNetName(selectedTrace.netId)} · ${selectedTrace.layer}`,
          meta: `${(selectedTrace.width / 10).toFixed(2)} mm · ${selectedTrace.points.length} points`,
          locked: objectLocks.traces,
        }
      : selectedVia
        ? {
            type: "Via",
            title: selectedVia.id,
            subtitle: getNetName(selectedVia.netId),
            meta: `Ø ${(selectedVia.diameter / 10).toFixed(2)} mm · drill ${(selectedVia.drill / 10).toFixed(2)} mm`,
            locked: objectLocks.vias,
          }
        : selectedCopperZone
          ? {
              type: "Copper zone",
              title: selectedCopperZone.name,
              subtitle: `${getNetName(selectedCopperZone.netId)} · ${selectedCopperZone.layer}`,
              meta: `${(selectedCopperZone.width / 10).toFixed(1)} × ${(selectedCopperZone.height / 10).toFixed(1)} mm`,
              locked: objectLocks.copperZones,
            }
          : selectedSilkscreenItem
            ? {
                type: "Silkscreen",
                title: selectedSilkscreenItem.text,
                subtitle: `${selectedSilkscreenItem.layer} layer`,
                meta: `${(selectedSilkscreenItem.size / 10).toFixed(1)} mm · ${selectedSilkscreenItem.rotation}°`,
                locked: objectLocks.silkscreen,
              }
            : selectedMountingHole
              ? {
                  type: "Mounting hole",
                  title: selectedMountingHole.id,
                  subtitle: selectedMountingHole.plated ? "plated" : "non-plated",
                  meta: `Ø ${(selectedMountingHole.diameter / 10).toFixed(2)} mm · drill ${(selectedMountingHole.drill / 10).toFixed(2)} mm`,
                  locked: objectLocks.mountingHoles,
                }
              : null;

  const measurement = getMeasurement();
  const measurePreviewEnd = tool === "measure" && measureStart && !measureEnd ? mousePos : measureEnd;

  return (
    <div className={`app ${darkMode ? "dark" : "light"} ${toolsCollapsed ? "tools-collapsed" : ""} ${inspectorCollapsed ? "inspector-collapsed" : ""}`}>
      <header className="compact-header">
        <div className="brand-block">
          <h1 className="title">PCB Forge</h1>
          <span className="compact-subtitle">PCB editor</span>
        </div>

        <TopMenu
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          setTool={setTool}
          runDrcCheck={runDrcCheck}
          exportProjectFile={exportProjectFile}
          exportManufacturing={exportManufacturing}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          toolsCollapsed={toolsCollapsed}
          setToolsCollapsed={setToolsCollapsed}
          inspectorCollapsed={inspectorCollapsed}
          setInspectorCollapsed={setInspectorCollapsed}
        />
      </header>

            <main className="workspace-layout">
        <section className="canvas-shell">
          {activePanel === "schematic" ? (
            <SchematicWorkspace
              onSendNetsToPcb={(netNames) => {
                netNames.forEach((name) => {
                  const cleanName = name.trim().toUpperCase();
                  if (!cleanName) return;
                  setBoard((prev) => {
                    const id = `net_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
                    if (prev.nets.some((net) => net.id === id || net.name === cleanName)) return prev;
                    return { ...prev, nets: [...prev.nets, { id, name: cleanName, color: "#0891b2" }] };
                  });
                });
              }}
              onSendToPcb={syncSchematicToPcb}
            />
          ) : (
            <>
          <div className="status-bar status-bar-strong">
            PCB Board · Alat: <strong>{tool}</strong> · Layer: <strong>{layer}</strong> · Ugao: <strong>{angleMode === "orthogonal" ? "90°" : "45°"}</strong> · Net: <strong>{activeNetName}</strong> · Ratsnest: <strong>{showRatsnest ? ratsnestConnections.length : 0}</strong> · Locked: <strong>{Object.values(objectLocks).filter(Boolean).length}</strong> · Measure: <strong>{measurement ? `${measurement.lengthMm.toFixed(2)} mm` : tool === "measure" ? "active" : "off"}</strong> · Grid: <strong>{(gridStep / 10).toFixed(2)}mm</strong> · Snap: <strong>{snapEnabled ? "on" : "off"}</strong> · Visible: <strong>{Object.values(layerVisibility).filter(Boolean).length}/7</strong> · Zoom: <strong>{Math.round((DEFAULT_VIEWBOX.width / viewBox.width) * 100)}%</strong> · Miš: {mousePos.x}, {mousePos.y}
          </div>
          <div className="pcb-help-strip compact-help">
            <span><strong>PCB:</strong> Parts → klik ploča · Route → pad → pad · Esc prekid · Desni klik završava rutu · Točkić = zoom</span>
          </div>
          <svg
            width="100%"
            height="650"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="board-svg"
            onWheel={handleWheel}
            onMouseDown={startPan}
            onClick={onBoardClick}
            onContextMenu={(event) => {
              event.preventDefault();
              if (routeDraft) {
                const point = clientToBoardPoint(event);
                if (isInsideBoard(point)) {
                  finishRouteAt(point);
                } else {
                  finishRoute();
                }
              }
            }}
            onMouseMove={(event) => {
              updatePan(event);
              const point = clientToBoardPoint(event);
              setMousePos(point);
              if (!isPanning && draggingId) updateComponentPosition(draggingId, point);
            }}
            onMouseUp={() => {
              setDraggingId(null);
              endPan();
            }}
            onMouseLeave={() => {
              setDraggingId(null);
              endPan();
            }}
          >
            <defs>
              <pattern id="smallGrid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
                <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke="#d6dde8" strokeWidth="0.8" />
              </pattern>
              <pattern id="largeGrid" width={gridStep * 5} height={gridStep * 5} patternUnits="userSpaceOnUse">
                <rect width={gridStep * 5} height={gridStep * 5} fill="url(#smallGrid)" />
                <path d={`M ${gridStep * 5} 0 L 0 0 0 ${gridStep * 5}`} fill="none" stroke="#b8c2d1" strokeWidth="1" />
              </pattern>
            </defs>
            {showGrid && <rect x="-3000" y="-3000" width="7000" height="7000" fill="url(#largeGrid)" />}
            <g transform={`translate(${BOARD_OFFSET.x}, ${BOARD_OFFSET.y})`}>
              <g transform={isBottomMirrored ? `translate(${board.width},0) scale(-1,1)` : undefined}>
              <rect x="0" y="0" width={board.width} height={board.height} rx="12" fill="#0f766e" fillOpacity="0.12" stroke="#0f766e" strokeWidth="3" />
              <text x="14" y="28" className="svg-text-small">{board.name} — {board.width / 10}mm × {board.height / 10}mm</text>


              {showRatsnest && layerVisibility.ratsnest && ratsnestConnections.map((connection) => (
                <line
                  key={connection.id}
                  x1={connection.from.x}
                  y1={connection.from.y}
                  x2={connection.to.x}
                  y2={connection.to.y}
                  stroke={getNetColor(connection.netId)}
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  opacity={highlightActiveNet && connection.netId !== activeNetId ? 0.16 : 0.72}
                  pointerEvents="none"
                >
                  <title>{`${getNetName(connection.netId)}: ${connection.fromLabel} → ${connection.toLabel}`}</title>
                </line>
              ))}

              {layerVisibility.copperZones && board.copperZones.filter((zone) => isLayerVisibleForSide(zone.layer)).map((zone) => {
                const isSelected = zone.id === selectedCopperZoneId;
                return (
                  <g
                    key={zone.id}
                    style={{ cursor: tool === "select" ? "pointer" : "crosshair" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (tool === "select") selectCopperZone(zone.id);
                    }}
                  >
                    {isSelected && (
                      <rect
                        x={zone.x - 4}
                        y={zone.y - 4}
                        width={zone.width + 8}
                        height={zone.height + 8}
                        rx="8"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="4"
                      />
                    )}
                    <rect
                      x={zone.x}
                      y={zone.y}
                      width={zone.width}
                      height={zone.height}
                      rx="6"
                      fill={getNetColor(zone.netId)}
                      fillOpacity={zone.opacity}
                      stroke={getNetColor(zone.netId)}
                      strokeWidth="2"
                      strokeDasharray={zone.layer === "top" ? "" : "8 6"}
                    />
                    <text
                      x={zone.x + 10}
                      y={zone.y + 20}
                      className="svg-text-small"
                      fill={getNetColor(zone.netId)}
                      pointerEvents="none"
                    >
                      {zone.name} · {zone.layer}
                    </text>
                  </g>
                );
              })}

              {board.traces.map((trace) => {
                if ((trace.layer === "top" && !layerVisibility.topCopper) || (trace.layer === "bottom" && !layerVisibility.bottomCopper)) return null;
                const isSelected = trace.id === selectedTraceId;
                const points = trace.points.map((p) => `${p.x},${p.y}`).join(" ");

                return (
                  <g key={trace.id}>
                    <polyline
                      points={points}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(trace.width + 16, 20)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ cursor: tool === "select" ? "pointer" : "crosshair" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (tool === "select") selectTrace(trace.id);
                      }}
                    />
                    {isSelected && (
                      <polyline
                        points={points}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={trace.width + 8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.7"
                        pointerEvents="none"
                      />
                    )}
                    <polyline
                      points={points}
                      fill="none"
                      stroke={getNetColor(trace.netId)}
                      strokeWidth={trace.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={highlightActiveNet && trace.netId !== activeNetId ? 0.18 : trace.layer === "top" ? 1 : 0.72}
                      pointerEvents="none"
                    />
                    {isSelected && trace.points.map((point, index) => (
                      <circle
                        key={`${trace.id}-node-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill="#f59e0b"
                        stroke="#111827"
                        strokeWidth="1"
                        pointerEvents="none"
                      />
                    ))}
                  </g>
                );
              })}

              {layerVisibility.vias && board.vias.map((via) => {
                const isSelected = via.id === selectedViaId;

                return (
                  <g
                    key={via.id}
                    style={{ cursor: tool === "select" ? "pointer" : "crosshair" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (tool === "select") selectVia(via.id);
                    }}
                  >
                    {isSelected && (
                      <circle
                        cx={via.x}
                        cy={via.y}
                        r={via.diameter / 2 + 8}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="4"
                      />
                    )}
                    <circle cx={via.x} cy={via.y} r={via.diameter / 2} fill={getNetColor(via.netId)} stroke="#111827" strokeWidth="2" />
                    <circle cx={via.x} cy={via.y} r={via.drill / 2} fill="#ffffff" stroke="#111827" strokeWidth="1" />
                  </g>
                );
              })}

              {layerVisibility.mountingHoles && board.mountingHoles.map((hole) => {
                const isSelected = hole.id === selectedMountingHoleId;

                return (
                  <g
                    key={hole.id}
                    style={{ cursor: tool === "select" ? "pointer" : "crosshair" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (tool === "select") selectMountingHole(hole.id);
                    }}
                  >
                    {isSelected && (
                      <circle
                        cx={hole.x}
                        cy={hole.y}
                        r={hole.diameter / 2 + 9}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="4"
                      />
                    )}
                    <circle
                      cx={hole.x}
                      cy={hole.y}
                      r={hole.diameter / 2}
                      fill="#e5e7eb"
                      stroke="#111827"
                      strokeWidth="2"
                    />
                    <circle
                      cx={hole.x}
                      cy={hole.y}
                      r={hole.drill / 2}
                      fill="#ffffff"
                      stroke="#111827"
                      strokeWidth="1"
                    />
                    <text
                      x={hole.x}
                      y={hole.y - hole.diameter / 2 - 7}
                      textAnchor="middle"
                      className="component-label-small"
                    >
                      M
                    </text>
                  </g>
                );
              })}

              {layerVisibility.silkscreen && board.silkscreenItems.filter((item) => isLayerVisibleForSide(item.layer)).map((item) => {
                const isSelected = item.id === selectedSilkscreenId;
                return (
                  <g
                    key={item.id}
                    transform={`translate(${item.x}, ${item.y}) rotate(${item.rotation})`}
                    style={{ cursor: tool === "select" ? "pointer" : "crosshair" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (tool === "select") selectSilkscreenItem(item.id);
                    }}
                  >
                    {isSelected && (
                      <rect
                        x={-(item.text.length * item.size * 0.32)}
                        y={-item.size}
                        width={Math.max(28, item.text.length * item.size * 0.64)}
                        height={item.size * 1.35}
                        rx="4"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                      />
                    )}
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      fontSize={item.size}
                      fontFamily="monospace"
                      fontWeight="700"
                      fill={item.layer === "top" ? "#f8fafc" : "#93c5fd"}
                      stroke="#0f172a"
                      strokeWidth="0.35"
                      paintOrder="stroke"
                      opacity={item.layer === "top" ? 1 : 0.65}
                    >
                      {item.text}
                    </text>
                  </g>
                );
              })}

              {routeDraft && (
                <polyline
                  points={routeDraft.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={getNetColor(routeDraft.netId)}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={routeDraft.layer === "top" ? 0.9 : 0.65}
                />
              )}

              {routeDraft && previewPoint && routeLastPoint && tool === "route" && (
                <line
                  x1={routeLastPoint.x}
                  y1={routeLastPoint.y}
                  x2={previewPoint.x}
                  y2={previewPoint.y}
                  stroke={getNetColor(routeDraft.netId)}
                  strokeWidth="5"
                  strokeDasharray="8 8"
                  strokeLinecap="round"
                  opacity={routeDraft.layer === "top" ? 0.9 : 0.65}
                />
              )}

              {measureStart && measurePreviewEnd && (
                <g pointerEvents="none">
                  <line
                    x1={measureStart.x}
                    y1={measureStart.y}
                    x2={measurePreviewEnd.x}
                    y2={measurePreviewEnd.y}
                    stroke="#0f172a"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                  />
                  <circle cx={measureStart.x} cy={measureStart.y} r="6" fill="#0f172a" />
                  <circle cx={measurePreviewEnd.x} cy={measurePreviewEnd.y} r="6" fill="#0f172a" />
                  <text
                    x={(measureStart.x + measurePreviewEnd.x) / 2 + 8}
                    y={(measureStart.y + measurePreviewEnd.y) / 2 - 8}
                    className="svg-text-small"
                  >
                    {measurement ? `${measurement.lengthMm.toFixed(2)} mm` : "measure..."}
                  </text>
                </g>
              )}

              {board.components.map((component) => (
                <ComponentView
                  key={component.id}
                  component={component}
                  selected={component.id === selectedComponentId}
                  tool={tool}
                  routeDraft={routeDraft}
                  appendRoutePoint={appendRoutePoint}
                  finishRouteFromPad={(point, netId) => {
                    if (!routeDraft) return;
                    addTrace([...routeDraft.points, point], netId, routeDraft.layer);
                    setRouteDraft(null);
                  }}
                  selectComponent={selectComponent}
                  setDraggingId={setDraggingId}
                  activeNetId={activeNetId}
                  getPadNetId={getPadNetId}
                  assignNetToPad={assignNetToPad}
                  getNetColor={getNetColor}
                  canDragComponent={!objectLocks.components}
                />
              ))}
              </g>
            </g>
          </svg>
            </>
          )}
        </section>

        {!inspectorCollapsed && <aside className="inspector-panel">
          <section className="panel inspector-header">
            <div className="panel-head">
              <h2 className="panel-title">Inspector</h2>
              <span className="muted">selected object</span>
            </div>
            <p className="small-help">Klikni komponentu, vod, via, zonu, tekst ili rupu. Ovde se prikazuju samo parametri izabranog objekta.</p>
          </section>

          <InspectorActions
            summary={inspectorSummary}
            hasSelection={Boolean(inspectorSummary)}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
            onRotate={rotateSelected}
            onClear={clearSelection}
            canRotate={Boolean(selectedComponent)}
          />

          {selectedComponent && (
            <PropertiesPanel selectedComponent={selectedComponent} nets={board.nets} updateSelectedComponent={updateSelectedComponent} />
          )}

          {(selectedTrace || selectedVia) && (
            <RouteEditPanel
              selectedTrace={selectedTrace}
              selectedVia={selectedVia}
              nets={board.nets}
              updateSelectedTrace={updateSelectedTrace}
              updateSelectedVia={updateSelectedVia}
              deleteSelected={deleteSelected}
              getNetName={getNetName}
            />
          )}

          {selectedCopperZone && (
            <CopperZonePanel
              selectedCopperZone={selectedCopperZone}
              nets={board.nets}
              setTool={setTool}
              addFullBoardCopperZone={addFullBoardCopperZone}
              updateSelectedCopperZone={updateSelectedCopperZone}
              deleteSelected={deleteSelected}
              getNetName={getNetName}
              compactMode
            />
          )}

          {selectedSilkscreenItem && (
            <SilkscreenPanel
              selectedSilkscreenItem={selectedSilkscreenItem}
              setTool={setTool}
              updateSelectedSilkscreenItem={updateSelectedSilkscreenItem}
              deleteSelected={deleteSelected}
              compactMode
            />
          )}

          {selectedMountingHole && (
            <MountingHolePanel
              selectedMountingHole={selectedMountingHole}
              setTool={setTool}
              addCornerMountingHoles={addCornerMountingHoles}
              updateSelectedMountingHole={updateSelectedMountingHole}
              deleteSelected={deleteSelected}
              compactMode
            />
          )}

          {!selectedComponent && !selectedTrace && !selectedVia && !selectedCopperZone && !selectedSilkscreenItem && !selectedMountingHole && (
            <>
              <BoardSettingsPanel board={board} updateBoard={updateBoardSettings} />
              <section className="panel">
                <h2 className="panel-title">Selection</h2>
                <p className="small-help muted">Nema izabranog objekta. Izaberi element na PCB ploči ili koristi meni levo za dodavanje novih objekata.</p>
              </section>
            </>
          )}
        </aside>}

        {!toolsCollapsed && <aside className="sidebar sidebar-single-panel">
          <section className="panel active-tool-panel">
            <div className="panel-head">
              <h2 className="panel-title">Tool panel</h2>
              <span className="muted">{activePanel}</span>
            </div>
            <p className="small-help">Leva zona prikazuje samo alate iz izabrane grupe. Desno je Inspector za izabrani objekat.</p>
          </section>

          {activePanel === "schematic" && (
            <section className="panel">
              <h2 className="panel-title">Schematic workspace</h2>
              <p className="small-help muted">Schematic is shown in the main work area. Use it to draw symbols, connect pins, then sync parts and nets to PCB.</p>
              <button className="btn" onClick={() => setActivePanel("components")}>Back to PCB parts</button>
              <button className="btn" onClick={() => setActivePanel("nets")}>View PCB nets</button>
            </section>
          )}

          {activePanel === "components" && (
            <>
              <ComponentLibrary
                footprints={board.footprints}
                selectedFootprintId={selectedFootprintId}
                selectedLibraryComponentId={selectedLibraryComponentId}
                setSelectedFootprintId={setSelectedFootprintId}
                setSelectedLibraryComponentId={setSelectedLibraryComponentId}
                setTool={setTool}
                extraComponents={liveLibraryComponents}
              />
              <FootprintLibraryPanel
                savedFootprints={board.footprints}
                selectedFootprintId={selectedFootprintId}
                addFootprint={addFootprint}
                setSelectedFootprintId={setSelectedFootprintId}
                setTool={setTool}
              />
              <FootprintEditor footprints={board.footprints} addFootprint={addFootprint} deleteFootprint={deleteFootprint} />
            </>
          )}

          {activePanel === "catalog" && (
            <>
              <LiveCatalogSearch onAddCatalogPart={addLiveCatalogPart} onAddToLocalLibrary={addLiveCatalogPartToLocalLibrary} />
              <BomPanel components={board.components} />
            </>
          )}

          {activePanel === "routing" && (
            <>
              <LayerPanel layer={layer} setLayer={setLayer} />
              <RoutePanel
                angleMode={angleMode}
                setAngleMode={setAngleMode}
                traceWidth={traceWidth}
                setTraceWidth={setTraceWidth}
                routePointCount={routePointCount}
                routeLayer={routeDraft?.layer ?? null}
                routeLastPoint={routeLastPoint}
                finishRoute={finishRoute}
                cancelRoute={cancelRoute}
                placeVia={placeVia}
              />
              <RatsnestPanel
                showRatsnest={showRatsnest}
                setShowRatsnest={setShowRatsnest}
                ratsnestMode={ratsnestMode}
                setRatsnestMode={setRatsnestMode}
                highlightActiveNet={highlightActiveNet}
                setHighlightActiveNet={setHighlightActiveNet}
                connectionCount={ratsnestConnections.length}
                activeNetName={activeNetName}
              />

            </>
          )}

          {activePanel === "zones" && (
            <CopperZonePanel
              selectedCopperZone={selectedCopperZone}
              nets={board.nets}
              setTool={setTool}
              addFullBoardCopperZone={addFullBoardCopperZone}
              updateSelectedCopperZone={updateSelectedCopperZone}
              deleteSelected={deleteSelected}
              getNetName={getNetName}
            />
          )}

          {activePanel === "silkscreen" && (
            <SilkscreenPanel
              selectedSilkscreenItem={selectedSilkscreenItem}
              setTool={setTool}
              updateSelectedSilkscreenItem={updateSelectedSilkscreenItem}
              deleteSelected={deleteSelected}
            />
          )}

          {activePanel === "mechanical" && (
            <MountingHolePanel
              selectedMountingHole={selectedMountingHole}
              setTool={setTool}
              addCornerMountingHoles={addCornerMountingHoles}
              updateSelectedMountingHole={updateSelectedMountingHole}
              deleteSelected={deleteSelected}
            />
          )}


          {activePanel === "selection" && (
            <>
              <ObjectNavigatorPanel
                board={board}
                selectedComponentId={selectedComponentId}
                selectedTraceId={selectedTraceId}
                selectedViaId={selectedViaId}
                selectedMountingHoleId={selectedMountingHoleId}
                selectedSilkscreenId={selectedSilkscreenId}
                selectedCopperZoneId={selectedCopperZoneId}
                selectComponent={selectComponent}
                selectTrace={selectTrace}
                selectVia={selectVia}
                selectMountingHole={selectMountingHole}
                selectSilkscreenItem={selectSilkscreenItem}
                selectCopperZone={selectCopperZone}
                clearSelection={clearSelection}
                getNetName={getNetName}
              />
              <SelectionFilterPanel
                selectionFilter={selectionFilter}
                objectLocks={objectLocks}
                setSelectionFilterValue={setSelectionFilterValue}
                setObjectLockValue={setObjectLockValue}
                enableAllSelection={enableAllSelection}
                unlockAllObjects={unlockAllObjects}
                selectOnly={selectOnly}
              />
            </>
          )}

          {activePanel === "shortcuts" && (
            <ShortcutPanel
              setActivePanel={setActivePanel}
              setTool={setTool}
              runDrcCheck={runDrcCheck}
              exportProjectFile={exportProjectFile}
              exportManufacturing={exportManufacturing}
            />
          )}

          {activePanel === "board" && (
            <>
              <BoardSettingsPanel board={board} updateBoard={updateBoardSettings} />
              <ViewPanel
                zoomPercent={Math.round((DEFAULT_VIEWBOX.width / viewBox.width) * 100)}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                resetView={resetView}
                fitBoardView={fitBoardView}
              />
              <GridSettingsPanel
                gridStep={gridStep}
                setGridStep={setGridStep}
                snapEnabled={snapEnabled}
                setSnapEnabled={setSnapEnabled}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
              />
              <LayerVisibilityPanel
                layerVisibility={layerVisibility}
                setLayerVisibilityValue={setLayerVisibilityValue}
                showAllDisplayLayers={showAllDisplayLayers}
                hideNonEssentialLayers={hideNonEssentialLayers}
              />
              <BoardSidePanel
                boardSideMode={boardSideMode}
                setBoardSideMode={setBoardSideMode}
                flipBottomView={flipBottomView}
                setFlipBottomView={setFlipBottomView}
              />
              <HistoryPanel
                canUndo={canUndo}
                canRedo={canRedo}
                undoLastAction={undoLastAction}
                redoLastAction={redoLastAction}
                historyCount={historyState.items.length}
                currentIndex={historyState.index}
              />
              <MeasurePanel
                setTool={setTool}
                measureStart={measureStart}
                measureEnd={measureEnd}
                measurement={measurement}
                clearMeasurement={clearMeasurement}
              />
            </>
          )}

          {activePanel === "nets" && (
            <>
              <NetPanel nets={board.nets} activeNetId={activeNetId} setActiveNetId={setActiveNetId} addNet={addNet} />
              <RatsnestPanel
                showRatsnest={showRatsnest}
                setShowRatsnest={setShowRatsnest}
                ratsnestMode={ratsnestMode}
                setRatsnestMode={setRatsnestMode}
                highlightActiveNet={highlightActiveNet}
                setHighlightActiveNet={setHighlightActiveNet}
                connectionCount={ratsnestConnections.length}
                activeNetName={activeNetName}
              />
              <NetlistPanel board={board} />
            </>
          )}

          {activePanel === "circuit" && (
            <CircuitTestPanel board={board} getNetName={getNetName} />
          )}

          {activePanel === "checks" && (
            <>
              <DesignRulesPanel rules={board.designRules} updateRules={updateDesignRules} />
              <DrcPanel issues={drcIssues} runDrcCheck={runDrcCheck} onAction={handleDrcAction} />
              <CircuitTestPanel board={board} getNetName={getNetName} />
              <section className="panel">
                <h2 className="panel-title">Project summary</h2>
                <div className="stack">
                  <Row label="Components" value={String(board.components.length)} />
                  <Row label="Traces" value={String(board.traces.length)} />
                  <Row label="Vias" value={String(board.vias.length)} />
                  <Row label="Mounting holes" value={String(board.mountingHoles.length)} />
                  <Row label="Silkscreen texts" value={String(board.silkscreenItems.length)} />
                  <Row label="Copper zones" value={String(board.copperZones.length)} />
                  <Row label="Nets" value={String(board.nets.length)} />
                  <Row label="Footprints" value={String(board.footprints.length)} />
                  <Row label="Grid" value={`${(gridStep / 10).toFixed(2)} mm`} />
                  <Row label="Min trace" value={`${(board.designRules.minTraceWidth / 10).toFixed(2)} mm`} />
                  <Row label="Min clearance" value={`${(board.designRules.minClearance / 10).toFixed(2)} mm`} />
                </div>
              </section>
            </>
          )}

          {activePanel === "project" && (
            <ProjectFilePanel
              board={board}
              version={PROJECT_FILE_VERSION}
              lastAutosaveAt={lastAutosaveAt}
              exportProjectFile={exportProjectFile}
              exportJson={exportJson}
              importProjectFile={importJson}
              saveLocal={saveLocal}
              loadLocal={loadLocal}
              restoreAutosave={restoreAutosave}
              clearAutosave={clearAutosave}
              liveLibraryCount={liveLibraryComponents.length}
            />
          )}

          {activePanel === "bom" && (
            <>
              <BomPanel components={board.components} />
              <section className="panel">
                <h2 className="panel-title">Export</h2>
                <button className="btn" onClick={exportProjectFile}>Export .pcbforge project</button>
                <button className="btn" onClick={exportJson}>Export raw board JSON</button>
                <button className="btn" onClick={exportManufacturing}>Manufacturing export</button>
              </section>
            </>
          )}
        </aside>}
      </main>
    </div>
  );
}



type ActivePanel =
  | "components"
  | "catalog"
  | "routing"
  | "zones"
  | "silkscreen"
  | "mechanical"
  | "board"
  | "nets"
  | "checks"
  | "bom"
  | "selection"
  | "shortcuts"
  | "schematic"
  | "circuit"
  | "project";

function TopMenu({
  activePanel,
  setActivePanel,
  setTool,
  runDrcCheck,
  exportProjectFile,
  exportManufacturing,
  darkMode,
  setDarkMode,
  toolsCollapsed,
  setToolsCollapsed,
  inspectorCollapsed,
  setInspectorCollapsed,
}: {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  setTool: (tool: Tool) => void;
  runDrcCheck: () => void;
  exportProjectFile: () => void;
  exportManufacturing: () => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toolsCollapsed: boolean;
  setToolsCollapsed: (value: boolean) => void;
  inspectorCollapsed: boolean;
  setInspectorCollapsed: (value: boolean) => void;
}) {
  const items: { id: ActivePanel; label: string; hint: string }[] = [
    { id: "project", label: "Project", hint: "Open, save, autosave" },
    { id: "components", label: "Parts", hint: "Component and footprint library" },
    { id: "catalog", label: "Catalog", hint: "Live MPN search" },
    { id: "routing", label: "Route", hint: "Routing, vias, ratsnest" },
    { id: "selection", label: "Select", hint: "Selection filters and locks" },
    { id: "board", label: "View", hint: "Board, grid, zoom, history and side view" },
    { id: "nets", label: "Nets", hint: "Nets and netlist" },
    { id: "checks", label: "DRC", hint: "Design rules, smart fixes, circuit test" },
    { id: "schematic", label: "Schematic", hint: "Separated schematic workspace" },
    { id: "bom", label: "BOM", hint: "BOM and manufacturing export" },
    { id: "shortcuts", label: "Shortcuts", hint: "Keyboard shortcuts" },
  ];

  return (
    <div className="compact-command-bar no-overlap-menu">
      <div className="menu-cluster">
        <label className="menu-label">Workspace</label>
        <select
          className="workspace-select"
          value={activePanel}
          onChange={(event) => setActivePanel(event.target.value as ActivePanel)}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>

      <div className="quick-tool-strip compact" aria-label="Quick PCB tools">
        <button className="quick-tool" onClick={() => setTool("select")} title="V - Select">Select</button>
        <button className="quick-tool primary" onClick={() => { setActivePanel("routing"); setTool("route"); }} title="R - Route">Route</button>
        <button className="quick-tool" onClick={() => { setActivePanel("silkscreen"); setTool("add-silkscreen-text"); }} title="T - Add text">Text</button>
        <button className="quick-tool" onClick={() => { setActivePanel("zones"); setTool("add-copper-zone"); }} title="Z - Copper zone">Zone</button>
        <button className="quick-tool" onClick={() => { setActivePanel("mechanical"); setTool("add-mounting-hole"); }} title="H - Mounting hole">Hole</button>
        <button className="quick-tool" onClick={() => { setActivePanel("board"); setTool("measure"); }} title="M - Measure">Measure</button>
      </div>

      <details className="all-functions-menu">
        <summary>All functions</summary>
        <div className="all-functions-grid">
          {items.map((item) => (
            <button key={item.id} onClick={() => setActivePanel(item.id)} className={activePanel === item.id ? "active" : ""}>
              <strong>{item.label}</strong><span>{item.hint}</span>
            </button>
          ))}
        </div>
      </details>

      <div className="quick-tool-strip compact actions" aria-label="Actions">
        <button className="quick-tool" onClick={runDrcCheck}>DRC</button>
        <button className="quick-tool" onClick={exportProjectFile}>Save</button>
        <button className="quick-tool" onClick={exportManufacturing}>Export</button>
        <button className="quick-tool" onClick={() => setDarkMode(!darkMode)}>{darkMode ? "Light" : "Dark"}</button>
        <button className={`quick-tool ${toolsCollapsed ? "active" : ""}`} onClick={() => setToolsCollapsed(!toolsCollapsed)}>{toolsCollapsed ? "Show tools" : "Hide tools"}</button>
        <button className={`quick-tool ${inspectorCollapsed ? "active" : ""}`} onClick={() => setInspectorCollapsed(!inspectorCollapsed)}>{inspectorCollapsed ? "Show inspector" : "Hide inspector"}</button>
      </div>
    </div>
  );
}

function ObjectNavigatorPanel({
  board,
  selectedComponentId,
  selectedTraceId,
  selectedViaId,
  selectedMountingHoleId,
  selectedSilkscreenId,
  selectedCopperZoneId,
  selectComponent,
  selectTrace,
  selectVia,
  selectMountingHole,
  selectSilkscreenItem,
  selectCopperZone,
  clearSelection,
  getNetName,
}: {
  board: Board;
  selectedComponentId: string | null;
  selectedTraceId: string | null;
  selectedViaId: string | null;
  selectedMountingHoleId: string | null;
  selectedSilkscreenId: string | null;
  selectedCopperZoneId: string | null;
  selectComponent: (id: string) => void;
  selectTrace: (id: string) => void;
  selectVia: (id: string) => void;
  selectMountingHole: (id: string) => void;
  selectSilkscreenItem: (id: string) => void;
  selectCopperZone: (id: string) => void;
  clearSelection: () => void;
  getNetName: (netId: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<
    "all" | "components" | "traces" | "vias" | "zones" | "text" | "holes"
  >("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const items = [
      ...board.components.map((item) => ({
        id: item.id,
        group: "components" as const,
        type: "Component",
        label: item.name,
        detail: [item.value, item.packageName || item.footprintName, item.mpn].filter(Boolean).join(" · "),
        selected: selectedComponentId === item.id,
        select: () => selectComponent(item.id),
      })),
      ...board.traces.map((item) => ({
        id: item.id,
        group: "traces" as const,
        type: "Trace",
        label: item.id,
        detail: `${getNetName(item.netId)} · ${item.layer} · ${(item.width / 10).toFixed(2)}mm`,
        selected: selectedTraceId === item.id,
        select: () => selectTrace(item.id),
      })),
      ...board.vias.map((item) => ({
        id: item.id,
        group: "vias" as const,
        type: "Via",
        label: item.id,
        detail: `${getNetName(item.netId)} · ${item.x}, ${item.y}`,
        selected: selectedViaId === item.id,
        select: () => selectVia(item.id),
      })),
      ...board.copperZones.map((item) => ({
        id: item.id,
        group: "zones" as const,
        type: "Zone",
        label: item.name,
        detail: `${getNetName(item.netId)} · ${item.layer} · ${(item.width / 10).toFixed(1)}×${(item.height / 10).toFixed(1)}mm`,
        selected: selectedCopperZoneId === item.id,
        select: () => selectCopperZone(item.id),
      })),
      ...board.silkscreenItems.map((item) => ({
        id: item.id,
        group: "text" as const,
        type: "Text",
        label: item.text,
        detail: `${item.layer} · ${(item.size / 10).toFixed(1)}mm`,
        selected: selectedSilkscreenId === item.id,
        select: () => selectSilkscreenItem(item.id),
      })),
      ...board.mountingHoles.map((item) => ({
        id: item.id,
        group: "holes" as const,
        type: "Hole",
        label: item.id,
        detail: `${item.plated ? "plated" : "NPTH"} · drill ${(item.drill / 10).toFixed(1)}mm`,
        selected: selectedMountingHoleId === item.id,
        select: () => selectMountingHole(item.id),
      })),
    ];

    return items.filter((item) => {
      if (group !== "all" && item.group !== group) return false;
      if (!q) return true;
      return `${item.type} ${item.label} ${item.detail}`.toLowerCase().includes(q);
    });
  }, [
    board,
    query,
    group,
    selectedComponentId,
    selectedTraceId,
    selectedViaId,
    selectedMountingHoleId,
    selectedSilkscreenId,
    selectedCopperZoneId,
    selectComponent,
    selectTrace,
    selectVia,
    selectMountingHole,
    selectSilkscreenItem,
    selectCopperZone,
    getNetName,
  ]);

  return (
    <section className="panel object-navigator-panel">
      <div className="panel-head">
        <h2 className="panel-title">Object navigator</h2>
        <button className="btn btn-small" onClick={clearSelection}>Clear</button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search R1, NE555, GND, zone, text..."
      />

      <div className="object-filter-row">
        {[
          ["all", "All"],
          ["components", "Parts"],
          ["traces", "Routes"],
          ["vias", "Vias"],
          ["zones", "Zones"],
          ["text", "Text"],
          ["holes", "Holes"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={group === id ? "chip active" : "chip"}
            onClick={() => setGroup(id as typeof group)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="object-list">
        {rows.length === 0 ? (
          <p className="small-help muted">No objects match this filter.</p>
        ) : (
          rows.map((item) => (
            <button
              key={`${item.group}-${item.id}`}
              className={item.selected ? "object-row selected" : "object-row"}
              onClick={item.select}
              title={item.detail}
            >
              <span className="object-type">{item.type}</span>
              <span className="object-main">{item.label}</span>
              <span className="object-detail">{item.detail || "—"}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function SelectionFilterPanel({
  selectionFilter,
  objectLocks,
  setSelectionFilterValue,
  setObjectLockValue,
  enableAllSelection,
  unlockAllObjects,
  selectOnly,
}: {
  selectionFilter: SelectionFilter;
  objectLocks: ObjectLocks;
  setSelectionFilterValue: (type: SelectableObjectType, value: boolean) => void;
  setObjectLockValue: (type: SelectableObjectType, value: boolean) => void;
  enableAllSelection: () => void;
  unlockAllObjects: () => void;
  selectOnly: (type: SelectableObjectType) => void;
}) {
  const rows: { id: SelectableObjectType; label: string; hint: string }[] = [
    { id: "components", label: "Components", hint: "Otpornici, IC, konektori i ostali delovi" },
    { id: "traces", label: "Traces", hint: "Vodovi/rute" },
    { id: "vias", label: "Vias", hint: "Prelazi između layera" },
    { id: "copperZones", label: "Copper zones", hint: "Copper pour zone" },
    { id: "silkscreen", label: "Silkscreen", hint: "Tekst i oznake" },
    { id: "mountingHoles", label: "Mounting holes", hint: "Rupe za šrafove" },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Selection filter / Lock</h2>
        <span className="muted">select mode</span>
      </div>

      <div className="grid-two">
        <button className="btn" onClick={enableAllSelection}>Select all types</button>
        <button className="btn" onClick={unlockAllObjects}>Unlock all</button>
      </div>

      <div className="stack" style={{ marginTop: 10 }}>
        {rows.map((row) => (
          <div key={row.id} className="selection-row">
            <div>
              <strong>{row.label}</strong>
              <p className="small-help muted">{row.hint}</p>
            </div>
            <div className="selection-actions">
              <button className="btn btn-small" onClick={() => selectOnly(row.id)}>Only</button>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={selectionFilter[row.id]}
                  onChange={(event) => setSelectionFilterValue(row.id, event.target.checked)}
                />
                Select
              </label>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={objectLocks[row.id]}
                  onChange={(event) => setObjectLockValue(row.id, event.target.checked)}
                />
                Lock
              </label>
            </div>
          </div>
        ))}
      </div>

      <p className="small-help muted">
        Lock sprečava selekciju, pomeranje i brisanje izabrane grupe. Filter određuje šta se može kliknuti u Select režimu.
      </p>
    </section>
  );
}


function GridSettingsPanel({
  gridStep,
  setGridStep,
  snapEnabled,
  setSnapEnabled,
  showGrid,
  setShowGrid,
}: {
  gridStep: number;
  setGridStep: (value: number) => void;
  snapEnabled: boolean;
  setSnapEnabled: (value: boolean) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
}) {
  const options = [2.5, 5, 10, 20, 25, 50];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Grid / Snap</h2>
        <span className="muted">{(gridStep / 10).toFixed(2)} mm</span>
      </div>

      <div className="stack">
        <label className="field-label">
          Grid size
          <select
            value={gridStep}
            onChange={(event) => setGridStep(Number(event.target.value))}
          >
            {options.map((value) => (
              <option key={value} value={value}>{(value / 10).toFixed(2)} mm</option>
            ))}
          </select>
        </label>

        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(event) => setSnapEnabled(event.target.checked)}
          />
          Snap to grid
        </label>

        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(event) => setShowGrid(event.target.checked)}
          />
          Show grid
        </label>
      </div>

      <p className="small-help muted">
        Grid size controls component placement, routing points, vias, holes and measurement coordinates. Turn snap off for fine placement.
      </p>
    </section>
  );
}

function LayerVisibilityPanel({
  layerVisibility,
  setLayerVisibilityValue,
  showAllDisplayLayers,
  hideNonEssentialLayers,
}: {
  layerVisibility: LayerVisibility;
  setLayerVisibilityValue: (key: keyof LayerVisibility, value: boolean) => void;
  showAllDisplayLayers: () => void;
  hideNonEssentialLayers: () => void;
}) {
  const items: { key: keyof LayerVisibility; label: string; hint: string }[] = [
    { key: "topCopper", label: "Top copper", hint: "Top layer traces" },
    { key: "bottomCopper", label: "Bottom copper", hint: "Bottom layer traces" },
    { key: "vias", label: "Vias", hint: "Via holes" },
    { key: "copperZones", label: "Copper zones", hint: "Copper pour polygons" },
    { key: "silkscreen", label: "Silkscreen", hint: "Board text labels" },
    { key: "mountingHoles", label: "Mounting holes", hint: "Mechanical holes" },
    { key: "ratsnest", label: "Ratsnest", hint: "Connection guide lines" },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Layer visibility</h2>
        <span className="muted">display</span>
      </div>

      <div className="grid-two">
        <button className="btn" onClick={showAllDisplayLayers}>Show all</button>
        <button className="btn" onClick={hideNonEssentialLayers}>Copper only</button>
      </div>

      <div className="stack" style={{ marginTop: 10 }}>
        {items.map((item) => (
          <label key={item.key} className="check-row" title={item.hint}>
            <input
              type="checkbox"
              checked={layerVisibility[item.key]}
              onChange={(event) => setLayerVisibilityValue(item.key, event.target.checked)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function MeasurePanel({
  setTool,
  measureStart,
  measureEnd,
  measurement,
  clearMeasurement,
}: {
  setTool: (tool: Tool) => void;
  measureStart: Point | null;
  measureEnd: Point | null;
  measurement: { dxMm: number; dyMm: number; lengthMm: number } | null;
  clearMeasurement: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Measure tool</h2>
        <button className="btn" onClick={() => setTool("measure")}>Measure</button>
      </div>

      <div className="stack">
        <div className="row"><span className="muted">Start</span><strong>{measureStart ? `${measureStart.x}, ${measureStart.y}` : "not set"}</strong></div>
        <div className="row"><span className="muted">End</span><strong>{measureEnd ? `${measureEnd.x}, ${measureEnd.y}` : "not set"}</strong></div>
        <div className="row"><span className="muted">Distance</span><strong>{measurement ? `${measurement.lengthMm.toFixed(2)} mm` : "—"}</strong></div>
        <div className="row"><span className="muted">ΔX / ΔY</span><strong>{measurement ? `${measurement.dxMm.toFixed(2)} / ${measurement.dyMm.toFixed(2)} mm` : "—"}</strong></div>
        <button className="btn" onClick={clearMeasurement}>Clear measurement</button>
      </div>

      <p className="small-help muted">Klikni Measure, zatim klikni dve tačke na PCB ploči. ESC briše aktivno merenje.</p>
    </section>
  );
}

function ProjectFilePanel({
  board,
  version,
  lastAutosaveAt,
  exportProjectFile,
  exportJson,
  importProjectFile,
  saveLocal,
  loadLocal,
  restoreAutosave,
  clearAutosave,
  liveLibraryCount,
}: {
  board: Board;
  version: string;
  lastAutosaveAt: string | null;
  exportProjectFile: () => void;
  exportJson: () => void;
  importProjectFile: () => void;
  saveLocal: () => void;
  loadLocal: () => void;
  restoreAutosave: () => void;
  clearAutosave: () => void;
  liveLibraryCount: number;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Project file</h2>
        <span className="muted">v{version}</span>
      </div>

      <div className="stack">
        <Row label="Project" value={board.name} />
        <Row label="Components" value={String(board.components.length)} />
        <Row label="Nets" value={String(board.nets.length)} />
        <Row label="Live library" value={String(liveLibraryCount)} />
        <Row label="Autosave" value={lastAutosaveAt ? new Date(lastAutosaveAt).toLocaleString() : "none"} />
      </div>

      <div className="grid-two">
        <button className="btn" onClick={exportProjectFile}>Export .pcbforge</button>
        <button className="btn" onClick={importProjectFile}>Import project</button>
        <button className="btn" onClick={saveLocal}>Save browser</button>
        <button className="btn" onClick={loadLocal}>Load browser</button>
        <button className="btn" onClick={restoreAutosave}>Restore autosave</button>
        <button className="btn" onClick={clearAutosave}>Clear autosave</button>
      </div>

      <button className="btn" onClick={exportJson}>Export raw board JSON</button>

      <p className="small-help muted">.pcbforge čuva ploču, live biblioteku i verziju formata. Import i dalje podržava stari .json projekat.</p>
    </section>
  );
}

function ShortcutPanel({
  setActivePanel,
  setTool,
  runDrcCheck,
  exportProjectFile,
  exportManufacturing,
}: {
  setActivePanel: (panel: ActivePanel) => void;
  setTool: (tool: Tool) => void;
  runDrcCheck: () => void;
  exportProjectFile: () => void;
  exportManufacturing: () => Promise<void>;
}) {
  const shortcuts = [
    ["V", "Select tool"],
    ["R", "Route tool"],
    ["T", "Add silkscreen text"],
    ["M", "Measure tool"],
    ["H", "Place mounting hole"],
    ["Z", "Place copper zone"],
    ["C", "Components panel"],
    ["L", "Live catalog panel"],
    ["D", "DRC panel"],
    ["B", "BOM / export panel"],
    ["P", "Project panel"],
    ["Del", "Delete selected object"],
    ["Esc", "Cancel route / measurement"],
    ["Ctrl+Z", "Undo"],
    ["Ctrl+Y", "Redo"],
  ];

  return (
    <section className="panel">
      <h2 className="panel-title">Shortcuts / Quick actions</h2>
      <p className="small-help muted">Keyboard shortcuts work when you are not typing in an input field.</p>

      <div className="grid-two" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => { setActivePanel("components"); setTool("select"); }}>Components</button>
        <button className="btn" onClick={() => { setActivePanel("routing"); setTool("route"); }}>Route</button>
        <button className="btn" onClick={() => { setActivePanel("silkscreen"); setTool("add-silkscreen-text"); }}>+ Text</button>
        <button className="btn" onClick={() => { setActivePanel("zones"); setTool("add-copper-zone"); }}>+ Zone</button>
        <button className="btn" onClick={() => { setActivePanel("mechanical"); setTool("add-mounting-hole"); }}>+ Hole</button>
        <button className="btn" onClick={() => { setActivePanel("board"); setTool("measure"); }}>Measure</button>
        <button className="btn" onClick={runDrcCheck}>Run DRC</button>
        <button className="btn" onClick={exportProjectFile}>Save .pcbforge</button>
        <button className="btn" onClick={exportManufacturing}>Manufacturing export</button>
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        {shortcuts.map(([key, label]) => (
          <div className="row" key={key}>
            <span className="muted">{label}</span>
            <strong>{key}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}


function InspectorActions({
  summary,
  hasSelection,
  onDelete,
  onDuplicate,
  onRotate,
  onClear,
  canRotate,
}: {
  summary: { type: string; title: string; subtitle: string; meta: string; locked: boolean } | null;
  hasSelection: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onRotate: () => void;
  onClear: () => void;
  canRotate: boolean;
}) {
  if (!summary) {
    return (
      <section className="panel inspector-object-card empty">
        <div className="object-type-pill">Board</div>
        <h2 className="panel-title">No object selected</h2>
        <p className="small-help muted">Click an object on the board. The inspector will switch to component, route, via, zone, text or hole settings.</p>
      </section>
    );
  }

  return (
    <section className="panel inspector-object-card">
      <div className="inspector-object-top">
        <span className="object-type-pill">{summary.type}</span>
        {summary.locked && <span className="object-lock-pill">Locked</span>}
      </div>
      <h2 className="inspector-object-title">{summary.title}</h2>
      <p className="inspector-object-subtitle">{summary.subtitle}</p>
      <p className="small-help muted">{summary.meta}</p>

      <div className="inspector-actions-row">
        {canRotate && <button className="btn" onClick={onRotate} disabled={!hasSelection || summary.locked}>Rotate</button>}
        <button className="btn" onClick={onDuplicate} disabled={!hasSelection || summary.locked}>Duplicate</button>
        <button className="btn btn-danger" onClick={onDelete} disabled={!hasSelection || summary.locked}>Delete</button>
        <button className="btn" onClick={onClear}>Clear</button>
      </div>
    </section>
  );
}

function ViewPanel({
  zoomPercent,
  zoomIn,
  zoomOut,
  resetView,
  fitBoardView,
}: {
  zoomPercent: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitBoardView: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">View / Zoom</h2>
        <span className="muted">{zoomPercent}%</span>
      </div>
      <div className="grid-two">
        <button className="btn" onClick={zoomIn}>Zoom +</button>
        <button className="btn" onClick={zoomOut}>Zoom -</button>
        <button className="btn" onClick={fitBoardView}>Fit board</button>
        <button className="btn" onClick={resetView}>Reset</button>
      </div>
      <p className="small-help muted">Mouse wheel zooms. Hold Shift and drag the board, or drag with middle mouse, to pan.</p>
    </section>
  );
}

function HistoryPanel({
  canUndo,
  canRedo,
  undoLastAction,
  redoLastAction,
  historyCount,
  currentIndex,
}: {
  canUndo: boolean;
  canRedo: boolean;
  undoLastAction: () => void;
  redoLastAction: () => void;
  historyCount: number;
  currentIndex: number;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">History</h2>
        <span className="muted">{currentIndex + 1}/{historyCount}</span>
      </div>
      <div className="grid-two">
        <button className="btn" onClick={undoLastAction} disabled={!canUndo}>Undo</button>
        <button className="btn" onClick={redoLastAction} disabled={!canRedo}>Redo</button>
      </div>
      <p className="small-help muted">Shortcuts: Ctrl+Z for undo, Ctrl+Y or Ctrl+Shift+Z for redo.</p>
    </section>
  );
}


function RatsnestPanel({
  showRatsnest,
  setShowRatsnest,
  ratsnestMode,
  setRatsnestMode,
  highlightActiveNet,
  setHighlightActiveNet,
  connectionCount,
  activeNetName,
}: {
  showRatsnest: boolean;
  setShowRatsnest: (value: boolean) => void;
  ratsnestMode: RatsnestMode;
  setRatsnestMode: (mode: RatsnestMode) => void;
  highlightActiveNet: boolean;
  setHighlightActiveNet: (value: boolean) => void;
  connectionCount: number;
  activeNetName: string;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Ratsnest / net guide</h2>
        <span className="muted">{connectionCount} lines</span>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={showRatsnest}
          onChange={(event) => setShowRatsnest(event.target.checked)}
        />
        Show unrouted connection guide
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={highlightActiveNet}
          onChange={(event) => setHighlightActiveNet(event.target.checked)}
        />
        Highlight active net and dim others
      </label>

      <label className="field-label mt-3">
        Ratsnest mode
        <select
          value={ratsnestMode}
          onChange={(event) => setRatsnestMode(event.target.value as RatsnestMode)}
        >
          <option value="all">All nets</option>
          <option value="active">Only active net: {activeNetName}</option>
        </select>
      </label>

      <p className="small-help muted">
        Dashed lines show logical connections between pads/vias that share the same net. Use this before routing to see what still needs to be connected.
      </p>
    </section>
  );
}

function RouteEditPanel({
  selectedTrace,
  selectedVia,
  nets,
  updateSelectedTrace,
  updateSelectedVia,
  deleteSelected,
  getNetName,
}: {
  selectedTrace: Trace | null;
  selectedVia: Via | null;
  nets: Board["nets"];
  updateSelectedTrace: (patch: Partial<Trace>) => void;
  updateSelectedVia: (patch: Partial<Via>) => void;
  deleteSelected: () => void;
  getNetName: (netId: string) => string;
}) {
  if (!selectedTrace && !selectedVia) {
    return (
      <section className="panel">
        <h2 className="panel-title">Route edit</h2>
        <p className="small-help muted">Select a trace or via on the PCB board to edit or delete it.</p>
      </section>
    );
  }

  if (selectedTrace) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Selected trace</h2>
          <button onClick={deleteSelected} className="btn btn-danger">Delete</button>
        </div>

        <div className="stack">
          <div className="row"><span className="muted">ID</span><strong>{selectedTrace.id}</strong></div>
          <div className="row"><span className="muted">Net</span><strong>{getNetName(selectedTrace.netId)}</strong></div>

          <label className="field-label">
            Net
            <select
              value={selectedTrace.netId}
              onChange={(event) => updateSelectedTrace({ netId: event.target.value })}
            >
              {nets.map((net) => (
                <option key={net.id} value={net.id}>{net.name}</option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Layer
            <select
              value={selectedTrace.layer}
              onChange={(event) => updateSelectedTrace({ layer: event.target.value as Layer })}
            >
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>

          <label className="field-label">
            Width mm
            <input
              type="number"
              min="0.2"
              step="0.1"
              value={(selectedTrace.width / 10).toFixed(1)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  updateSelectedTrace({ width: Math.max(2, Math.round(value * 10)) });
                }
              }}
            />
          </label>

          <div className="row"><span className="muted">Points</span><strong>{selectedTrace.points.length}</strong></div>
          <p className="small-help muted">Shortcut: press Delete or Backspace to remove selected trace.</p>
        </div>
      </section>
    );
  }

  if (!selectedVia) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Selected via</h2>
        <button onClick={deleteSelected} className="btn btn-danger">Delete</button>
      </div>

      <div className="stack">
        <div className="row"><span className="muted">ID</span><strong>{selectedVia.id}</strong></div>
        <div className="row"><span className="muted">Net</span><strong>{getNetName(selectedVia.netId)}</strong></div>

        <label className="field-label">
          Net
          <select
            value={selectedVia.netId}
            onChange={(event) => updateSelectedVia({ netId: event.target.value })}
          >
            {nets.map((net) => (
              <option key={net.id} value={net.id}>{net.name}</option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Diameter mm
          <input
            type="number"
            min="0.4"
            step="0.1"
            value={(selectedVia.diameter / 10).toFixed(1)}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                updateSelectedVia({ diameter: Math.max(4, Math.round(value * 10)) });
              }
            }}
          />
        </label>

        <label className="field-label">
          Drill mm
          <input
            type="number"
            min="0.2"
            step="0.1"
            value={(selectedVia.drill / 10).toFixed(1)}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                updateSelectedVia({ drill: Math.max(2, Math.round(value * 10)) });
              }
            }}
          />
        </label>

        <div className="row"><span className="muted">Position</span><strong>{selectedVia.x}, {selectedVia.y}</strong></div>
        <p className="small-help muted">Shortcut: press Delete or Backspace to remove selected via.</p>
      </div>
    </section>
  );
}



function CopperZonePanel({
  selectedCopperZone,
  nets,
  setTool,
  addFullBoardCopperZone,
  updateSelectedCopperZone,
  deleteSelected,
  getNetName,
  compactMode = false,
}: {
  selectedCopperZone: CopperZone | null;
  nets: Board["nets"];
  setTool: (tool: Tool) => void;
  addFullBoardCopperZone: () => void;
  updateSelectedCopperZone: (patch: Partial<CopperZone>) => void;
  deleteSelected: () => void;
  getNetName: (netId: string) => string;
  compactMode?: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Copper zones</h2>
        {selectedCopperZone && (
          <button className="btn btn-danger" onClick={deleteSelected}>Delete</button>
        )}
      </div>

      <div className="grid-two">
        <button className="btn" onClick={() => setTool("add-copper-zone")}>Place zone</button>
        <button className="btn" onClick={addFullBoardCopperZone}>Full board zone</button>
      </div>

      {!selectedCopperZone ? (
        <p className="small-help muted">Choose active net/layer, click Place zone, then click the PCB. Zones are exported as basic Gerber filled polygons.</p>
      ) : (
        <div className="stack mt-3">
          <div className="row"><span className="muted">ID</span><strong>{selectedCopperZone.id}</strong></div>
          <div className="row"><span className="muted">Net</span><strong>{getNetName(selectedCopperZone.netId)}</strong></div>

          <label className="field-label">
            Name
            <input
              value={selectedCopperZone.name}
              onChange={(event) => updateSelectedCopperZone({ name: event.target.value })}
            />
          </label>

          <label className="field-label">
            Net
            <select
              value={selectedCopperZone.netId}
              onChange={(event) => updateSelectedCopperZone({ netId: event.target.value })}
            >
              {nets.map((net) => (
                <option key={net.id} value={net.id}>{net.name}</option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Layer
            <select
              value={selectedCopperZone.layer}
              onChange={(event) => updateSelectedCopperZone({ layer: event.target.value as Layer })}
            >
              <option value="top">Top copper</option>
              <option value="bottom">Bottom copper</option>
            </select>
          </label>

          <div className="grid-two">
            <label className="field-label">
              X mm
              <input type="number" step="0.5" value={(selectedCopperZone.x / 10).toFixed(1)} onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedCopperZone({ x: Math.round(value * 10) });
              }} />
            </label>
            <label className="field-label">
              Y mm
              <input type="number" step="0.5" value={(selectedCopperZone.y / 10).toFixed(1)} onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedCopperZone({ y: Math.round(value * 10) });
              }} />
            </label>
          </div>

          <div className="grid-two">
            <label className="field-label">
              Width mm
              <input type="number" min="1" step="0.5" value={(selectedCopperZone.width / 10).toFixed(1)} onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedCopperZone({ width: Math.max(10, Math.round(value * 10)) });
              }} />
            </label>
            <label className="field-label">
              Height mm
              <input type="number" min="1" step="0.5" value={(selectedCopperZone.height / 10).toFixed(1)} onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedCopperZone({ height: Math.max(10, Math.round(value * 10)) });
              }} />
            </label>
          </div>

          <div className="grid-two">
            <label className="field-label">
              Clearance mm
              <input type="number" min="0.2" step="0.1" value={(selectedCopperZone.clearance / 10).toFixed(1)} onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedCopperZone({ clearance: Math.max(2, Math.round(value * 10)) });
              }} />
            </label>
            <label className="field-label">
              Opacity
              <input type="number" min="0.05" max="0.8" step="0.05" value={selectedCopperZone.opacity} onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedCopperZone({ opacity: Math.max(0.05, Math.min(0.8, value)) });
              }} />
            </label>
          </div>

          <p className="small-help muted">This is a rectangular copper pour. Real thermal relief and polygon clipping can be added in the next step.</p>
        </div>
      )}
    </section>
  );
}

function MountingHolePanel({
  selectedMountingHole,
  setTool,
  addCornerMountingHoles,
  updateSelectedMountingHole,
  deleteSelected,
  compactMode = false,
}: {
  selectedMountingHole: MountingHole | null;
  setTool: (tool: Tool) => void;
  addCornerMountingHoles: () => void;
  updateSelectedMountingHole: (patch: Partial<MountingHole>) => void;
  deleteSelected: () => void;
  compactMode?: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Mounting holes</h2>
        {selectedMountingHole && (
          <button className="btn btn-danger" onClick={deleteSelected}>Delete</button>
        )}
      </div>

      <div className="grid-two">
        <button className="btn" onClick={() => setTool("add-mounting-hole")}>Place hole</button>
        <button className="btn" onClick={addCornerMountingHoles}>4 corner holes</button>
      </div>

      {!selectedMountingHole ? (
        <p className="small-help muted">Click Place hole, then click on the PCB board. Select a hole to edit drill and diameter.</p>
      ) : (
        <div className="stack mt-3">
          <div className="row"><span className="muted">ID</span><strong>{selectedMountingHole.id}</strong></div>
          <div className="row"><span className="muted">Position</span><strong>{selectedMountingHole.x}, {selectedMountingHole.y}</strong></div>

          <label className="field-label">
            X mm
            <input
              type="number"
              step="0.5"
              value={(selectedMountingHole.x / 10).toFixed(1)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedMountingHole({ x: Math.round(value * 10) });
              }}
            />
          </label>

          <label className="field-label">
            Y mm
            <input
              type="number"
              step="0.5"
              value={(selectedMountingHole.y / 10).toFixed(1)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedMountingHole({ y: Math.round(value * 10) });
              }}
            />
          </label>

          <label className="field-label">
            Diameter mm
            <input
              type="number"
              min="1"
              step="0.1"
              value={(selectedMountingHole.diameter / 10).toFixed(1)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedMountingHole({ diameter: Math.max(10, Math.round(value * 10)) });
              }}
            />
          </label>

          <label className="field-label">
            Drill mm
            <input
              type="number"
              min="0.5"
              step="0.1"
              value={(selectedMountingHole.drill / 10).toFixed(1)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateSelectedMountingHole({ drill: Math.max(5, Math.round(value * 10)) });
              }}
            />
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={selectedMountingHole.plated}
              onChange={(event) => updateSelectedMountingHole({ plated: event.target.checked })}
            />
            Plated mounting hole
          </label>

          <p className="small-help muted">Non-plated holes are exported as mechanical drill holes. Use plated only if you intentionally need copper around the screw hole.</p>
        </div>
      )}
    </section>
  );
}

function SilkscreenPanel({
  selectedSilkscreenItem,
  setTool,
  updateSelectedSilkscreenItem,
  deleteSelected,
  compactMode = false,
}: {
  selectedSilkscreenItem: SilkscreenItem | null;
  setTool: (tool: Tool) => void;
  updateSelectedSilkscreenItem: (patch: Partial<SilkscreenItem>) => void;
  deleteSelected: () => void;
  compactMode?: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Silkscreen text</h2>
        {selectedSilkscreenItem && (
          <button className="btn btn-danger" onClick={deleteSelected}>Delete</button>
        )}
      </div>

      <button className="btn" onClick={() => setTool("add-silkscreen-text")}>Add text</button>

      {!selectedSilkscreenItem ? (
        <p className="small-help muted">Click Add text, then click on the PCB. Use this for GND, VCC, IN, OUT, board version, connector labels and warnings.</p>
      ) : (
        <div className="stack mt-3">
          <label className="field-label">
            Text
            <input
              value={selectedSilkscreenItem.text}
              onChange={(event) => updateSelectedSilkscreenItem({ text: event.target.value })}
            />
          </label>

          <div className="grid-two">
            <label className="field-label">
              X mm
              <input
                type="number"
                step="0.5"
                value={(selectedSilkscreenItem.x / 10).toFixed(1)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) updateSelectedSilkscreenItem({ x: Math.round(value * 10) });
                }}
              />
            </label>

            <label className="field-label">
              Y mm
              <input
                type="number"
                step="0.5"
                value={(selectedSilkscreenItem.y / 10).toFixed(1)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) updateSelectedSilkscreenItem({ y: Math.round(value * 10) });
                }}
              />
            </label>
          </div>

          <div className="grid-two">
            <label className="field-label">
              Size mm
              <input
                type="number"
                min="0.8"
                step="0.1"
                value={(selectedSilkscreenItem.size / 10).toFixed(1)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) updateSelectedSilkscreenItem({ size: Math.max(8, Math.round(value * 10)) });
                }}
              />
            </label>

            <label className="field-label">
              Rotation
              <input
                type="number"
                step="15"
                value={selectedSilkscreenItem.rotation}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) updateSelectedSilkscreenItem({ rotation: value });
                }}
              />
            </label>
          </div>

          <label className="field-label">
            Layer
            <select
              value={selectedSilkscreenItem.layer}
              onChange={(event) => updateSelectedSilkscreenItem({ layer: event.target.value as Layer })}
            >
              <option value="top">Top silkscreen</option>
              <option value="bottom">Bottom silkscreen</option>
            </select>
          </label>

          <p className="small-help muted">Select text on the PCB and press Delete/Backspace to remove it.</p>
        </div>
      )}
    </section>
  );
}

function ComponentView({
  component,
  selected,
  tool,
  routeDraft,
  appendRoutePoint,
  finishRouteFromPad,
  selectComponent,
  setDraggingId,
  activeNetId,
  getPadNetId,
  assignNetToPad,
  getNetColor,
  canDragComponent,
}: {
  component: PCBComponent;
  selected: boolean;
  tool: Tool;
  routeDraft: RouteDraft | null;
  appendRoutePoint: (point: Point, exact?: boolean, netId?: string) => void;
  finishRouteFromPad: (point: Point, netId: string) => void;
  selectComponent: (id: string) => void;
  setDraggingId: (id: string | null) => void;
  activeNetId: string;
  getPadNetId: (componentId: string, padId: string) => string | undefined;
  assignNetToPad: (componentId: string, padId: string, netId: string) => void;
  getNetColor: (netId: string) => string;
  canDragComponent: boolean;
}) {
  const pads = getAbsolutePads(component);

  return (
    <g>
      <g
        transform={`translate(${component.x}, ${component.y}) rotate(${component.rotation})`}
        onMouseDown={(event) => {
          event.stopPropagation();
          selectComponent(component.id);
          if (tool === "select" && canDragComponent) setDraggingId(component.id);
        }}
        onClick={(event) => {
          event.stopPropagation();
          selectComponent(component.id);
        }}
        style={{ cursor: canDragComponent ? "move" : "not-allowed" }}
      >
        <ComponentBody component={component} selected={selected} />
      </g>

      {pads.map((pad) => (
        <g key={pad.id}>
          <rect
            x={pad.x - pad.width / 2}
            y={pad.y - pad.height / 2}
            width={pad.width}
            height={pad.height}
            rx="4"
            fill={pad.netId ? getNetColor(pad.netId) : "#facc15"}
            stroke="#854d0e"
            strokeWidth="2"
            onClick={(event) => {
              event.stopPropagation();
              if (tool !== "route") return;

              const point = { x: pad.x, y: pad.y };
              const existingNetId = getPadNetId(component.id, pad.id);
              const netId = existingNetId ?? routeDraft?.netId ?? activeNetId;

              assignNetToPad(component.id, pad.id, netId);

              if (routeDraft) {
                finishRouteFromPad(point, netId);
              } else {
                appendRoutePoint(point, true, netId);
              }
            }}
          />
          {pad.pinName && (
            <text
              x={pad.x}
              y={pad.y - pad.height / 2 - 4}
              textAnchor="middle"
              className="pin-label"
              pointerEvents="none"
            >
              {pad.pinName}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function ComponentBody({ component, selected }: { component: PCBComponent; selected: boolean }) {
  const stroke = selected ? "#f59e0b" : "#c2410c";
  const fill = selected ? "#fef3c7" : "#fff7ed";
  const valueLabel = component.value || component.mpn || component.packageName || component.footprintName || "";
  const packageLabel = component.packageName || component.footprintName || "";

  function LabelBlock({ y = 5, compact = false }: { y?: number; compact?: boolean }) {
    return (
      <>
        <text x="0" y={y} textAnchor="middle" className={compact ? "component-label-small" : "component-label"}>{component.name}</text>
        {valueLabel && <text x="0" y={y + 16} textAnchor="middle" className="component-value-label">{valueLabel}</text>}
        {selected && packageLabel && <text x="0" y={y + 31} textAnchor="middle" className="component-package-label">{packageLabel}</text>}
      </>
    );
  }

  if (component.type === "custom") {
    const width = component.bodyWidth ?? 80;
    const height = component.bodyHeight ?? 40;
    return (
      <>
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="8" fill={fill} stroke={stroke} strokeWidth="2" />
        <LabelBlock y={valueLabel ? -4 : 5} />
      </>
    );
  }

  if (component.type === "ic") {
    const width = component.bodyWidth ?? 60;
    const height = component.bodyHeight ?? 90;
    return (
      <>
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="6" fill={fill} stroke={stroke} strokeWidth="2" />
        <circle cx={-width / 2 + 12} cy={-height / 2 + 13} r="4" fill="#111827" />
        <LabelBlock y={valueLabel ? -6 : 5} />
      </>
    );
  }

  if (component.type === "connector") {
    return (
      <>
        <rect x="-45" y="-18" width="90" height="36" rx="6" fill={fill} stroke={stroke} strokeWidth="2" />
        <LabelBlock y={valueLabel ? -4 : 5} compact />
      </>
    );
  }

  if (component.type === "led") {
    return (
      <>
        <circle cx="0" cy="0" r="22" fill={fill} stroke={stroke} strokeWidth="2" />
        <LabelBlock y={valueLabel ? -4 : 5} compact />
      </>
    );
  }

  if (component.type === "capacitor") {
    return (
      <>
        <line x1="-25" y1="-22" x2="-25" y2="22" stroke={stroke} strokeWidth="4" />
        <line x1="25" y1="-22" x2="25" y2="22" stroke={stroke} strokeWidth="4" />
        <text x="0" y="-30" textAnchor="middle" className="component-label">{component.name}</text>
        {valueLabel && <text x="0" y="38" textAnchor="middle" className="component-value-label">{valueLabel}</text>}
      </>
    );
  }

  return (
    <>
      <rect x="-36" y="-16" width="72" height="32" rx="7" fill={fill} stroke={stroke} strokeWidth="2" />
      <line x1="-50" y1="0" x2="-36" y2="0" stroke={stroke} strokeWidth="3" />
      <line x1="36" y1="0" x2="50" y2="0" stroke={stroke} strokeWidth="3" />
      <LabelBlock y={valueLabel ? -4 : 5} />
    </>
  );
}


function BoardSidePanel({
  boardSideMode,
  setBoardSideMode,
  flipBottomView,
  setFlipBottomView,
}: {
  boardSideMode: "top" | "bottom" | "both";
  setBoardSideMode: (mode: "top" | "bottom" | "both") => void;
  flipBottomView: boolean;
  setFlipBottomView: (value: boolean) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Board side</h2>
        <span className="muted">{boardSideMode}{boardSideMode === "bottom" && flipBottomView ? " mirrored" : ""}</span>
      </div>
      <div className="grid-three">
        <button className={`btn ${boardSideMode === "top" ? "btn-primary" : ""}`} onClick={() => setBoardSideMode("top")}>Top</button>
        <button className={`btn ${boardSideMode === "bottom" ? "btn-primary" : ""}`} onClick={() => setBoardSideMode("bottom")}>Bottom</button>
        <button className={`btn ${boardSideMode === "both" ? "btn-primary" : ""}`} onClick={() => setBoardSideMode("both")}>Both</button>
      </div>
      <label className="checkbox-line">
        <input type="checkbox" checked={flipBottomView} onChange={(event) => setFlipBottomView(event.target.checked)} />
        Mirror bottom view
      </label>
      <p className="small-help muted">Bottom view can be mirrored like looking at the underside of the board.</p>
    </section>
  );
}

function CircuitTestPanel({ board, getNetName }: { board: Board; getNetName: (netId: string) => string }) {
  const results = useMemo(() => {
    const issues: { level: "ok" | "warning" | "error"; title: string; message: string }[] = [];
    const nets = board.nets.map((net) => net.name.toUpperCase());
    const hasGnd = nets.includes("GND");
    const hasVcc = nets.some((name) => ["VCC", "+5V", "5V", "VIN", "POWER"].includes(name));

    if (hasGnd) issues.push({ level: "ok", title: "GND net found", message: "Ground reference exists." });
    else issues.push({ level: "error", title: "Missing GND net", message: "Create or import a GND net before testing circuit logic." });

    if (hasVcc) issues.push({ level: "ok", title: "Power net found", message: "VCC/+5V/VIN net exists." });
    else issues.push({ level: "warning", title: "No obvious power net", message: "Expected VCC, +5V, 5V, VIN or POWER." });

    const absolutePads = board.components.flatMap((component) =>
      getAbsolutePads(component).map((pad) => ({ component, pad, netName: pad.netId ? getNetName(pad.netId).toUpperCase() : "" }))
    );

    board.components.forEach((component) => {
      const pads = getAbsolutePads(component);
      const connected = pads.filter((pad) => pad.netId).length;
      if (connected === 0) {
        issues.push({ level: "warning", title: `${component.name} is floating`, message: "No pins are connected to any net." });
      }

      const value = `${component.name} ${component.value ?? ""} ${component.mpn ?? ""}`.toUpperCase();
      if (component.type === "ic" || value.includes("NE555") || value.includes("LM358")) {
        const icPads = absolutePads.filter((item) => item.component.id === component.id);
        const hasPowerPin = icPads.some((item) => ["VCC", "+5V", "5V", "VIN"].includes(item.netName) || ["VCC", "VDD"].includes((item.pad.pinName ?? "").toUpperCase()));
        const hasGroundPin = icPads.some((item) => item.netName === "GND" || ["GND", "VSS"].includes((item.pad.pinName ?? "").toUpperCase()));
        if (!hasPowerPin) issues.push({ level: "warning", title: `${component.name} power pin not confirmed`, message: "Check VCC/VDD pin net assignment." });
        if (!hasGroundPin) issues.push({ level: "warning", title: `${component.name} ground pin not confirmed`, message: "Check GND/VSS pin net assignment." });
      }

      if (value.includes("NE555")) {
        const icPads = absolutePads.filter((item) => item.component.id === component.id);
        const names = new Set(icPads.map((item) => (item.pad.pinName ?? "").toUpperCase()));
        ["GND", "TRIG", "OUT", "RESET", "CTRL", "THRESH", "DISCH", "VCC"].forEach((pinName) => {
          if (!names.has(pinName)) {
            issues.push({ level: "warning", title: `NE555 pin ${pinName} missing`, message: "Pinout mapping may not match NE555 footprint." });
          }
        });
      }
    });

    const netUsage = new Map<string, number>();
    absolutePads.forEach((item) => {
      if (item.pad.netId) netUsage.set(item.pad.netId, (netUsage.get(item.pad.netId) ?? 0) + 1);
    });
    netUsage.forEach((count, netId) => {
      if (count === 1) issues.push({ level: "warning", title: `Single-pad net: ${getNetName(netId)}`, message: "This net only touches one pad. Check if it should connect elsewhere." });
    });

    const ledComponents = board.components.filter((component) => component.type === "led" || `${component.name} ${component.value ?? ""}`.toUpperCase().includes("LED"));
    if (ledComponents.length > 0) {
      const hasResistor = board.components.some((component) => component.type === "resistor" || component.name.toUpperCase().startsWith("R"));
      if (!hasResistor) issues.push({ level: "error", title: "LED without resistor", message: "LED circuits normally need a current limiting resistor." });
      else issues.push({ level: "ok", title: "LED current limiting likely", message: "At least one resistor exists in the design." });
    }

    if (issues.length === 0) issues.push({ level: "ok", title: "No circuit warnings", message: "Basic connectivity checks passed." });
    return issues;
  }, [board, getNetName]);

  return (
    <section className="panel circuit-test-panel">
      <div className="panel-head">
        <h2 className="panel-title">Circuit Test Lite</h2>
        <span className="muted">logic check</span>
      </div>
      <div className="stack">
        {results.map((item, index) => (
          <div key={`${item.title}-${index}`} className={`circuit-result ${item.level}`}>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>
      <p className="small-help muted">This is not SPICE simulation. It checks power nets, floating parts, single-pad nets and common NE555/LED mistakes.</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
