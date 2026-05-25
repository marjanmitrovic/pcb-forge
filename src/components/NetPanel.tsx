import type { Net } from "../model/pcb";

type Props = {
  nets: Net[];
  activeNetId: string;
  setActiveNetId: (id: string) => void;
  addNet: () => void;
};

export function NetPanel({ nets, activeNetId, setActiveNetId, addNet }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Nets</h2>
        <button onClick={addNet} className="btn btn-dark">+ Net</button>
      </div>
      <div className="stack">
        {nets.map((net) => (
          <button
            key={net.id}
            onClick={() => setActiveNetId(net.id)}
            className={`net-button ${activeNetId === net.id ? "net-active" : ""}`}
          >
            <span className="net-left">
              <span className="net-dot" style={{ backgroundColor: net.color }} />
              {net.name}
            </span>
            {activeNetId === net.id && <span>active</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
