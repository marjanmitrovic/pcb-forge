import type { Footprint, FootprintPadTemplate } from "../model/pcb";

function pad(id: string, x: number, y: number, width: number, height: number, pinName?: string): FootprintPadTemplate {
  return { id, x, y, width, height, pinName };
}

function twoPad(prefix: string, left: number, right: number, width: number, height: number, pinNames = ["1", "2"]): FootprintPadTemplate[] {
  return [
    pad("1", left, 0, width, height, pinNames[0]),
    pad("2", right, 0, width, height, pinNames[1]),
  ];
}

function inlinePads(count: number, pitch: number, width: number, height: number, names?: string[]): FootprintPadTemplate[] {
  const start = -((count - 1) * pitch) / 2;
  return Array.from({ length: count }, (_, index) =>
    pad(String(index + 1), Math.round(start + index * pitch), 0, width, height, names?.[index] ?? String(index + 1))
  );
}

function dipPads(pins: number, spacingX: number, pitchY: number, names?: string[]): FootprintPadTemplate[] {
  const perSide = pins / 2;
  const startY = -((perSide - 1) * pitchY) / 2;
  const left = Array.from({ length: perSide }, (_, index) =>
    pad(String(index + 1), -spacingX / 2, Math.round(startY + index * pitchY), 14, 14, names?.[index] ?? String(index + 1))
  );
  const right = Array.from({ length: perSide }, (_, index) => {
    const pinNumber = perSide + index + 1;
    return pad(String(pinNumber), spacingX / 2, Math.round(startY + (perSide - 1 - index) * pitchY), 14, 14, names?.[pinNumber - 1] ?? String(pinNumber));
  });
  return [...left, ...right];
}

function smdDualPads(pins: number, spacingX: number, pitchY: number, padWidth: number, padHeight: number, names?: string[]): FootprintPadTemplate[] {
  const perSide = pins / 2;
  const startY = -((perSide - 1) * pitchY) / 2;
  const left = Array.from({ length: perSide }, (_, index) =>
    pad(String(index + 1), -spacingX / 2, Math.round(startY + index * pitchY), padWidth, padHeight, names?.[index] ?? String(index + 1))
  );
  const right = Array.from({ length: perSide }, (_, index) => {
    const pinNumber = perSide + index + 1;
    return pad(String(pinNumber), spacingX / 2, Math.round(startY + (perSide - 1 - index) * pitchY), padWidth, padHeight, names?.[pinNumber - 1] ?? String(pinNumber));
  });
  return [...left, ...right];
}

export type FootprintCategory =
  | "Passives SMD"
  | "Passives THT"
  | "Diodes / LEDs"
  | "IC DIP"
  | "IC SMD"
  | "Transistors"
  | "Connectors"
  | "Modules";

export type PredefinedFootprint = Footprint & {
  category: FootprintCategory;
  description: string;
  pitch?: string;
  mountType: "SMD" | "THT" | "Mixed";
};

const ne555PinNames = ["GND", "TRIG", "OUT", "RESET", "CTRL", "THRESH", "DISCH", "VCC"];

export const predefinedFootprints: PredefinedFootprint[] = [
  {
    id: "fp-r-0805",
    category: "Passives SMD",
    name: "R_0805_2012Metric",
    prefix: "R",
    bodyWidth: 22,
    bodyHeight: 14,
    pads: twoPad("R", -16, 16, 14, 16),
    description: "SMD resistor 0805 / 2012 metric",
    pitch: "2.0 mm body",
    mountType: "SMD",
  },
  {
    id: "fp-r-0603",
    category: "Passives SMD",
    name: "R_0603_1608Metric",
    prefix: "R",
    bodyWidth: 16,
    bodyHeight: 10,
    pads: twoPad("R", -12, 12, 10, 12),
    description: "SMD resistor 0603 / 1608 metric",
    pitch: "1.6 mm body",
    mountType: "SMD",
  },
  {
    id: "fp-c-0805",
    category: "Passives SMD",
    name: "C_0805_2012Metric",
    prefix: "C",
    bodyWidth: 22,
    bodyHeight: 14,
    pads: twoPad("C", -16, 16, 14, 16),
    description: "SMD capacitor 0805 / 2012 metric",
    pitch: "2.0 mm body",
    mountType: "SMD",
  },
  {
    id: "fp-c-0603",
    category: "Passives SMD",
    name: "C_0603_1608Metric",
    prefix: "C",
    bodyWidth: 16,
    bodyHeight: 10,
    pads: twoPad("C", -12, 12, 10, 12),
    description: "SMD capacitor 0603 / 1608 metric",
    pitch: "1.6 mm body",
    mountType: "SMD",
  },
  {
    id: "fp-r-axial-din0207-p762",
    category: "Passives THT",
    name: "R_Axial_DIN0207_L6.3mm_P7.62mm",
    prefix: "R",
    bodyWidth: 64,
    bodyHeight: 24,
    pads: twoPad("R", -38, 38, 18, 18),
    description: "Axial THT resistor, 7.62 mm lead spacing",
    pitch: "7.62 mm",
    mountType: "THT",
  },
  {
    id: "fp-c-radial-d5-p250",
    category: "Passives THT",
    name: "C_Radial_D5.0mm_P2.50mm",
    prefix: "C",
    bodyWidth: 50,
    bodyHeight: 50,
    pads: twoPad("C", -13, 13, 18, 18),
    description: "Radial electrolytic capacitor, D5.0 mm, 2.50 mm pitch",
    pitch: "2.50 mm",
    mountType: "THT",
  },
  {
    id: "fp-c-radial-d6-3-p250",
    category: "Passives THT",
    name: "C_Radial_D6.3mm_P2.50mm",
    prefix: "C",
    bodyWidth: 64,
    bodyHeight: 64,
    pads: twoPad("C", -13, 13, 18, 18),
    description: "Radial electrolytic capacitor, D6.3 mm, 2.50 mm pitch",
    pitch: "2.50 mm",
    mountType: "THT",
  },
  {
    id: "fp-d-do41",
    category: "Diodes / LEDs",
    name: "D_DO-41_SOD81_P10.16mm_Horizontal",
    prefix: "D",
    bodyWidth: 52,
    bodyHeight: 26,
    pads: twoPad("D", -51, 51, 18, 18, ["A", "K"]),
    description: "THT diode DO-41 / SOD81, 10.16 mm pitch",
    pitch: "10.16 mm",
    mountType: "THT",
  },
  {
    id: "fp-led-d5",
    category: "Diodes / LEDs",
    name: "LED_D5.0mm_P2.54mm",
    prefix: "LED",
    bodyWidth: 50,
    bodyHeight: 50,
    pads: twoPad("LED", -13, 13, 18, 18, ["A", "K"]),
    description: "5 mm through-hole LED, 2.54 mm pitch",
    pitch: "2.54 mm",
    mountType: "THT",
  },
  {
    id: "fp-dip-8",
    category: "IC DIP",
    name: "DIP-8_W7.62mm",
    prefix: "U",
    bodyWidth: 70,
    bodyHeight: 94,
    pads: dipPads(8, 76, 25, ne555PinNames),
    description: "DIP-8 through-hole IC footprint, 7.62 mm row spacing",
    pitch: "2.54 mm pin pitch",
    mountType: "THT",
  },
  {
    id: "fp-dip-14",
    category: "IC DIP",
    name: "DIP-14_W7.62mm",
    prefix: "U",
    bodyWidth: 70,
    bodyHeight: 170,
    pads: dipPads(14, 76, 25),
    description: "DIP-14 through-hole IC footprint",
    pitch: "2.54 mm pin pitch",
    mountType: "THT",
  },
  {
    id: "fp-dip-16",
    category: "IC DIP",
    name: "DIP-16_W7.62mm",
    prefix: "U",
    bodyWidth: 70,
    bodyHeight: 195,
    pads: dipPads(16, 76, 25),
    description: "DIP-16 through-hole IC footprint",
    pitch: "2.54 mm pin pitch",
    mountType: "THT",
  },
  {
    id: "fp-dip-28",
    category: "IC DIP",
    name: "DIP-28_W7.62mm",
    prefix: "U",
    bodyWidth: 78,
    bodyHeight: 350,
    pads: dipPads(28, 76, 25),
    description: "DIP-28 through-hole IC footprint, useful for ATmega328P-PU",
    pitch: "2.54 mm pin pitch",
    mountType: "THT",
  },
  {
    id: "fp-soic-8",
    category: "IC SMD",
    name: "SOIC-8_3.9x4.9mm_P1.27mm",
    prefix: "U",
    bodyWidth: 40,
    bodyHeight: 50,
    pads: smdDualPads(8, 58, 13, 16, 8, ne555PinNames),
    description: "SOIC-8 SMD IC footprint, 1.27 mm pitch",
    pitch: "1.27 mm",
    mountType: "SMD",
  },
  {
    id: "fp-soic-14",
    category: "IC SMD",
    name: "SOIC-14_3.9x8.7mm_P1.27mm",
    prefix: "U",
    bodyWidth: 40,
    bodyHeight: 88,
    pads: smdDualPads(14, 58, 13, 16, 8),
    description: "SOIC-14 SMD IC footprint, 1.27 mm pitch",
    pitch: "1.27 mm",
    mountType: "SMD",
  },
  {
    id: "fp-sot-23",
    category: "Transistors",
    name: "SOT-23",
    prefix: "Q",
    bodyWidth: 30,
    bodyHeight: 18,
    pads: [pad("1", -11, 10, 10, 12, "1"), pad("2", 11, 10, 10, 12, "2"), pad("3", 0, -12, 12, 10, "3")],
    description: "Generic SOT-23 transistor/MOSFET footprint",
    pitch: "SMD 3-pin",
    mountType: "SMD",
  },
  {
    id: "fp-to-92-inline",
    category: "Transistors",
    name: "TO-92_Inline_Wide",
    prefix: "Q",
    bodyWidth: 48,
    bodyHeight: 36,
    pads: inlinePads(3, 25, 16, 16, ["C", "B", "E"]),
    description: "TO-92 through-hole transistor footprint",
    pitch: "2.54 mm typical",
    mountType: "THT",
  },
  {
    id: "fp-to-220-3",
    category: "Transistors",
    name: "TO-220-3_Vertical",
    prefix: "Q",
    bodyWidth: 100,
    bodyHeight: 45,
    pads: inlinePads(3, 25, 18, 22, ["G/IN", "D/GND", "S/OUT"]),
    description: "TO-220-3 vertical package, regulators and power transistors",
    pitch: "2.54 mm typical",
    mountType: "THT",
  },
  {
    id: "fp-pinheader-1x02",
    category: "Connectors",
    name: "PinHeader_1x02_P2.54mm_Vertical",
    prefix: "J",
    bodyWidth: 50,
    bodyHeight: 28,
    pads: inlinePads(2, 25, 18, 18),
    description: "1x02 2.54 mm pin header",
    pitch: "2.54 mm",
    mountType: "THT",
  },
  {
    id: "fp-pinheader-1x03",
    category: "Connectors",
    name: "PinHeader_1x03_P2.54mm_Vertical",
    prefix: "J",
    bodyWidth: 76,
    bodyHeight: 28,
    pads: inlinePads(3, 25, 18, 18),
    description: "1x03 2.54 mm pin header",
    pitch: "2.54 mm",
    mountType: "THT",
  },
  {
    id: "fp-pinheader-1x04",
    category: "Connectors",
    name: "PinHeader_1x04_P2.54mm_Vertical",
    prefix: "J",
    bodyWidth: 102,
    bodyHeight: 28,
    pads: inlinePads(4, 25, 18, 18),
    description: "1x04 2.54 mm pin header",
    pitch: "2.54 mm",
    mountType: "THT",
  },
  {
    id: "fp-terminalblock-2p-5mm",
    category: "Connectors",
    name: "TerminalBlock_1x02_P5.00mm",
    prefix: "J",
    bodyWidth: 105,
    bodyHeight: 45,
    pads: inlinePads(2, 50, 22, 22),
    description: "2-pin screw terminal block, 5.00 mm pitch",
    pitch: "5.00 mm",
    mountType: "THT",
  },
  {
    id: "fp-terminalblock-3p-5mm",
    category: "Connectors",
    name: "TerminalBlock_1x03_P5.00mm",
    prefix: "J",
    bodyWidth: 155,
    bodyHeight: 45,
    pads: inlinePads(3, 50, 22, 22),
    description: "3-pin screw terminal block, 5.00 mm pitch",
    pitch: "5.00 mm",
    mountType: "THT",
  },
  {
    id: "fp-esp32-wroom-32",
    category: "Modules",
    name: "ESP32-WROOM-32_Module",
    prefix: "MOD",
    bodyWidth: 180,
    bodyHeight: 260,
    pads: [
      ...smdDualPads(38, 170, 13, 18, 8).map((p) => ({ ...p, pinName: p.id })),
    ],
    description: "ESP32-WROOM-32 castellated module approximation",
    pitch: "1.27 mm side castellations",
    mountType: "SMD",
  },
];

export const footprintCategories: FootprintCategory[] = [
  "Passives SMD",
  "Passives THT",
  "Diodes / LEDs",
  "IC DIP",
  "IC SMD",
  "Transistors",
  "Connectors",
  "Modules",
];
