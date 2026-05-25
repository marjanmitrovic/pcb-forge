import { Download, Network } from "lucide-react";
import type { Board, Net, PCBComponent, Pad, Trace, Via } from "../model/pcb";

type NetlistPadRow = {
  netId: string;
  netName: string;
  netColor: string;
  componentRef: string;
  componentType: string;
  componentValue: string;
  padName: string;
  padId: string;
  pinName: string;
  x: number;
  y: number;
};

type NetSummary = {
  net: Net;
  pads: NetlistPadRow[];
  traces: Trace[];
  vias: Via[];
};

type Props = {
  board: Board;
};

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function mm(value: number) {
  return (value / 10).toFixed(2);
}

function padLabel(pad: Pad) {
  const parts = pad.id.split("_");
  return parts[parts.length - 1] || pad.id;
}

function buildRows(board: Board): NetlistPadRow[] {
  const netById = new Map(board.nets.map((net) => [net.id, net]));

  return board.components.flatMap((component: PCBComponent) =>
    component.pads.map((pad) => {
      const net = pad.netId ? netById.get(pad.netId) : undefined;

      return {
        netId: pad.netId ?? "__unconnected__",
        netName: net?.name ?? "UNCONNECTED",
        netColor: net?.color ?? "#94a3b8",
        componentRef: component.name,
        componentType: component.type,
        componentValue: component.value || component.mpn || component.catalogDescription || "",
        padName: padLabel(pad),
        padId: pad.id,
        pinName: pad.pinName ?? "",
        x: component.x + pad.x,
        y: component.y + pad.y,
      };
    })
  );
}

function buildNetSummaries(board: Board): NetSummary[] {
  const rows = buildRows(board);

  return board.nets.map((net) => ({
    net,
    pads: rows.filter((row) => row.netId === net.id),
    traces: board.traces.filter((trace) => trace.netId === net.id),
    vias: board.vias.filter((via) => via.netId === net.id),
  }));
}

function makeNetlistCsv(board: Board) {
  const header = [
    "Net",
    "Component",
    "Type",
    "Value",
    "Pad",
    "Pin name",
    "Pad ID",
    "X mm",
    "Y mm",
  ];

  const body = buildRows(board).map((row) => [
    row.netName,
    row.componentRef,
    row.componentType,
    row.componentValue,
    row.padName,
    row.pinName,
    row.padId,
    mm(row.x),
    mm(row.y),
  ]);

  return [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n");
}

function makeConnectionCsv(board: Board) {
  const header = [
    "Net",
    "Pads",
    "Pad count",
    "Trace count",
    "Via count",
  ];

  const body = buildNetSummaries(board).map((summary) => [
    summary.net.name,
    summary.pads.map((pad) => `${pad.componentRef}.${pad.padName}`).join(" "),
    summary.pads.length,
    summary.traces.length,
    summary.vias.length,
  ]);

  return [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function NetlistPanel({ board }: Props) {
  const rows = buildRows(board);
  const summaries = buildNetSummaries(board);
  const unconnected = rows.filter((row) => row.netId === "__unconnected__");
  const connectedRows = rows.length - unconnected.length;

  function exportPadNetlist() {
    downloadTextFile("netlist_pads.csv", makeNetlistCsv(board));
  }

  function exportConnections() {
    downloadTextFile("netlist_connections.csv", makeConnectionCsv(board));
  }

  return (
    <section className="panel netlist-panel">
      <h2 className="panel-title"><Network size={18} /> Netlist / Connections</h2>
      <p className="small-help muted">Pregled svih padova, netova, vodova i via tačaka. Ovde vidiš šta je spojeno na GND, VCC i ostale mreže.</p>

      <div className="bom-stats">
        <div><span>Connected pads</span><strong>{connectedRows}</strong></div>
        <div><span>Unconnected</span><strong>{unconnected.length}</strong></div>
        <div><span>Nets</span><strong>{board.nets.length}</strong></div>
      </div>

      <div className="button-row-wrap">
        <button className="full-btn primary-btn" onClick={exportPadNetlist} disabled={rows.length === 0}>
          <Download size={16} /> Export pad netlist
        </button>
        <button className="full-btn" onClick={exportConnections} disabled={board.nets.length === 0}>
          <Download size={16} /> Export connections
        </button>
      </div>

      {summaries.length === 0 ? (
        <p className="small-help muted">No nets yet.</p>
      ) : (
        <div className="netlist-table">
          {summaries.map((summary) => (
            <div className="netlist-row" key={summary.net.id}>
              <div className="netlist-row-top">
                <strong className="net-name"><span style={{ backgroundColor: summary.net.color }} />{summary.net.name}</strong>
                <span>{summary.pads.length} pads · {summary.traces.length} traces · {summary.vias.length} vias</span>
              </div>
              {summary.pads.length === 0 ? (
                <p className="small-help muted">No pads assigned.</p>
              ) : (
                <div className="netlist-pads">
                  {summary.pads.map((pad) => (
                    <div key={pad.padId}>
                      <strong>{pad.componentRef}.{pad.padName}</strong>
                      <span>{pad.pinName ? `${pad.pinName} · ` : ""}{pad.componentValue || pad.componentType}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {unconnected.length > 0 && (
            <div className="netlist-row warning-row">
              <div className="netlist-row-top">
                <strong>UNCONNECTED</strong>
                <span>{unconnected.length} pads</span>
              </div>
              <div className="netlist-pads">
                {unconnected.map((pad) => (
                  <div key={pad.padId}>
                    <strong>{pad.componentRef}.{pad.padName}</strong>
                    <span>{pad.pinName ? `${pad.pinName} · ` : ""}{pad.componentValue || pad.componentType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
