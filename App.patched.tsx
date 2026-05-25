import { useEffect, useMemo, useRef, useState } from "react";
import { BoardSettingsPanel } from "./components/BoardSettingsPanel";
import { BomPanel } from "./components/BomPanel";
import { ComponentLibrary } from "./components/ComponentLibrary";
import { DrcPanel } from "./components/DrcPanel";
import { FootprintEditor } from "./components/FootprintEditor";
import { LayerPanel } from "./components/LayerPanel";
import { NetPanel } from "./components/NetPanel";
import { NetlistPanel } from "./components/NetlistPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { RoutePanel } from "./components/RoutePanel";
import { Toolbar } from "./components/Toolbar";
import { LiveCatalogSearch } from "./components/LiveCatalogSearch";
import { createComponent, createCustomFootprintComponent, createLibraryComponent } from "./factories/components";
import { getLibraryComponentById, type LibraryComponentTemplate } from "./library/componentCatalog";
import type { AngleMode, Board, ComponentType, Footprint, Layer, PCBComponent, Point, Tool, Trace, Via } from "./model/pcb";
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

type BoardSideMode = "top" | "bottom" | "both";


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
  designRules: {
    minTraceWidth: 3,
    minClearance: 6,
    minDrill: 6,
    minViaDiameter: 12,
    copperZoneClearance: 8,
    copperToBoardEdge: 10,
    minSilkscreenTextSize: 10,
  },
};

type RouteDraft = {
  points: Point[];
  netId: string;
  layer: Layer;
};

type LiveCatalogPart = {
  mpn: string;
  description: string;
  totalAvail: number;
};

function migrateBoard(input: Board): Board {
  const fallbackNets = [
    { id: "net_gnd", name: "GND", color: "#111827" },
    { id: "net_vcc", name: "VCC", color: "#dc2626" },
    { id: "net_signal_1", name: "SIGNAL_1", color: "#2563eb" },
  ];

  return {
    ...input,
    name: input.name || "PCB Forge Demo Board",
    width: input.width || BOARD_WIDTH,
    height: input.height || BOARD_HEIGHT,
    components: Array.isArray(input.components) ? input.components : [],
    traces: Array.isArray(input.traces) ? input.traces : [],
    vias: Array.isArray(input.vias) ? input.vias : [],
    mountingHoles: Array.isArray(input.mountingHoles) ? input.mountingHoles : [],
    silkscreenItems: Array.isArray(input.silkscreenItems) ? input.silkscreenItems : [],
    copperZones: Array.isArray(input.copperZones) ? input.copperZones : [],
    footprints: Array.isArray(input.footprints) ? input.footprints : [],
    nets: Array.isArray(input.nets)
      ? input.nets.map((net) => ({
          ...net,
          color: net.color ?? "#64748b",
        }))
      : fallbackNets,
    designRules: input.designRules ?? {
      minTraceWidth: 3,
      minClearance: 6,
      minDrill: 6,
      minViaDiameter: 12,
      copperZoneClearance: 8,
      copperToBoardEdge: 10,
      minSilkscreenTextSize: 10,
    },
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
  const [activeNetId, setActiveNetId] = useState<string>("net_gnd");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedFootprintId, setSelectedFootprintId] = useState<string | null>(null);
  const [selectedLibraryComponentId, setSelectedLibraryComponentId] = useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedViaId, setSelectedViaId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [drcIssues, setDrcIssues] = useState<DrcIssue[]>([]);
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX);
  const [boardSideMode, setBoardSideMode] = useState<BoardSideMode>(() => {
    const saved = localStorage.getItem("pcb-forge-board-side-mode");
    return saved === "bottom" || saved === "both" || saved === "top" ? saved : "both";
  });
  const [flipBottomView, setFlipBottomView] = useState<boolean>(() => localStorage.getItem("pcb-forge-flip-bottom-view") === "true");
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; viewBox: typeof DEFAULT_VIEWBOX } | null>(null);
  const [pendingCatalogPart, setPendingCatalogPart] = useState<LiveCatalogPart | null>(null);
  const [liveLibraryComponents, setLiveLibraryComponents] = useState<LibraryComponentTemplate[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pcb-forge-live-library") || "[]");
    } catch {
      return [];
    }
  });

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

  const previewPoint = useMemo(() => {
    if (!routeDraft) return null;
    const from = last(routeDraft.points);
    if (!from) return null;
    return constrainPoint(from, mousePos, angleMode);
  }, [angleMode, mousePos, routeDraft]);

  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.items.length - 1;
  const isBottomMirrored = boardSideMode === "bottom" && flipBottomView;

  useEffect(() => {
    localStorage.setItem("pcb-forge-board-side-mode", boardSideMode);
  }, [boardSideMode]);

  useEffect(() => {
    localStorage.setItem("pcb-forge-flip-bottom-view", String(flipBottomView));
  }, [flipBottomView]);

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
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, historyState, selectedComponentId, selectedTraceId, selectedViaId]);

  function clearDrc() {
    if (drcIssues.length > 0) setDrcIssues([]);
  }

  function updateBoardSettings(patch: Partial<Pick<Board, "name" | "width" | "height">>) {
    setBoard((prev) => ({ ...prev, ...patch }));
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

  function selectComponent(id: string) {
    setSelectedComponentId(id);
    setSelectedTraceId(null);
    setSelectedViaId(null);
  }

  function selectTrace(id: string) {
    setSelectedTraceId(id);
    setSelectedComponentId(null);
    setSelectedViaId(null);
  }

  function selectVia(id: string) {
    setSelectedViaId(id);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
  }

  function clearSelection() {
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setSelectedViaId(null);
  }

  function getNetName(netId: string) {
    return board.nets.find((net) => net.id === netId)?.name ?? netId;
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

  function inferPackageFromCatalog(type: ComponentType, text: string) {
    if (text.includes("pdip") || text.includes("dip-8") || text.includes("8-pdip")) return "DIP-8";
    if (text.includes("soic") || text.includes("so-8") || text.includes("sop-8")) return "SOIC-8";
    if (text.includes("tssop")) return "TSSOP-8";
    if (text.includes("to-92")) return "TO-92";
    if (text.includes("to-220")) return "TO-220";
    if (type === "resistor") return "R_Axial_DIN0207_L6.3mm_P7.62mm";
    if (type === "capacitor") return "C_Radial_D5.0mm_P2.50mm";
    if (type === "led") return "D_DO-41_or_LED_THT";
    if (type === "connector") return "PinHeader_or_TerminalBlock";
    return "Generic IC package";
  }

  function makePadsForCatalog(type: ComponentType, packageName: string) {
    if (type === "resistor" || type === "capacitor" || type === "led") {
      return [
        { id: "1", x: -50, y: 0, width: 18, height: 18 },
        { id: "2", x: 50, y: 0, width: 18, height: 18 },
      ];
    }

    if (type === "connector") {
      return [
        { id: "1", x: -30, y: 0, width: 18, height: 18 },
        { id: "2", x: 0, y: 0, width: 18, height: 18 },
        { id: "3", x: 30, y: 0, width: 18, height: 18 },
      ];
    }

    const pins = packageName.includes("14") ? 14 : 8;
    const perSide = pins / 2;
    const startY = -((perSide - 1) * 20) / 2;
    return [
      ...Array.from({ length: perSide }, (_, index) => ({
        id: String(index + 1),
        x: -45,
        y: startY + index * 20,
        width: 14,
        height: 14,
      })),
      ...Array.from({ length: perSide }, (_, index) => ({
        id: String(perSide + index + 1),
        x: 45,
        y: startY + (perSide - 1 - index) * 20,
        width: 14,
        height: 14,
      })),
    ];
  }

  function createLiveLibraryTemplate(part: LiveCatalogPart): LibraryComponentTemplate {
    const text = `${part.mpn} ${part.description}`.toLowerCase();
    const type = inferComponentTypeFromCatalog(part);
    const prefix = inferPrefixFromCatalog(type, text);
    const packageName = inferPackageFromCatalog(type, text);

    return {
      id: `live-${part.mpn.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      category:
        type === "resistor" ? "Resistors" :
        type === "capacitor" ? "Capacitors" :
        type === "led" ? "Diodes" :
        type === "connector" ? "Connectors" : "ICs",
      label: part.mpn,
      type,
      prefix,
      value: part.mpn,
      packageName,
      manufacturer: "From live catalog",
      mpn: part.mpn,
      supplier: "Nexar / Octopart live search",
      supplierSku: part.mpn,
      catalogCode: `LIVE-${part.mpn}`,
      orderCode: part.mpn,
      marking: part.mpn,
      mountType: packageName.includes("SO") || packageName.includes("TSSOP") ? "SMD" : "THT / generic",
      description: part.description,
      parameters: {
        Source: "Nexar / Octopart live search",
        "Total availability": String(part.totalAvail),
        Package: packageName,
      },
      bodyWidth: type === "ic" ? 60 : undefined,
      bodyHeight: type === "ic" ? 90 : undefined,
      pads: makePadsForCatalog(type, packageName),
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

  function clientToBoardPoint(event: React.MouseEvent<SVGSVGElement | SVGElement>): Point {
    const svgPoint = clientToSvgPoint(event);
    const rawX = svgPoint.x - BOARD_OFFSET.x;
    const rawY = svgPoint.y - BOARD_OFFSET.y;

    return {
      x: snap(isBottomMirrored ? board.width - rawX : rawX),
      y: snap(rawY),
    };
  }

  function isInsideBoard(point: Point) {
    return point.x >= 0 && point.y >= 0 && point.x <= board.width && point.y <= board.height;
  }

  function isLayerVisible(itemLayer: Layer) {
    return boardSideMode === "both" || boardSideMode === itemLayer;
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

  function addComponent(type: ComponentType, point: Point) {
    setBoard((prev) => {
      const baseComponent = createComponent(type, point.x, point.y, prev.components.length + 1);

      const component = pendingCatalogPart
        ? ({
            ...baseComponent,
            name: pendingCatalogPart.mpn,
            value: pendingCatalogPart.mpn,
            manufacturer: "",
            mpn: pendingCatalogPart.mpn,
            supplier: "Nexar / Octopart",
            supplierSku: pendingCatalogPart.mpn,
            catalogCode: `LIVE-${pendingCatalogPart.mpn}`,
            orderCode: pendingCatalogPart.mpn,
            marking: pendingCatalogPart.mpn,
            description: pendingCatalogPart.description,
            parameters: {
              Source: "Nexar / Octopart live search",
              "Total availability": String(pendingCatalogPart.totalAvail),
              Description: pendingCatalogPart.description,
            },
            totalAvailability: pendingCatalogPart.totalAvail,
            catalogDescription: pendingCatalogPart.description,
          } as PCBComponent)
        : baseComponent;

      return {
        ...prev,
        components: [...prev.components, component],
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
    if (!selectedComponentId && !selectedTraceId && !selectedViaId) return;

    setBoard((prev) => ({
      ...prev,
      components: selectedComponentId
        ? prev.components.filter((component) => component.id !== selectedComponentId)
        : prev.components,
      traces: selectedTraceId
        ? prev.traces.filter((trace) => trace.id !== selectedTraceId)
        : prev.traces,
      vias: selectedViaId
        ? prev.vias.filter((via) => via.id !== selectedViaId)
        : prev.vias,
    }));

    clearSelection();
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

    if (tool === "select") {
      clearSelection();
      return;
    }

    if (tool === "add-library-component") {
      addLibraryComponent(point);
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

  function exportJson() {
    const data = JSON.stringify(board, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${board.name.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportManufacturing() {
    await exportManufacturingPackage(board);
  }

  function saveLocal() {
    localStorage.setItem("pcb-forge-project", JSON.stringify(board));
    alert("Project saved in browser.");
  }

  function loadLocal() {
    const saved = localStorage.getItem("pcb-forge-project");
    if (!saved) {
      alert("No saved project found.");
      return;
    }

    try {
      const parsed = migrateBoard(JSON.parse(saved) as Board);
      restoringHistoryRef.current = true;
      setBoard(parsed);
      setHistoryState({ items: [parsed], index: 0 });
      clearSelection();
      setRouteDraft(null);
      setDrcIssues([]);
    } catch {
      alert("Saved project is corrupted.");
    }
  }

  function importJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = migrateBoard(JSON.parse(text) as Board);

        if (!parsed.name || !Array.isArray(parsed.components) || !Array.isArray(parsed.traces)) {
          alert("Invalid PCB project file.");
          return;
        }

        restoringHistoryRef.current = true;
        setBoard(parsed);
        setHistoryState({ items: [parsed], index: 0 });
        clearSelection();
        setRouteDraft(null);
        setDrcIssues([]);
      } catch {
        alert("Cannot import JSON file.");
      }
    };
    input.click();
  }

  const activeNetName = board.nets.find((n) => n.id === activeNetId)?.name ?? activeNetId;
  const routePointCount = routeDraft?.points.length ?? 0;
  const routeLastPoint = routeDraft ? last(routeDraft.points) : null;

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div>
            <h1 className="title">PCB Forge</h1>
            <p className="subtitle">Čist PCB Board editor — izaberi komponentu, klikni na ploču, zatim crtaj vodove.</p>
          </div>
          <Toolbar
            tool={tool}
            setTool={setTool}
            rotateSelected={rotateSelected}
            deleteSelected={deleteSelected}
            exportJson={exportJson}
            importJson={importJson}
            saveLocal={saveLocal}
            loadLocal={loadLocal}
            exportManufacturing={exportManufacturing}
          />
        </div>
      </header>

            <main className="layout">
        <section className="canvas-shell">
          <div className="status-bar status-bar-strong">
            PCB Board · View: <strong>{boardSideMode}{isBottomMirrored ? " flipped" : ""}</strong> · Alat: <strong>{tool}</strong> · Layer: <strong>{layer}</strong> · Ugao: <strong>{angleMode === "orthogonal" ? "90°" : "45°"}</strong> · Net: <strong>{activeNetName}</strong> · Zoom: <strong>{Math.round((DEFAULT_VIEWBOX.width / viewBox.width) * 100)}%</strong> · Miš: {mousePos.x}, {mousePos.y}
          </div>
          <div className="pcb-help-strip">
            <span><strong>1.</strong> Izaberi komponentu desno.</span>
            <span><strong>2.</strong> Klikni na zelenu ploču da je postaviš.</span>
            <span><strong>3.</strong> Klikni <b>Route</b>.</span>
            <span><strong>4.</strong> Klikni prvi pad, pa drugi pad — vod se odmah nacrta.</span>
            <span><strong>5.</strong> Za ručnu rutu: klikći tačke, desni klik završava, ESC prekida.</span>
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
              <pattern id="smallGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#d6dde8" strokeWidth="0.8" />
              </pattern>
              <pattern id="largeGrid" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                <rect width={GRID * 5} height={GRID * 5} fill="url(#smallGrid)" />
                <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="#b8c2d1" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="1000" height="650" fill="url(#largeGrid)" />
            <g transform={`translate(${BOARD_OFFSET.x}, ${BOARD_OFFSET.y})`}>
              <g transform={isBottomMirrored ? `translate(${board.width}, 0) scale(-1, 1)` : undefined}>
              <rect x="0" y="0" width={board.width} height={board.height} rx="12" fill="#0f766e" fillOpacity="0.12" stroke="#0f766e" strokeWidth="3" />
              <text x="14" y="28" className="svg-text-small">{board.name} — {board.width / 10}mm × {board.height / 10}mm</text>

              {board.traces.filter((trace) => isLayerVisible(trace.layer)).map((trace) => {
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
                      opacity={trace.layer === "top" ? 1 : 0.72}
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

              {board.vias.map((via) => {
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
                />
              ))}
              </g>
            </g>
          </svg>
        </section>

        <aside className="sidebar">
          <section className="panel pcb-first-panel">
            <h2 className="panel-title">Crtanje direktno na PCB</h2>
            <p className="small-help">Direktno crtanje: izaberi komponentu, klikni na zelenu ploču, zatim Route → prvi pad → drugi pad.</p>
          </section>
          <ViewPanel
            zoomPercent={Math.round((DEFAULT_VIEWBOX.width / viewBox.width) * 100)}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            resetView={resetView}
            fitBoardView={fitBoardView}
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
          <ComponentLibrary
            footprints={board.footprints}
            selectedFootprintId={selectedFootprintId}
            selectedLibraryComponentId={selectedLibraryComponentId}
            setSelectedFootprintId={setSelectedFootprintId}
            setSelectedLibraryComponentId={setSelectedLibraryComponentId}
            setTool={setTool}
            extraComponents={liveLibraryComponents}
          />
          <LiveCatalogSearch onAddCatalogPart={addLiveCatalogPart} onAddToLocalLibrary={addLiveCatalogPartToLocalLibrary} />
          <BoardSettingsPanel board={board} updateBoard={updateBoardSettings} />
          <PropertiesPanel selectedComponent={selectedComponent} nets={board.nets} updateSelectedComponent={updateSelectedComponent} />
          <FootprintEditor footprints={board.footprints} addFootprint={addFootprint} deleteFootprint={deleteFootprint} />
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
          <RouteEditPanel
            selectedTrace={selectedTrace}
            selectedVia={selectedVia}
            nets={board.nets}
            updateSelectedTrace={updateSelectedTrace}
            updateSelectedVia={updateSelectedVia}
            deleteSelected={deleteSelected}
            getNetName={getNetName}
          />
          <NetPanel nets={board.nets} activeNetId={activeNetId} setActiveNetId={setActiveNetId} addNet={addNet} />
          <DrcPanel issues={drcIssues} runDrcCheck={runDrcCheck} />
          <NetlistPanel board={board} />
          <BomPanel components={board.components} />
          <section className="panel">
            <h2 className="panel-title">Project</h2>
            <div className="stack">
              <Row label="Components" value={String(board.components.length)} />
              <Row label="Traces" value={String(board.traces.length)} />
              <Row label="Vias" value={String(board.vias.length)} />
              <Row label="Nets" value={String(board.nets.length)} />
              <Row label="Footprints" value={String(board.footprints.length)} />
              <Row label="Grid" value={String(GRID)} />
            </div>
          </section>
        </aside>
      </main>
    </div>
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

function BoardSidePanel({
  boardSideMode,
  setBoardSideMode,
  flipBottomView,
  setFlipBottomView,
}: {
  boardSideMode: BoardSideMode;
  setBoardSideMode: (mode: BoardSideMode) => void;
  flipBottomView: boolean;
  setFlipBottomView: (value: boolean) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Board side</h2>
        <span className="muted">{boardSideMode}</span>
      </div>
      <div className="grid-three">
        <button className={`btn ${boardSideMode === "top" ? "btn-primary" : ""}`} onClick={() => setBoardSideMode("top")}>Top</button>
        <button className={`btn ${boardSideMode === "bottom" ? "btn-primary" : ""}`} onClick={() => setBoardSideMode("bottom")}>Bottom</button>
        <button className={`btn ${boardSideMode === "both" ? "btn-primary" : ""}`} onClick={() => setBoardSideMode("both")}>Both</button>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={flipBottomView}
          onChange={(event) => setFlipBottomView(event.target.checked)}
        />
        <span>Mirror bottom view</span>
      </label>
      <p className="small-help muted">Bottom view can be mirrored like looking at the underside of the board. Mouse placement is converted correctly while mirrored.</p>
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
}) {
  const pads = getAbsolutePads(component);

  return (
    <g>
      <g
        transform={`translate(${component.x}, ${component.y}) rotate(${component.rotation})`}
        onMouseDown={(event) => {
          event.stopPropagation();
          selectComponent(component.id);
          if (tool === "select") setDraggingId(component.id);
        }}
        onClick={(event) => {
          event.stopPropagation();
          selectComponent(component.id);
        }}
        style={{ cursor: "move" }}
      >
        <ComponentBody component={component} selected={selected} />
      </g>

      {pads.map((pad) => (
        <rect
          key={pad.id}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
