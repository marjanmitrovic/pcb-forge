import type { ComponentType, Footprint, PCBComponent } from "../model/pcb";
import type { LibraryComponentTemplate } from "../library/componentCatalog";
import { uid } from "../utils/geometry";

export function createComponent(type: ComponentType, x: number, y: number, index: number): PCBComponent {
  if (type === "resistor") return createResistor(x, y, index);
  if (type === "capacitor") return createCapacitor(x, y, index);
  if (type === "led") return createLed(x, y, index);
  if (type === "ic") return createIc(x, y, index);
  if (type === "connector") return createConnector(x, y, index);
  return createResistor(x, y, index);
}


export function createLibraryComponent(template: LibraryComponentTemplate, x: number, y: number, index: number): PCBComponent {
  const id = uid(template.prefix || "X");
  return {
    id,
    type: template.type,
    name: `${template.prefix || "X"}${index}`,
    x,
    y,
    rotation: 0,
    value: template.value,
    packageName: template.packageName,
    tolerance: template.tolerance,
    powerRating: template.powerRating,
    voltageRating: template.voltageRating,
    currentRating: template.currentRating,
    manufacturer: template.manufacturer,
    mpn: template.mpn,
    supplier: template.supplier,
    supplierSku: template.supplierSku,
    catalogCode: template.catalogCode,
    orderCode: template.orderCode,
    marking: template.marking,
    series: template.series,
    mountType: template.mountType,
    description: template.description,
    datasheetUrl: template.datasheetUrl,
    parameters: template.parameters,
    footprintId: template.id,
    footprintName: template.label,
    bodyWidth: template.bodyWidth,
    bodyHeight: template.bodyHeight,
    pads: template.pads.map((pad) => ({
      id: `${id}_pad_${pad.id}`,
      componentId: id,
      x: pad.x,
      y: pad.y,
      width: pad.width,
      height: pad.height,
      pinName: pad.pinName,
    })),
  };
}

export function createCustomFootprintComponent(footprint: Footprint, x: number, y: number, index: number): PCBComponent {
  const id = uid(footprint.prefix || "X");
  return {
    id,
    type: "custom",
    name: `${footprint.prefix || "X"}${index}`,
    x,
    y,
    rotation: 0,
    value: footprint.name,
    packageName: footprint.name,
    footprintId: footprint.id,
    footprintName: footprint.name,
    bodyWidth: footprint.bodyWidth,
    bodyHeight: footprint.bodyHeight,
    pads: footprint.pads.map((pad) => ({
      id: `${id}_pad_${pad.id}`,
      componentId: id,
      x: pad.x,
      y: pad.y,
      width: pad.width,
      height: pad.height,
      pinName: pad.pinName,
    })),
  };
}

export function createResistor(x: number, y: number, index: number): PCBComponent {
  const id = uid("R");
  return {
    id,
    type: "resistor",
    name: `R${index}`,
    x,
    y,
    rotation: 0,
    value: "10k",
    packageName: "R_Axial",
    tolerance: "5%",
    powerRating: "0.25W",
    description: "Through-hole resistor",
    pads: [
      { id: `${id}_pad_1`, componentId: id, x: -50, y: 0, width: 18, height: 18, pinName: "1" },
      { id: `${id}_pad_2`, componentId: id, x: 50, y: 0, width: 18, height: 18, pinName: "2" },
    ],
  };
}

export function createCapacitor(x: number, y: number, index: number): PCBComponent {
  const id = uid("C");
  return {
    id,
    type: "capacitor",
    name: `C${index}`,
    x,
    y,
    rotation: 0,
    value: "100nF",
    packageName: "C_Disc",
    tolerance: "10%",
    voltageRating: "50V",
    description: "Ceramic capacitor",
    pads: [
      { id: `${id}_pad_1`, componentId: id, x: -35, y: 0, width: 18, height: 18, pinName: "1" },
      { id: `${id}_pad_2`, componentId: id, x: 35, y: 0, width: 18, height: 18, pinName: "2" },
    ],
  };
}

export function createLed(x: number, y: number, index: number): PCBComponent {
  const id = uid("D");
  return {
    id,
    type: "led",
    name: `LED${index}`,
    x,
    y,
    rotation: 0,
    value: "LED",
    packageName: "LED_THT",
    voltageRating: "2.0V",
    currentRating: "20mA",
    description: "LED diode",
    pads: [
      { id: `${id}_pad_A`, componentId: id, x: -35, y: 0, width: 18, height: 18, pinName: "A" },
      { id: `${id}_pad_K`, componentId: id, x: 35, y: 0, width: 18, height: 18, pinName: "K" },
    ],
  };
}

export function createIc(x: number, y: number, index: number): PCBComponent {
  const id = uid("U");
  return {
    id,
    type: "ic",
    name: `U${index}`,
    x,
    y,
    rotation: 0,
    value: "IC",
    packageName: "DIP-8",
    manufacturer: "Generic",
    description: "Integrated circuit",
    pads: [
      { id: `${id}_pad_1`, componentId: id, x: -45, y: -30, width: 14, height: 14, pinName: "GND" },
      { id: `${id}_pad_2`, componentId: id, x: -45, y: -10, width: 14, height: 14, pinName: "TRIG" },
      { id: `${id}_pad_3`, componentId: id, pinName: "OUT", x: -45, y: 10, width: 14, height: 14 },
      { id: `${id}_pad_4`, componentId: id, pinName: "RESET", x: -45, y: 30, width: 14, height: 14 },
      { id: `${id}_pad_5`, componentId: id, pinName: "CTRL", x: 45, y: 30, width: 14, height: 14 },
      { id: `${id}_pad_6`, componentId: id, pinName: "THRESH", x: 45, y: 10, width: 14, height: 14 },
      { id: `${id}_pad_7`, componentId: id, pinName: "DISCH", x: 45, y: -10, width: 14, height: 14 },
      { id: `${id}_pad_8`, componentId: id, pinName: "VCC", x: 45, y: -30, width: 14, height: 14 },
    ],
  };
}

export function createConnector(x: number, y: number, index: number): PCBComponent {
  const id = uid("J");
  return {
    id,
    type: "connector",
    name: `J${index}`,
    x,
    y,
    rotation: 0,
    value: "CONN_3",
    packageName: "PinHeader_1x03",
    currentRating: "1A",
    description: "Pin header connector",
    pads: [
      { id: `${id}_pad_1`, componentId: id, x: -30, y: 0, width: 18, height: 18, pinName: "1" },
      { id: `${id}_pad_2`, componentId: id, x: 0, y: 0, width: 18, height: 18, pinName: "2" },
      { id: `${id}_pad_3`, componentId: id, x: 30, y: 0, width: 18, height: 18, pinName: "3" },
    ],
  };
}
