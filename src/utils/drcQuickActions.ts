import type { DrcIssue } from "./drc";

export type DrcQuickActionId =
  | "select-target"
  | "delete-target"
  | "increase-trace-width"
  | "increase-via-size"
  | "move-inside-board"
  | "open-rules"
  | "mark-review";

export type DrcQuickAction = {
  id: DrcQuickActionId;
  label: string;
  kind: "safe" | "review" | "manual";
  description: string;
};

function textOf(issue: DrcIssue) {
  return `${issue.id} ${issue.title} ${issue.message} ${issue.targetType}`.toLowerCase();
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function getDrcQuickActions(issue: DrcIssue): DrcQuickAction[] {
  const text = textOf(issue);
  const actions: DrcQuickAction[] = [];

  if (issue.targetId) {
    actions.push({
      id: "select-target",
      label: "Select object",
      kind: "safe",
      description: "Selektuje objekat na koji se DRC greška odnosi.",
    });
  }

  if (issue.targetType === "trace") {
    if (hasAny(text, ["trace width below", "width below", "minimum trace width"])) {
      actions.push({
        id: "increase-trace-width",
        label: "Increase width",
        kind: "safe",
        description: "Povećava širinu izabranog voda na minimalnu vrednost iz Design Rules.",
      });
    }

    if (hasAny(text, ["invalid trace", "outside board", "short circuit", "intersects trace", "clearance"])) {
      actions.push({
        id: "delete-target",
        label: "Delete trace",
        kind: "review",
        description: "Briše problematični vod da ga ponovo izrutiraš čistom putanjom.",
      });
    }
  }

  if (issue.targetType === "via") {
    if (hasAny(text, ["drill", "diameter", "via"])) {
      actions.push({
        id: "increase-via-size",
        label: "Fix via size",
        kind: "safe",
        description: "Povećava via diameter/drill na minimalne vrednosti iz Design Rules.",
      });
    }

    actions.push({
      id: "delete-target",
      label: "Delete via",
      kind: "review",
      description: "Briše problematičnu via tačku.",
    });
  }

  if (issue.targetType === "component" || issue.targetType === "pad") {
    if (hasAny(text, ["outside board", "pad outside", "component outside"])) {
      actions.push({
        id: "move-inside-board",
        label: "Move inward",
        kind: "safe",
        description: "Pomera komponentu prema unutrašnjosti ploče ako aplikacija može da je mapira.",
      });
    }
  }

  if (issue.targetType === "net" && hasAny(text, ["unused net"])) {
    actions.push({
      id: "mark-review",
      label: "Review net",
      kind: "manual",
      description: "Ovaj net je možda planiran, ali još nije povezan. Proveri da li ga treba obrisati ili povezati.",
    });
  }

  if (hasAny(text, ["clearance", "minimum", "rule", "zone clearance"])) {
    actions.push({
      id: "open-rules",
      label: "Open rules",
      kind: "manual",
      description: "Otvori DRC/Design Rules panel da proveriš ili promeniš proizvodna pravila.",
    });
  }

  return dedupeActions(actions);
}

function dedupeActions(actions: DrcQuickAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

export function getDrcActionKindLabel(kind: DrcQuickAction["kind"]) {
  if (kind === "safe") return "safe";
  if (kind === "review") return "review";
  return "manual";
}
