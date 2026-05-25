import type { PCBComponent, Pad, Point } from "../model/pcb";

export const GRID = 20;

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

export function rotatePoint(point: Point, angleDeg: number): Point {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function getAbsolutePads(component: PCBComponent): Pad[] {
  return component.pads.map((pad) => {
    const rotated = rotatePoint({ x: pad.x, y: pad.y }, component.rotation);

    return {
      ...pad,
      x: component.x + rotated.x,
      y: component.y + rotated.y,
    };
  });
}
