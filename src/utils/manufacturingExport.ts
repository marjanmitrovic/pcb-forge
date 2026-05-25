import type { Board, Layer, Point, Trace } from "../model/pcb";
import { getAbsolutePads } from "./geometry";

function mm(value: number) {
  return value / 10;
}

function mmText(value: number) {
  return mm(value).toFixed(3);
}

function gerberCoord(value: number) {
  return Math.round(mm(value) * 10000).toString().padStart(7, "0");
}

function gerberPoint(point: Point) {
  return `X${gerberCoord(point.x)}Y${gerberCoord(point.y)}`;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function makeGerberHeader(title: string) {
  return [
    "G04 PCB Forge Gerber Export*",
    `G04 ${title}*`,
    "%FSLAX34Y34*%",
    "%MOMM*%",
    "%LPD*%",
    "G01*",
    "",
  ];
}

function makeCopperGerber(board: Board, layer: Layer) {
  const lines: string[] = [];
  const title = layer === "top" ? "Top Copper" : "Bottom Copper";
  lines.push(...makeGerberHeader(title));

  (board.copperZones ?? [])
    .filter((zone) => zone.layer === layer)
    .forEach((zone) => {
      lines.push(`G04 COPPER ZONE ${zone.id} NET ${zone.netId}*`);
      lines.push("G36*");
      const points: Point[] = [
        { x: zone.x, y: zone.y },
        { x: zone.x + zone.width, y: zone.y },
        { x: zone.x + zone.width, y: zone.y + zone.height },
        { x: zone.x, y: zone.y + zone.height },
        { x: zone.x, y: zone.y },
      ];
      points.forEach((point, pointIndex) => {
        lines.push(`${gerberPoint(point)}${pointIndex === 0 ? "D02" : "D01"}*`);
      });
      lines.push("G37*");
      lines.push("");
    });

  const traces = board.traces.filter((trace: Trace) => trace.layer === layer);
  traces.forEach((trace, index) => {
    const aperture = 20 + index;
    const apertureMm = Math.max(0.15, mm(trace.width));
    lines.push(`G04 TRACE ${trace.id} NET ${trace.netId}*`);
    lines.push(`%ADD${aperture}C,${apertureMm.toFixed(3)}*%`);
    lines.push(`D${aperture}*`);
    trace.points.forEach((point, pointIndex) => {
      lines.push(`${gerberPoint(point)}${pointIndex === 0 ? "D02" : "D01"}*`);
    });
    lines.push("");
  });

  board.components.forEach((component) => {
    getAbsolutePads(component).forEach((pad) => {
      const padSize = Math.max(mm(pad.width), mm(pad.height));
      lines.push(`G04 PAD ${component.name} ${pad.id} NET ${pad.netId ?? "NC"}*`);
      lines.push(`%ADD11C,${padSize.toFixed(3)}*%`);
      lines.push("D11*");
      lines.push(`${gerberPoint({ x: pad.x, y: pad.y })}D03*`);
    });
  });

  board.vias.forEach((via) => {
    const diameter = mm(via.diameter ?? 12);
    lines.push(`G04 VIA ${via.id} NET ${via.netId ?? "NC"}*`);
    lines.push(`%ADD12C,${diameter.toFixed(3)}*%`);
    lines.push("D12*");
    lines.push(`${gerberPoint({ x: via.x, y: via.y })}D03*`);
  });

  lines.push("M02*");
  return lines.join("\n");
}

function makeBoardOutlineGerber(board: Board) {
  const lines: string[] = [];
  lines.push(...makeGerberHeader("Board Outline"));
  lines.push("%ADD10C,0.150*%");
  lines.push("D10*");
  const points: Point[] = [
    { x: 0, y: 0 },
    { x: board.width, y: 0 },
    { x: board.width, y: board.height },
    { x: 0, y: board.height },
    { x: 0, y: 0 },
  ];
  points.forEach((point, index) => lines.push(`${gerberPoint(point)}${index === 0 ? "D02" : "D01"}*`));
  lines.push("M02*");
  return lines.join("\n");
}

function makeSilkscreenGerber(board: Board, layer: Layer) {
  const lines: string[] = [];
  const title = layer === "top" ? "Top Silkscreen" : "Bottom Silkscreen";
  lines.push(...makeGerberHeader(title));
  lines.push("%ADD30C,0.150*%");
  lines.push("D30*");

  const items = (board.silkscreenItems ?? []).filter((item) => item.layer === layer);
  items.forEach((item) => {
    lines.push(`G04 SILKSCREEN ${item.id} TEXT ${item.text.replace(/\*/g, "")}*`);
    lines.push(`G04 POS X=${mmText(item.x)} Y=${mmText(item.y)} ROT=${item.rotation} SIZE=${mmText(item.size)}*`);
    // Simple vector placeholder: real font plotting is a future step.
    const width = Math.max(2, item.text.length * item.size * 0.55);
    const height = item.size;
    const x1 = item.x - width / 2;
    const y1 = item.y - height;
    const x2 = item.x + width / 2;
    const y2 = item.y;
    lines.push(`${gerberPoint({ x: x1, y: y1 })}D02*`);
    lines.push(`${gerberPoint({ x: x2, y: y1 })}D01*`);
    lines.push(`${gerberPoint({ x: x2, y: y2 })}D01*`);
    lines.push(`${gerberPoint({ x: x1, y: y2 })}D01*`);
    lines.push(`${gerberPoint({ x: x1, y: y1 })}D01*`);
    lines.push("");
  });

  lines.push("M02*");
  return lines.join("\n");
}

function makeDrillFile(board: Board) {
  const lines: string[] = [];
  lines.push("M48");
  lines.push("; PCB Forge Excellon Drill Export");
  lines.push("METRIC,TZ");
  lines.push("T01C0.800");
  lines.push("T02C0.600");
  lines.push("T03C3.000");
  lines.push("%");
  lines.push("T01");
  board.components.forEach((component) => {
    getAbsolutePads(component).forEach((pad) => {
      lines.push(`X${mmText(pad.x)}Y${mmText(pad.y)}`);
    });
  });
  if (board.vias.length) {
    lines.push("T02");
    board.vias.forEach((via) => lines.push(`X${mmText(via.x)}Y${mmText(via.y)}`));
  }
  if (board.mountingHoles?.length) {
    lines.push("T03");
    board.mountingHoles.forEach((hole) => {
      lines.push(`; MOUNTING_HOLE ${hole.id} DRILL=${mmText(hole.drill)}mm DIAMETER=${mmText(hole.diameter)}mm PLATED=${hole.plated ? "YES" : "NO"}`);
      lines.push(`X${mmText(hole.x)}Y${mmText(hole.y)}`);
    });
  }
  lines.push("M30");
  return lines.join("\n");
}

function csv(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function makeBomCsv(board: Board) {
  const lines = [
    "Designator,Type,Value,Package,Marking,Tolerance,Power,Voltage,Current,Manufacturer,MPN,Supplier,SupplierSKU,CatalogCode,OrderCode,Series,MountType,Description,Datasheet,X_mm,Y_mm,Rotation"
  ];
  board.components.forEach((component) => {
    lines.push([
      component.name,
      component.type,
      component.value ?? "",
      component.packageName ?? component.footprintName ?? "",
      component.marking ?? "",
      component.tolerance ?? "",
      component.powerRating ?? "",
      component.voltageRating ?? "",
      component.currentRating ?? "",
      component.manufacturer ?? "",
      component.mpn ?? "",
      component.supplier ?? "",
      component.supplierSku ?? "",
      component.catalogCode ?? "",
      component.orderCode ?? "",
      component.series ?? "",
      component.mountType ?? "",
      component.description ?? "",
      component.datasheetUrl ?? "",
      mm(component.x).toFixed(2),
      mm(component.y).toFixed(2),
      component.rotation,
    ].map(csv).join(","));
  });
  return lines.join("\n");
}

function makePositionsCsv(board: Board) {
  const lines = ["Designator,Type,Value,Package,Marking,MPN,SupplierSKU,OrderCode,X_mm,Y_mm,Rotation,Layer"];
  board.components.forEach((component) => {
    lines.push([
      component.name,
      component.type,
      component.value ?? "",
      component.packageName ?? component.footprintName ?? "",
      component.marking ?? "",
      component.mpn ?? "",
      component.supplierSku ?? "",
      component.orderCode ?? "",
      mm(component.x).toFixed(2),
      mm(component.y).toFixed(2),
      component.rotation,
      "top"
    ].map(csv).join(","));
  });
  return lines.join("\n");
}


function makeCatalogCsv(board: Board) {
  const lines = ["Designator,Value,Manufacturer,MPN,Supplier,SupplierSKU,CatalogCode,OrderCode,Marking,Series,MountType,Parameter,ParameterValue"];
  board.components.forEach((component) => {
    const params = component.parameters ?? {};
    const entries = Object.entries(params);
    if (entries.length === 0) {
      lines.push([
        component.name,
        component.value ?? "",
        component.manufacturer ?? "",
        component.mpn ?? "",
        component.supplier ?? "",
        component.supplierSku ?? "",
        component.catalogCode ?? "",
        component.orderCode ?? "",
        component.marking ?? "",
        component.series ?? "",
        component.mountType ?? "",
        "",
        "",
      ].map(csv).join(","));
      return;
    }

    entries.forEach(([key, value]) => {
      lines.push([
        component.name,
        component.value ?? "",
        component.manufacturer ?? "",
        component.mpn ?? "",
        component.supplier ?? "",
        component.supplierSku ?? "",
        component.catalogCode ?? "",
        component.orderCode ?? "",
        component.marking ?? "",
        component.series ?? "",
        component.mountType ?? "",
        key,
        value,
      ].map(csv).join(","));
    });
  });
  return lines.join("\n");
}

function makeNetsCsv(board: Board) {
  const lines = ["NetId,NetName,Color"];
  board.nets.forEach((net) => lines.push([net.id, net.name, net.color].join(",")));
  return lines.join("\n");
}

function makeMountingHolesCsv(board: Board) {
  const lines = ["Id,X_mm,Y_mm,Diameter_mm,Drill_mm,Plated"];
  (board.mountingHoles ?? []).forEach((hole) => {
    lines.push([
      hole.id,
      mm(hole.x).toFixed(2),
      mm(hole.y).toFixed(2),
      mm(hole.diameter).toFixed(2),
      mm(hole.drill).toFixed(2),
      hole.plated ? "YES" : "NO",
    ].map(csv).join(","));
  });
  return lines.join("\n");
}

function makeSilkscreenCsv(board: Board) {
  const lines = ["Id,Text,X_mm,Y_mm,Rotation,Size_mm,Layer"];
  (board.silkscreenItems ?? []).forEach((item) => {
    lines.push([
      item.id,
      item.text,
      mm(item.x).toFixed(2),
      mm(item.y).toFixed(2),
      item.rotation,
      mm(item.size).toFixed(2),
      item.layer,
    ].map(csv).join(","));
  });
  return lines.join("\n");
}

function makeCopperZonesCsv(board: Board) {
  const lines = ["Id,Name,NetId,Layer,X_mm,Y_mm,Width_mm,Height_mm,Clearance_mm"];
  (board.copperZones ?? []).forEach((zone) => {
    lines.push([
      zone.id,
      `"${zone.name.replace(/"/g, '""')}"`,
      zone.netId,
      zone.layer,
      mmText(zone.x),
      mmText(zone.y),
      mmText(zone.width),
      mmText(zone.height),
      mmText(zone.clearance),
    ].join(","));
  });
  return lines.join("\n");
}

function makeReadme() {
  return [
    "PCB Forge manufacturing export",
    "",
    "Generated files:",
    "- top_copper.gbr",
    "- bottom_copper.gbr",
    "- board_outline.gbr",
    "- drill.drl",
    "- bom.csv",
    "- positions.csv",
    "- nets.csv",
    "- mounting_holes.csv",
    "- top_silkscreen.gbr",
    "- bottom_silkscreen.gbr",
    "- silkscreen.csv",
    "- copper_zones.csv",
    "- project.json",
    "",
    "Note: This is a basic RS-274X Gerber / Excellon-style export.",
    "Always inspect files in a Gerber viewer before fabrication.",
  ].join("\n");
}

export async function exportManufacturingPackage(board: Board) {
  downloadTextFile("top_copper.gbr", makeCopperGerber(board, "top"));
  downloadTextFile("bottom_copper.gbr", makeCopperGerber(board, "bottom"));
  downloadTextFile("board_outline.gbr", makeBoardOutlineGerber(board));
  downloadTextFile("top_silkscreen.gbr", makeSilkscreenGerber(board, "top"));
  downloadTextFile("bottom_silkscreen.gbr", makeSilkscreenGerber(board, "bottom"));
  downloadTextFile("drill.drl", makeDrillFile(board));
  downloadTextFile("bom.csv", makeBomCsv(board));
  downloadTextFile("positions.csv", makePositionsCsv(board));
  downloadTextFile("catalog_components.csv", makeCatalogCsv(board));
  downloadTextFile("nets.csv", makeNetsCsv(board));
  downloadTextFile("mounting_holes.csv", makeMountingHolesCsv(board));
  downloadTextFile("silkscreen.csv", makeSilkscreenCsv(board));
  downloadTextFile("copper_zones.csv", makeCopperZonesCsv(board));
  downloadTextFile("project.json", JSON.stringify(board, null, 2));
  downloadTextFile("README.txt", makeReadme());
}

export async function exportManufacturingZip(board: Board) {
  return exportManufacturingPackage(board);
}
