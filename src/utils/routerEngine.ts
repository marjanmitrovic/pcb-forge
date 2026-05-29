import type { AngleMode, Layer, Point, Trace, Via } from "../model/pcb";
import { snap, uid } from "./geometry";

export type RouteDraft = {
  points: Point[];
  netId: string;
  layer: Layer;
};

export type RouterOptions = {
  angleMode: AngleMode;
  traceWidth: number;
  activeLayer: Layer;
  activeNetId: string;
};

export type ViaOptions = {
  diameter: number;
  drill: number;
};

export function getOppositeLayer(layer: Layer): Layer {
  return layer === "top" ? "bottom" : "top";
}

export function getLastPoint(points: Point[]): Point | null {
  return points.length ? points[points.length - 1] : null;
}

export function constrainRoutePoint(from: Point, raw: Point, angleMode: AngleMode): Point {
  const dx = raw.x - from.x;
  const dy = raw.y - from.y;

  if (dx === 0 && dy === 0) return raw;

  if (angleMode === "orthogonal") {
    return Math.abs(dx) >= Math.abs(dy)
      ? { x: raw.x, y: from.y }
      : { x: from.x, y: raw.y };
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

export function startRoute(point: Point, options: RouterOptions): RouteDraft {
  return {
    points: [point],
    netId: options.activeNetId,
    layer: options.activeLayer,
  };
}

export function appendRoutePoint(
  draft: RouteDraft | null,
  rawPoint: Point,
  options: RouterOptions,
  exact = false
): RouteDraft {
  if (!draft) return startRoute(rawPoint, options);

  const from = getLastPoint(draft.points);
  if (!from) return startRoute(rawPoint, options);

  const point = exact ? rawPoint : constrainRoutePoint(from, rawPoint, options.angleMode);

  if (point.x === from.x && point.y === from.y) return draft;

  return {
    ...draft,
    points: [...draft.points, point],
  };
}

export function finishRouteDraft(
  draft: RouteDraft | null,
  traceWidth: number,
  rawEndPoint?: Point,
  angleMode?: AngleMode
): Trace | null {
  if (!draft) return null;

  const from = getLastPoint(draft.points);
  const endPoint =
    from && rawEndPoint && angleMode
      ? constrainRoutePoint(from, rawEndPoint, angleMode)
      : null;

  const points =
    endPoint && from && (endPoint.x !== from.x || endPoint.y !== from.y)
      ? [...draft.points, endPoint]
      : draft.points;

  if (points.length < 2) return null;

  return {
    id: uid("trace"),
    netId: draft.netId,
    layer: draft.layer,
    width: traceWidth,
    points,
  };
}

export function createViaFromRouteDraft(
  draft: RouteDraft | null,
  fallbackPoint: Point,
  fallbackLayer: Layer,
  fallbackNetId: string,
  options: ViaOptions = { diameter: 22, drill: 10 }
): { via: Via; nextDraft: RouteDraft } {
  const point = draft ? getLastPoint(draft.points) ?? fallbackPoint : fallbackPoint;
  const fromLayer = draft?.layer ?? fallbackLayer;
  const toLayer = getOppositeLayer(fromLayer);
  const netId = draft?.netId ?? fallbackNetId;

  const via: Via = {
    id: uid("via"),
    netId,
    x: point.x,
    y: point.y,
    fromLayer,
    toLayer,
    diameter: options.diameter,
    drill: options.drill,
  };

  return {
    via,
    nextDraft: {
      points: [point],
      netId,
      layer: toLayer,
    },
  };
}
