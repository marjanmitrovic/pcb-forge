import { AlertTriangle, CheckCircle2, Lightbulb, Wrench } from "lucide-react";
import type { DrcIssue } from "../utils/drc";
import { getDrcSuggestion } from "../utils/drcSuggestions";

type Props = {
  issues: DrcIssue[];
  runDrcCheck: () => void;
  onAction?: (action: "select" | "quickfix" | "rules", issue: DrcIssue) => void;
};

export function DrcPanel({ issues, runDrcCheck, onAction }: Props) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return (
    <section className="panel drc-panel">
      <div className="panel-head">
        <h2 className="panel-title">DRC</h2>
        <button onClick={runDrcCheck} className="btn btn-dark">Run check</button>
      </div>
      <div className="drc-summary">
        <div className="drc-error-summary"><strong>{errors.length}</strong> errors</div>
        <div className="drc-warning-summary"><strong>{warnings.length}</strong> warnings</div>
      </div>
      {issues.length === 0 ? (
        <div className="drc-ok"><CheckCircle2 size={16} /> No DRC issues.</div>
      ) : (
        <div className="drc-list">
          {issues.map((issue) => {
            const suggestion = getDrcSuggestion(issue);
            return (
              <div key={issue.id} className={`drc-item ${issue.severity === "error" ? "drc-error" : "drc-warning"}`}>
                <div className="drc-item-title"><AlertTriangle size={15} /> {issue.title}</div>
                <p>{issue.message}</p>

                <div className="drc-suggestion-box">
                  <div className="drc-suggestion-title"><Lightbulb size={14} /> Suggested fix</div>
                  <p>{suggestion.summary}</p>
                  <ol>
                    {suggestion.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>

                <div className="drc-actions">
                  <button className="btn btn-small" onClick={() => onAction?.("select", issue)}>Select object</button>
                  <button className="btn btn-small btn-primary" onClick={() => onAction?.("quickfix", issue)}><Wrench size={13} /> Quick fix</button>
                  <button className="btn btn-small" onClick={() => onAction?.("rules", issue)}>Rules</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
