import type { ReactNode } from "react";
import { Cable, FileArchive, MousePointer2, RotateCw, Save, Trash2, Upload } from "lucide-react";
import type { Tool } from "../model/pcb";

type Props = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  rotateSelected: () => void;
  deleteSelected: () => void;
  exportJson: () => void;
  importJson: () => void;
  saveLocal: () => void;
  loadLocal: () => void;
  exportManufacturing: () => void;
};

function ToolbarButton({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`btn ${active ? "btn-active" : ""}`}>
      {children}
    </button>
  );
}

export function Toolbar({
  tool,
  setTool,
  rotateSelected,
  deleteSelected,
  exportJson,
  importJson,
  saveLocal,
  loadLocal,
  exportManufacturing,
}: Props) {
  return (
    <div className="toolbar">
      <ToolbarButton active={tool === "select"} onClick={() => setTool("select")}>
        <MousePointer2 size={16} /> Select
      </ToolbarButton>
      <ToolbarButton active={tool === "route"} onClick={() => setTool("route")}>
        <Cable size={16} /> Route
      </ToolbarButton>
      <ToolbarButton onClick={rotateSelected}>
        <RotateCw size={16} /> Rotate
      </ToolbarButton>
      <ToolbarButton onClick={deleteSelected}>
        <Trash2 size={16} /> Delete
      </ToolbarButton>
      <ToolbarButton onClick={saveLocal}>
        <Save size={16} /> Save
      </ToolbarButton>
      <ToolbarButton onClick={loadLocal}>
        <Upload size={16} /> Load
      </ToolbarButton>
      <ToolbarButton onClick={exportJson}>
        <Save size={16} /> Export JSON
      </ToolbarButton>
      <ToolbarButton onClick={importJson}>
        <Upload size={16} /> Import JSON
      </ToolbarButton>
      <ToolbarButton onClick={exportManufacturing}>
        <FileArchive size={16} /> Manufacturing
      </ToolbarButton>
    </div>
  );
}
