import type { DrcIssue } from "./drc";

export type DrcSuggestion = {
  summary: string;
  steps: string[];
};

export function getDrcSuggestion(issue: DrcIssue): DrcSuggestion {
  const title = issue.title.toLowerCase();
  const message = issue.message.toLowerCase();

  if (title.includes("short circuit") || message.includes("different nets")) {
    return {
      summary: "Different nets are touching. Separate the route or use a via to cross on the other layer.",
      steps: ["Select the highlighted trace.", "Move or delete the conflicting route segment.", "Reroute one net with enough clearance."],
    };
  }

  if (title.includes("clearance")) {
    return {
      summary: "The distance is below the current design rule.",
      steps: ["Move one object farther away.", "Use a narrower trace only if allowed by your manufacturer.", "Or adjust DRC clearance rules if this is intentional."],
    };
  }

  if (title.includes("unconnected")) {
    return {
      summary: "This pad has no assigned net.",
      steps: ["Choose the correct net in Nets.", "Use Route and click the pad.", "Leave it unconnected only if it is intentionally NC."],
    };
  }

  if (title.includes("outside")) {
    return {
      summary: "The object is outside the board outline.",
      steps: ["Move the object inward.", "Or enlarge the board from Board settings."],
    };
  }

  if (title.includes("invalid trace net")) {
    return {
      summary: "The trace references a net that does not exist.",
      steps: ["Assign the active net to this trace.", "Or create the missing net in Nets."],
    };
  }

  if (title.includes("width")) {
    return {
      summary: "The trace is narrower than the current design rules allow.",
      steps: ["Increase trace width.", "Or reduce the min trace width rule if your board house allows it."],
    };
  }

  if (title.includes("via") || title.includes("drill")) {
    return {
      summary: "The via dimensions are below the current manufacturing rule.",
      steps: ["Increase via diameter.", "Increase drill size.", "Run DRC again."],
    };
  }

  if (title.includes("zone") || title.includes("copper")) {
    return {
      summary: "Copper zone rule issue.",
      steps: ["Check zone net and layer.", "Increase zone clearance.", "Move the zone away from board edge or other nets."],
    };
  }

  if (title.includes("silkscreen")) {
    return {
      summary: "Silkscreen text is too small or placed badly.",
      steps: ["Increase text size.", "Move text away from pads/copper.", "Run DRC again."],
    };
  }

  return {
    summary: "Review this DRC item and correct the highlighted object.",
    steps: ["Select the object.", "Check its net, layer, geometry and design rules.", "Run DRC again."],
  };
}
