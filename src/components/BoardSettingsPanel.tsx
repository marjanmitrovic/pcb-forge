import type { Board } from "../model/pcb";

type Props = {
  board: Board;
  updateBoard: (patch: Partial<Pick<Board, "name" | "width" | "height">>) => void;
};

function toMm(value: number) {
  return value / 10;
}

function fromMm(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(10, Math.round(parsed * 10));
}

export function BoardSettingsPanel({ board, updateBoard }: Props) {
  return (
    <section className="panel">
      <h2 className="panel-title">Board settings</h2>
      <div className="form-grid compact-form">
        <label>
          Board name
          <input
            value={board.name}
            onChange={(event) => updateBoard({ name: event.target.value })}
          />
        </label>

        <label>
          Width mm
          <input
            type="number"
            min="10"
            value={toMm(board.width)}
            onChange={(event) => updateBoard({ width: fromMm(event.target.value) })}
          />
        </label>

        <label>
          Height mm
          <input
            type="number"
            min="10"
            value={toMm(board.height)}
            onChange={(event) => updateBoard({ height: fromMm(event.target.value) })}
          />
        </label>
      </div>
      <p className="muted small-help">Dimenzije su u milimetrima. Interno se čuvaju na grid koordinatama.</p>
    </section>
  );
}
