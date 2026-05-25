import type { Layer } from "../model/pcb";

type Props = {
  layer: Layer;
  setLayer: (layer: Layer) => void;
};

export function LayerPanel({ layer, setLayer }: Props) {
  return (
    <section className="panel">
      <h2 className="panel-title">Layers</h2>
      <div className="layers">
        <button onClick={() => setLayer("top")} className={`btn ${layer === "top" ? "layer-top-active" : ""}`}>
          Top
        </button>
        <button onClick={() => setLayer("bottom")} className={`btn ${layer === "bottom" ? "layer-bottom-active" : ""}`}>
          Bottom
        </button>
      </div>
    </section>
  );
}
