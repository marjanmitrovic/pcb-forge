import type { AngleMode, Layer, Point } from "../model/pcb";

type Props = {
  angleMode: AngleMode;
  setAngleMode: (mode: AngleMode) => void;
  traceWidth: number;
  setTraceWidth: (width: number) => void;
  routePointCount: number;
  routeLayer: Layer | null;
  routeLastPoint: Point | null;
  finishRoute: () => void;
  cancelRoute: () => void;
  placeVia: () => void;
};

export function RoutePanel({
  angleMode,
  setAngleMode,
  traceWidth,
  setTraceWidth,
  routePointCount,
  routeLayer,
  routeLastPoint,
  finishRoute,
  cancelRoute,
  placeVia,
}: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Router</h2>
      </div>

      <div className="stack">
        <div className="layers">
          <button onClick={() => setAngleMode("orthogonal")} className={`btn ${angleMode === "orthogonal" ? "btn-active" : ""}`}>
            90°
          </button>
          <button onClick={() => setAngleMode("diagonal")} className={`btn ${angleMode === "diagonal" ? "btn-active" : ""}`}>
            45°
          </button>
        </div>

        <label className="field-label">
          Trace width mm
          <input
            type="number"
            min="0.2"
            step="0.1"
            value={(traceWidth / 10).toFixed(1)}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) setTraceWidth(Math.max(2, Math.round(value * 10)));
            }}
          />
        </label>

        <button onClick={placeVia} className="btn btn-dark">Via / switch layer</button>
        <div className="row"><span className="muted">Route points</span><strong>{routePointCount}</strong></div>
        <div className="row"><span className="muted">Route layer</span><strong>{routeLayer ?? "—"}</strong></div>
        <div className="row"><span className="muted">Last point</span><strong>{routeLastPoint ? `${routeLastPoint.x}, ${routeLastPoint.y}` : "—"}</strong></div>

        <div className="layers">
          <button onClick={finishRoute} className="btn">Finish</button>
          <button onClick={cancelRoute} className="btn">Cancel</button>
        </div>

        <p className="muted small-help">Left click adds segments. Right click finishes route. ESC cancels. Via switches Top/Bottom layer.</p>
      </div>
    </section>
  );
}
