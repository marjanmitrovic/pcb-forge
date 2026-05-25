import type { DesignRules } from "../model/pcb";

type Props = {
  rules: DesignRules;
  updateRules: (patch: Partial<DesignRules>) => void;
};

function toMm(value: number) {
  return (value / 10).toFixed(2);
}

function fromMm(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed * 10));
}

export function DesignRulesPanel({ rules, updateRules }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Design rules</h2>
        <span className="muted">DRC settings</span>
      </div>

      <div className="stack">
        <RuleInput
          label="Min trace width mm"
          value={rules.minTraceWidth}
          onChange={(value) => updateRules({ minTraceWidth: value })}
        />
        <RuleInput
          label="Min clearance mm"
          value={rules.minClearance}
          onChange={(value) => updateRules({ minClearance: value })}
        />
        <RuleInput
          label="Min drill mm"
          value={rules.minDrill}
          onChange={(value) => updateRules({ minDrill: value })}
        />
        <RuleInput
          label="Min via diameter mm"
          value={rules.minViaDiameter}
          onChange={(value) => updateRules({ minViaDiameter: value })}
        />
        <RuleInput
          label="Zone clearance mm"
          value={rules.minZoneClearance}
          onChange={(value) => updateRules({ minZoneClearance: value })}
        />
        <RuleInput
          label="Copper to edge mm"
          value={rules.copperToBoardEdge}
          onChange={(value) => updateRules({ copperToBoardEdge: value })}
        />
        <RuleInput
          label="Min silkscreen text mm"
          value={rules.minSilkscreenTextSize}
          onChange={(value) => updateRules({ minSilkscreenTextSize: value })}
        />
      </div>

      <p className="small-help muted">
        These values are used by DRC. Internally the editor uses 0.1 mm units.
      </p>
    </section>
  );
}

function RuleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        type="number"
        min="0"
        step="0.05"
        value={toMm(value)}
        onChange={(event) => onChange(fromMm(event.target.value, value))}
      />
    </label>
  );
}
