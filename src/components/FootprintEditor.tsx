import { Footprints, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Footprint, FootprintPadTemplate } from "../model/pcb";
import { uid } from "../utils/geometry";

type Props = {
  footprints: Footprint[];
  addFootprint: (footprint: Footprint) => void;
  deleteFootprint: (id: string) => void;
};

function makePads(count: number, pitch: number, padWidth: number, padHeight: number): FootprintPadTemplate[] {
  const safeCount = Math.max(1, Math.min(64, Math.round(count)));
  const start = -((safeCount - 1) * pitch) / 2;
  return Array.from({ length: safeCount }, (_, index) => ({
    id: String(index + 1),
    x: Math.round(start + index * pitch),
    y: 0,
    width: padWidth,
    height: padHeight,
  }));
}

export function FootprintEditor({ footprints, addFootprint, deleteFootprint }: Props) {
  const [name, setName] = useState("Terminal Block 2P");
  const [prefix, setPrefix] = useState("J");
  const [bodyWidth, setBodyWidth] = useState(110);
  const [bodyHeight, setBodyHeight] = useState(46);
  const [padCount, setPadCount] = useState(2);
  const [pitch, setPitch] = useState(40);
  const [padWidth, setPadWidth] = useState(18);
  const [padHeight, setPadHeight] = useState(18);

  const previewPads = useMemo(
    () => makePads(padCount, pitch, padWidth, padHeight),
    [padCount, pitch, padWidth, padHeight]
  );

  function saveFootprint() {
    const cleanName = name.trim();
    const cleanPrefix = prefix.trim().toUpperCase() || "X";
    if (!cleanName) {
      alert("Footprint name is required.");
      return;
    }

    addFootprint({
      id: uid("fp"),
      name: cleanName,
      prefix: cleanPrefix,
      bodyWidth,
      bodyHeight,
      pads: previewPads,
    });
  }

  return (
    <section className="panel">
      <h2 className="panel-title">
        <Footprints size={18} /> Footprint Editor
      </h2>

      <div className="form-grid">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Prefix
          <input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
        </label>
        <label>
          Body W
          <input type="number" value={bodyWidth} onChange={(event) => setBodyWidth(Number(event.target.value))} />
        </label>
        <label>
          Body H
          <input type="number" value={bodyHeight} onChange={(event) => setBodyHeight(Number(event.target.value))} />
        </label>
        <label>
          Pads
          <input type="number" min="1" max="64" value={padCount} onChange={(event) => setPadCount(Number(event.target.value))} />
        </label>
        <label>
          Pitch
          <input type="number" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} />
        </label>
        <label>
          Pad W
          <input type="number" value={padWidth} onChange={(event) => setPadWidth(Number(event.target.value))} />
        </label>
        <label>
          Pad H
          <input type="number" value={padHeight} onChange={(event) => setPadHeight(Number(event.target.value))} />
        </label>
      </div>

      <div className="footprint-preview">
        <svg viewBox="-100 -70 200 140" width="100%" height="120">
          <rect x={-bodyWidth / 2} y={-bodyHeight / 2} width={bodyWidth} height={bodyHeight} rx="8" fill="#fff7ed" stroke="#c2410c" strokeWidth="2" />
          {previewPads.map((pad) => (
            <g key={pad.id}>
              <rect x={pad.x - pad.width / 2} y={pad.y - pad.height / 2} width={pad.width} height={pad.height} rx="4" fill="#facc15" stroke="#854d0e" strokeWidth="2" />
              <text x={pad.x} y={pad.y + 4} textAnchor="middle" className="component-label-small">{pad.id}</text>
            </g>
          ))}
          <text x="0" y={bodyHeight / 2 + 18} textAnchor="middle" className="component-label-small">{name}</text>
        </svg>
      </div>

      <button onClick={saveFootprint} className="btn btn-dark btn-full">
        <Plus size={16} /> Save footprint
      </button>

      <div className="library-section-title">Saved footprints</div>
      <div className="stack">
        {footprints.length === 0 ? (
          <p className="small-help muted">Saved footprints will appear here and in Component Library.</p>
        ) : (
          footprints.map((footprint) => (
            <div key={footprint.id} className="footprint-row">
              <span>
                <strong>{footprint.name}</strong>
                <small>{footprint.pads.length} pads · {footprint.prefix}</small>
              </span>
              <button onClick={() => deleteFootprint(footprint.id)} className="icon-button" title="Delete footprint">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
