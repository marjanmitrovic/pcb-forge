export type Tool =
  | "select"
  | "route"
  | "add-resistor"
  | "add-capacitor"
  | "add-led"
  | "add-ic"
  | "add-connector"
  | "add-custom-footprint"
  | "add-library-component"
  | "add-mounting-hole"
  | "add-silkscreen-text"
  | "add-copper-zone"
  | "measure";

export type Layer = "top" | "bottom";
export type AngleMode = "orthogonal" | "diagonal";

export type ComponentType = "resistor" | "capacitor" | "led" | "ic" | "connector" | "custom";

export type Point = {
  x: number;
  y: number;
};

export type Pad = {
  id: string;
  componentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  netId?: string;
  pinName?: string;
};

export type PCBComponent = {
  id: string;
  type: ComponentType;
  name: string;
  x: number;
  y: number;
  rotation: number;
  pads: Pad[];
  value?: string;
  packageName?: string;
  tolerance?: string;
  powerRating?: string;
  voltageRating?: string;
  currentRating?: string;
  manufacturer?: string;
  manufacturerPartNumber?: string;
  mpn?: string;
  supplier?: string;
  supplierSku?: string;
  catalogCode?: string;
  orderCode?: string;
  marking?: string;
  series?: string;
  mountType?: string;
  description?: string;
  datasheetUrl?: string;
  parameters?: Record<string, string>;
  totalAvailability?: number;
  catalogDescription?: string;
  footprintId?: string;
  footprintName?: string;
  bodyWidth?: number;
  bodyHeight?: number;
};

export type FootprintPadTemplate = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pinName?: string;
};

export type Footprint = {
  id: string;
  name: string;
  prefix: string;
  bodyWidth: number;
  bodyHeight: number;
  pads: FootprintPadTemplate[];
};

export type Trace = {
  id: string;
  netId: string;
  layer: Layer;
  width: number;
  points: Point[];
};

export type Via = {
  id: string;
  netId: string;
  x: number;
  y: number;
  fromLayer: Layer;
  toLayer: Layer;
  diameter: number;
  drill: number;
};

export type Net = {
  id: string;
  name: string;
  color: string;
};

export type MountingHole = {
  id: string;
  x: number;
  y: number;
  diameter: number;
  drill: number;
  plated: boolean;
};

export type SilkscreenItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
  layer: Layer;
};

export type CopperZone = {
  id: string;
  name: string;
  netId: string;
  layer: Layer;
  x: number;
  y: number;
  width: number;
  height: number;
  clearance: number;
  opacity: number;
};

export type DesignRules = {
  minTraceWidth: number;
  minClearance: number;
  minDrill: number;
  minViaDiameter: number;
  minZoneClearance: number;
  minSilkscreenTextSize: number;
  copperToBoardEdge: number;
};

export type Board = {
  name: string;
  width: number;
  height: number;
  components: PCBComponent[];
  traces: Trace[];
  vias: Via[];
  mountingHoles: MountingHole[];
  silkscreenItems: SilkscreenItem[];
  copperZones: CopperZone[];
  nets: Net[];
  footprints: Footprint[];
  designRules: DesignRules;
};
