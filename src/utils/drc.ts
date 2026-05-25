import type { Board, CopperZone, PCBComponent, Pad, Point, Trace } from "../model/pcb";
import { getAbsolutePads } from "./geometry";

export type DrcSeverity = "error" | "warning";

export type DrcIssue = {
  id: string;
  severity: DrcSeverity;
  title: string;
  message: string;
  targetType: "board" | "component" | "pad" | "trace" | "net" | "zone" | "via";
  targetId?: string;
};

const DEFAULT_RULES = {
  minTraceWidth: 4,
  minClearance: 8,
  minDrill: 6,
  minViaDiameter: 12,
  minZoneClearance: 8,
  minSilkscreenTextSize: 10,
  copperToBoardEdge: 10,
};

function getRules(board: Board) {
  return { ...DEFAULT_RULES, ...(board.designRules ?? {}) };
}

function isPointInsideBoard(board: Board, x: number, y: number) {
  return x >= 0 && y >= 0 && x <= board.width && y <= board.height;
}

function distance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function orientation(a: Point, b: Point, c: Point) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.0001) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  return o1 !== o2 && o3 !== o4;
}

function getTraceSegments(trace: Trace) {
  const segments: { from: Point; to: Point }[] = [];
  for (let i = 0; i < trace.points.length - 1; i++) {
    segments.push({ from: trace.points[i], to: trace.points[i + 1] });
  }
  return segments;
}

function pointToSegmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projection = { x: a.x + t * dx, y: a.y + t * dy };
  return distance(point, projection);
}

function getComponentBox(component: PCBComponent) {
  if (component.type === "custom") {
    const width = component.bodyWidth ?? 80;
    const height = component.bodyHeight ?? 40;
    return {
      left: component.x - width / 2 - 10,
      right: component.x + width / 2 + 10,
      top: component.y - height / 2 - 10,
      bottom: component.y + height / 2 + 10,
    };
  }

  if (component.type === "ic") {
    return { left: component.x - 55, right: component.x + 55, top: component.y - 55, bottom: component.y + 55 };
  }
  if (component.type === "connector") {
    return { left: component.x - 60, right: component.x + 60, top: component.y - 30, bottom: component.y + 30 };
  }
  if (component.type === "led") {
    return { left: component.x - 35, right: component.x + 35, top: component.y - 35, bottom: component.y + 35 };
  }
  return { left: component.x - 60, right: component.x + 60, top: component.y - 30, bottom: component.y + 30 };
}

function boxesOverlap(a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getZoneBox(zone: CopperZone, clearance = 0) {
  return {
    left: zone.x - clearance,
    right: zone.x + zone.width + clearance,
    top: zone.y - clearance,
    bottom: zone.y + zone.height + clearance,
  };
}

function pointInsideBox(point: Point, box: { left: number; right: number; top: number; bottom: number }) {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function segmentIntersectsBox(from: Point, to: Point, box: { left: number; right: number; top: number; bottom: number }) {
  if (pointInsideBox(from, box) || pointInsideBox(to, box)) return true;

  const topLeft = { x: box.left, y: box.top };
  const topRight = { x: box.right, y: box.top };
  const bottomRight = { x: box.right, y: box.bottom };
  const bottomLeft = { x: box.left, y: box.bottom };

  return (
    segmentsIntersect(from, to, topLeft, topRight) ||
    segmentsIntersect(from, to, topRight, bottomRight) ||
    segmentsIntersect(from, to, bottomRight, bottomLeft) ||
    segmentsIntersect(from, to, bottomLeft, topLeft)
  );
}

function checkTraceInsideBoard(board: Board, trace: Trace): DrcIssue[] {
  const issues: DrcIssue[] = [];
  trace.points.forEach((point, index) => {
    if (!isPointInsideBoard(board, point.x, point.y)) {
      issues.push({
        id: `trace-outside-${trace.id}-${index}`,
        severity: "error",
        title: "Trace outside board",
        message: `Trace ${trace.id} has point outside board at ${point.x}, ${point.y}.`,
        targetType: "trace",
        targetId: trace.id,
      });
    }
  });
  return issues;
}

function checkTraceNet(board: Board, trace: Trace): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const netExists = board.nets.some((net) => net.id === trace.netId);
  if (!trace.netId || !netExists) {
    issues.push({ id: `trace-invalid-net-${trace.id}`, severity: "error", title: "Invalid trace net", message: `Trace ${trace.id} does not have a valid net.`, targetType: "trace", targetId: trace.id });
  }
  if (trace.points.length < 2) {
    issues.push({ id: `trace-too-short-${trace.id}`, severity: "error", title: "Invalid trace geometry", message: `Trace ${trace.id} has fewer than 2 points.`, targetType: "trace", targetId: trace.id });
  }
  return issues;
}

function checkTraceIntersections(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  for (let i = 0; i < board.traces.length; i++) {
    for (let j = i + 1; j < board.traces.length; j++) {
      const traceA = board.traces[i];
      const traceB = board.traces[j];
      if (traceA.netId === traceB.netId) continue;
      for (const segmentA of getTraceSegments(traceA)) {
        for (const segmentB of getTraceSegments(traceB)) {
          if (segmentsIntersect(segmentA.from, segmentA.to, segmentB.from, segmentB.to)) {
            issues.push({ id: `trace-intersection-${traceA.id}-${traceB.id}`, severity: "error", title: "Trace short circuit", message: `Trace ${traceA.id} intersects trace ${traceB.id}. Different nets must not touch.`, targetType: "trace", targetId: traceA.id });
          }
        }
      }
    }
  }
  return issues;
}

function checkTraceClearance(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  for (let i = 0; i < board.traces.length; i++) {
    for (let j = i + 1; j < board.traces.length; j++) {
      const traceA = board.traces[i];
      const traceB = board.traces[j];
      if (traceA.netId === traceB.netId) continue;
      const segmentsB = getTraceSegments(traceB);
      for (const point of traceA.points) {
        for (const segment of segmentsB) {
          const d = pointToSegmentDistance(point, segment.from, segment.to);
          const minClearance = getRules(board).minClearance;
          if (d > 0 && d < minClearance) {
            issues.push({ id: `trace-clearance-${traceA.id}-${traceB.id}-${point.x}-${point.y}`, severity: "warning", title: "Trace clearance too small", message: `Trace ${traceA.id} is too close to trace ${traceB.id}. Minimum clearance is ${(minClearance / 10).toFixed(2)} mm.`, targetType: "trace", targetId: traceA.id });
          }
        }
      }
    }
  }
  return issues;
}

function checkComponentInsideBoard(board: Board, component: PCBComponent): DrcIssue[] {
  const box = getComponentBox(component);
  if (box.left < 0 || box.top < 0 || box.right > board.width || box.bottom > board.height) {
    return [{ id: `component-outside-${component.id}`, severity: "error", title: "Component outside board", message: `${component.name} is partly or fully outside board.`, targetType: "component", targetId: component.id }];
  }
  return [];
}

function checkComponentOverlap(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  for (let i = 0; i < board.components.length; i++) {
    for (let j = i + 1; j < board.components.length; j++) {
      const componentA = board.components[i];
      const componentB = board.components[j];
      if (boxesOverlap(getComponentBox(componentA), getComponentBox(componentB))) {
        issues.push({ id: `component-overlap-${componentA.id}-${componentB.id}`, severity: "warning", title: "Component overlap", message: `${componentA.name} overlaps ${componentB.name}.`, targetType: "component", targetId: componentA.id });
      }
    }
  }
  return issues;
}

function checkPadInsideBoard(board: Board, component: PCBComponent, pad: Pad): DrcIssue[] {
  if (!isPointInsideBoard(board, pad.x, pad.y)) {
    return [{ id: `pad-outside-${pad.id}`, severity: "error", title: "Pad outside board", message: `Pad ${pad.id} on ${component.name} is outside board.`, targetType: "pad", targetId: pad.id }];
  }
  return [];
}

function checkPadNet(component: PCBComponent, pad: Pad): DrcIssue[] {
  if (!pad.netId) {
    return [{ id: `pad-unconnected-${pad.id}`, severity: "warning", title: "Unconnected pad", message: `Pad ${pad.id} on ${component.name} is not connected to any net.`, targetType: "pad", targetId: pad.id }];
  }
  return [];
}

function checkPadTraceClearance(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const pads = board.components.flatMap((component) => getAbsolutePads(component).map((pad) => ({ ...pad, componentName: component.name })));
  for (const pad of pads) {
    if (!pad.netId) continue;
    for (const trace of board.traces) {
      if (trace.netId === pad.netId) continue;
      for (const segment of getTraceSegments(trace)) {
        const d = pointToSegmentDistance({ x: pad.x, y: pad.y }, segment.from, segment.to);
        const minClearance = getRules(board).minClearance;
        if (d < minClearance) {
          issues.push({ id: `pad-trace-clearance-${pad.id}-${trace.id}`, severity: "error", title: "Pad too close to another net", message: `Pad ${pad.id} on ${pad.componentName} is too close to trace ${trace.id}. Minimum clearance is ${(minClearance / 10).toFixed(2)} mm.`, targetType: "pad", targetId: pad.id });
        }
      }
    }
  }
  return issues;
}

function checkCopperZonesInsideBoard(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const zones = board.copperZones ?? [];

  zones.forEach((zone) => {
    const box = getZoneBox(zone);
    if (box.left < 0 || box.top < 0 || box.right > board.width || box.bottom > board.height) {
      issues.push({
        id: `zone-outside-${zone.id}`,
        severity: "error",
        title: "Copper zone outside board",
        message: `Copper zone ${zone.name} is partly or fully outside the board outline.`,
        targetType: "zone",
        targetId: zone.id,
      });
    }

    const netExists = board.nets.some((net) => net.id === zone.netId);
    if (!zone.netId || !netExists) {
      issues.push({
        id: `zone-invalid-net-${zone.id}`,
        severity: "error",
        title: "Invalid copper zone net",
        message: `Copper zone ${zone.name} does not have a valid net.`,
        targetType: "zone",
        targetId: zone.id,
      });
    }
  });

  return issues;
}

function checkCopperZoneOverlaps(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const zones = board.copperZones ?? [];

  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const zoneA = zones[i];
      const zoneB = zones[j];
      if (zoneA.layer !== zoneB.layer) continue;
      if (zoneA.netId === zoneB.netId) continue;

      if (boxesOverlap(getZoneBox(zoneA), getZoneBox(zoneB))) {
        issues.push({
          id: `zone-overlap-${zoneA.id}-${zoneB.id}`,
          severity: "error",
          title: "Copper zones overlap",
          message: `${zoneA.name} overlaps ${zoneB.name}. Zones on the same layer must not overlap if they belong to different nets.`,
          targetType: "zone",
          targetId: zoneA.id,
        });
      }
    }
  }

  return issues;
}

function checkCopperZoneTraceConflicts(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const zones = board.copperZones ?? [];

  zones.forEach((zone) => {
    const exactBox = getZoneBox(zone);
    const clearanceBox = getZoneBox(zone, Math.max(zone.clearance ?? 0, getRules(board).minZoneClearance));

    board.traces.forEach((trace) => {
      if (trace.layer !== zone.layer) return;
      if (trace.netId === zone.netId) return;

      const segments = getTraceSegments(trace);
      const touchesZone = segments.some((segment) => segmentIntersectsBox(segment.from, segment.to, exactBox));
      const violatesClearance = segments.some((segment) => segmentIntersectsBox(segment.from, segment.to, clearanceBox));

      if (touchesZone) {
        issues.push({
          id: `zone-trace-short-${zone.id}-${trace.id}`,
          severity: "error",
          title: "Copper zone short circuit",
          message: `${zone.name} touches trace ${trace.id}. They are on the same layer but belong to different nets.`,
          targetType: "zone",
          targetId: zone.id,
        });
      } else if (violatesClearance) {
        issues.push({
          id: `zone-trace-clearance-${zone.id}-${trace.id}`,
          severity: "warning",
          title: "Copper zone clearance too small",
          message: `${zone.name} is too close to trace ${trace.id}. Minimum zone clearance is ${(getRules(board).minZoneClearance / 10).toFixed(2)} mm.`,
          targetType: "zone",
          targetId: zone.id,
        });
      }
    });
  });

  return issues;
}

function checkCopperZonePadConflicts(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const zones = board.copperZones ?? [];
  const pads = board.components.flatMap((component) =>
    getAbsolutePads(component).map((pad) => ({ ...pad, componentName: component.name }))
  );

  zones.forEach((zone) => {
    const exactBox = getZoneBox(zone);
    const clearanceBox = getZoneBox(zone, Math.max(zone.clearance ?? 0, getRules(board).minZoneClearance));

    pads.forEach((pad) => {
      if (!pad.netId) return;
      if (pad.netId === zone.netId) return;

      const point = { x: pad.x, y: pad.y };
      if (pointInsideBox(point, exactBox)) {
        issues.push({
          id: `zone-pad-short-${zone.id}-${pad.id}`,
          severity: "error",
          title: "Copper zone touches pad from another net",
          message: `${zone.name} touches pad ${pad.id} on ${pad.componentName}.`,
          targetType: "zone",
          targetId: zone.id,
        });
      } else if (pointInsideBox(point, clearanceBox)) {
        issues.push({
          id: `zone-pad-clearance-${zone.id}-${pad.id}`,
          severity: "warning",
          title: "Copper zone pad clearance too small",
          message: `${zone.name} is too close to pad ${pad.id} on ${pad.componentName}. Minimum zone clearance is ${(getRules(board).minZoneClearance / 10).toFixed(2)} mm.`,
          targetType: "zone",
          targetId: zone.id,
        });
      }
    });
  });

  return issues;
}

function checkCopperZoneViaConflicts(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const zones = board.copperZones ?? [];

  zones.forEach((zone) => {
    const exactBox = getZoneBox(zone);
    const clearanceBox = getZoneBox(zone, Math.max(zone.clearance ?? 0, getRules(board).minZoneClearance));

    board.vias.forEach((via) => {
      if (via.netId === zone.netId) return;

      const point = { x: via.x, y: via.y };
      if (pointInsideBox(point, exactBox)) {
        issues.push({
          id: `zone-via-short-${zone.id}-${via.id}`,
          severity: "error",
          title: "Copper zone touches via from another net",
          message: `${zone.name} touches via ${via.id}.`,
          targetType: "zone",
          targetId: zone.id,
        });
      } else if (pointInsideBox(point, clearanceBox)) {
        issues.push({
          id: `zone-via-clearance-${zone.id}-${via.id}`,
          severity: "warning",
          title: "Copper zone via clearance too small",
          message: `${zone.name} is too close to via ${via.id}. Minimum zone clearance is ${(getRules(board).minZoneClearance / 10).toFixed(2)} mm.`,
          targetType: "zone",
          targetId: zone.id,
        });
      }
    });
  });

  return issues;
}


function checkManufacturingRules(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const rules = getRules(board);

  board.traces.forEach((trace) => {
    if (trace.width < rules.minTraceWidth) {
      issues.push({
        id: `trace-width-${trace.id}`,
        severity: "error",
        title: "Trace width below rule",
        message: `Trace ${trace.id} width is ${(trace.width / 10).toFixed(2)} mm. Minimum is ${(rules.minTraceWidth / 10).toFixed(2)} mm.`,
        targetType: "trace",
        targetId: trace.id,
      });
    }
  });

  board.vias.forEach((via) => {
    if (via.drill < rules.minDrill) {
      issues.push({
        id: `via-drill-${via.id}`,
        severity: "error",
        title: "Via drill below rule",
        message: `Via ${via.id} drill is ${(via.drill / 10).toFixed(2)} mm. Minimum is ${(rules.minDrill / 10).toFixed(2)} mm.`,
        targetType: "via",
        targetId: via.id,
      });
    }

    if (via.diameter < rules.minViaDiameter) {
      issues.push({
        id: `via-diameter-${via.id}`,
        severity: "error",
        title: "Via diameter below rule",
        message: `Via ${via.id} diameter is ${(via.diameter / 10).toFixed(2)} mm. Minimum is ${(rules.minViaDiameter / 10).toFixed(2)} mm.`,
        targetType: "via",
        targetId: via.id,
      });
    }
  });

  (board.copperZones ?? []).forEach((zone) => {
    if ((zone.clearance ?? 0) < rules.minZoneClearance) {
      issues.push({
        id: `zone-clearance-rule-${zone.id}`,
        severity: "warning",
        title: "Copper zone clearance below rule",
        message: `${zone.name} clearance is ${(zone.clearance / 10).toFixed(2)} mm. Minimum is ${(rules.minZoneClearance / 10).toFixed(2)} mm.`,
        targetType: "zone",
        targetId: zone.id,
      });
    }

    const edgeDistance = Math.min(zone.x, zone.y, board.width - (zone.x + zone.width), board.height - (zone.y + zone.height));
    if (edgeDistance < rules.copperToBoardEdge) {
      issues.push({
        id: `zone-edge-clearance-${zone.id}`,
        severity: "warning",
        title: "Copper too close to board edge",
        message: `${zone.name} is ${(edgeDistance / 10).toFixed(2)} mm from board edge. Minimum is ${(rules.copperToBoardEdge / 10).toFixed(2)} mm.`,
        targetType: "zone",
        targetId: zone.id,
      });
    }
  });

  (board.silkscreenItems ?? []).forEach((item) => {
    if (item.size < rules.minSilkscreenTextSize) {
      issues.push({
        id: `silkscreen-size-${item.id}`,
        severity: "warning",
        title: "Silkscreen text too small",
        message: `Silkscreen text "${item.text}" is ${(item.size / 10).toFixed(2)} mm. Minimum is ${(rules.minSilkscreenTextSize / 10).toFixed(2)} mm.`,
        targetType: "board",
        targetId: item.id,
      });
    }
  });

  return issues;
}

function checkUnusedNets(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  board.nets.forEach((net) => {
    const hasTrace = board.traces.some((trace) => trace.netId === net.id);
    const hasPad = board.components.some((component) => component.pads.some((pad) => pad.netId === net.id));
    if (!hasTrace && !hasPad) {
      issues.push({ id: `unused-net-${net.id}`, severity: "warning", title: "Unused net", message: `Net ${net.name} is not used by any trace or pad.`, targetType: "net", targetId: net.id });
    }
  });
  return issues;
}

export function runDrc(board: Board): DrcIssue[] {
  const issues: DrcIssue[] = [];
  board.traces.forEach((trace) => {
    issues.push(...checkTraceInsideBoard(board, trace));
    issues.push(...checkTraceNet(board, trace));
  });
  board.components.forEach((component) => {
    issues.push(...checkComponentInsideBoard(board, component));
    const absolutePads = getAbsolutePads(component);
    absolutePads.forEach((pad) => {
      issues.push(...checkPadInsideBoard(board, component, pad));
      issues.push(...checkPadNet(component, pad));
    });
  });
  issues.push(...checkTraceIntersections(board));
  issues.push(...checkTraceClearance(board));
  issues.push(...checkComponentOverlap(board));
  issues.push(...checkPadTraceClearance(board));
  issues.push(...checkCopperZonesInsideBoard(board));
  issues.push(...checkCopperZoneOverlaps(board));
  issues.push(...checkCopperZoneTraceConflicts(board));
  issues.push(...checkCopperZonePadConflicts(board));
  issues.push(...checkCopperZoneViaConflicts(board));
  issues.push(...checkManufacturingRules(board));
  issues.push(...checkUnusedNets(board));
  return issues;
}
