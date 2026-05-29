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
import { GRID, getAbsolutePads, uid } from "./utils/geometry";
import {
  constrainRoutePoint as constrainPoint,
  getLastPoint as last,
  getOppositeLayer as oppositeLayer,
} from "./utils/routerEngine";

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

/* truncated intentionally */
