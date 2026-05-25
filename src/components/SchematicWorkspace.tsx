import { useMemo, useState } from "react";
import { uid } from "../utils/geometry";

type SchematicSymbolType = "resistor" | "capacitor" | "led" | "ic" | "connector";

type SchematicPin = {
  id: string;
  name: string;
  x: number;
  y: number;
  netName?: string;
};

type SchematicSymbol = {
  id: string;
  type: SchematicSymbolType;
  name: string;
  value: string;
  x: number;
  y: number;
  pins: SchematicPin[];
};

type SchematicWire = {
  id: string;
  netName: string;
  fromSymbolId: string;
  fromPinId: string;
  toSymbolId: string;
  toPinId: string;
};

type PendingPin = {
  symbolId: string;
  pinId: string;
} | null;

export type SchematicToPcbSymbol = {
  id: string;
  type: SchematicSymbolType;
  name: string;
  value: string;
  pins: {
    id: string;
    name: string;
    netName?: string;
  }[];
};

export type SchematicToPcbPayload = {
  symbols: SchematicToPcbSymbol[];
  wires: SchematicWire[];
  netNames: string[];
};

type Props = {
  onSendNetsToPcb: (netNames: string[]) => void;
  onSendToPcb?: (payload: SchematicToPcbPayload) => void;
};

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function createSymbol(type: SchematicSymbolType, index: number): SchematicSymbol {
  const id = uid("sch");

  if (type === "ic") {
    return {
      id,
      type,
      name: `U${index}`,
      value: "NE555",
      x: 420,
      y: 220,
      pins: [
        { id: "1", name: "GND", x: -50, y: -70 },
        { id: "2", name: "TRIG", x: -50, y: -50 },
        { id: "3", name: "OUT", x: -50, y: -30 },
        { id: "4", name: "RESET", x: -50, y: -10 },
        { id: "5", name: "CTRL", x: 50, y: -10 },
        { id: "6", name: "THRESH", x: 50, y: -30 },
        { id: "7", name: "DISCH", x: 50, y: -50 },
        { id: "8", name: "VCC", x: 50, y: -70 },
      ],
    };
  }

  if (type === "connector") {
    return {
      id,
      type,
      name: `J${index}`,
      value: "CONN_3",
      x: 180,
      y: 220,
      pins: [
        { id: "1", name: "1", x: 50, y: -24 },
        { id: "2", name: "2", x: 50, y: 0 },
        { id: "3", name: "3", x: 50, y: 24 },
      ],
    };
  }

  const prefix = type === "resistor" ? "R" : type === "capacitor" ? "C" : "D";
  const value = type === "resistor" ? "10k" : type === "capacitor" ? "100nF" : "LED";
  const pinNames = type === "led" ? ["A", "K"] : ["1", "2"];

  return {
    id,
    type,
    name: `${prefix}${index}`,
    value,
    x: 240 + index * 30,
    y: 150 + index * 20,
    pins: [
      { id: "1", name: pinNames[0], x: -55, y: 0 },
      { id: "2", name: pinNames[1], x: 55, y: 0 },
    ],
  };
}

function getPin(symbols: SchematicSymbol[], symbolId: string, pinId: string) {
  const symbol = symbols.find((item) => item.id === symbolId);
  const pin = symbol?.pins.find((item) => item.id === pinId);
  if (!symbol || !pin) return null;
  return {
    symbol,
    pin,
    x: symbol.x + pin.x,
    y: symbol.y + pin.y,
  };
}

function getNetNames(symbols: SchematicSymbol[], wires: SchematicWire[]) {
  const names = new Set<string>();
  wires.forEach((wire) => names.add(wire.netName));
  symbols.forEach((symbol) => symbol.pins.forEach((pin) => pin.netName && names.add(pin.netName)));
  return [...names].sort();
}

export function SchematicWorkspace({ onSendNetsToPcb, onSendToPcb }: Props) {
  const [symbols, setSymbols] = useState<SchematicSymbol[]>([]);
  const [wires, setWires] = useState<SchematicWire[]>([]);
  const [pendingPin, setPendingPin] = useState<PendingPin>(null);
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [draggingSymbolId, setDraggingSymbolId] = useState<string | null>(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const netNames = useMemo(() => getNetNames(symbols, wires), [symbols, wires]);
  const selectedSymbol = symbols.find((symbol) => symbol.id === selectedSymbolId) ?? null;

  function addSymbol(type: SchematicSymbolType) {
    const index = symbols.filter((item) => item.type === type).length + 1;
    setSymbols((prev) => [...prev, createSymbol(type, index)]);
  }

  function updateSelectedSymbol(patch: Partial<SchematicSymbol>) {
    if (!selectedSymbolId) return;
    setSymbols((prev) => prev.map((symbol) => (symbol.id === selectedSymbolId ? { ...symbol, ...patch } : symbol)));
  }

  function deleteSelectedSymbol() {
    if (!selectedSymbolId) return;
    setSymbols((prev) => prev.filter((symbol) => symbol.id !== selectedSymbolId));
    setWires((prev) => prev.filter((wire) => wire.fromSymbolId !== selectedSymbolId && wire.toSymbolId !== selectedSymbolId));
    setSelectedSymbolId(null);
  }

  function connectPin(symbolId: string, pinId: string) {
    if (!pendingPin) {
      setPendingPin({ symbolId, pinId });
      return;
    }

    if (pendingPin.symbolId === symbolId && pendingPin.pinId === pinId) {
      setPendingPin(null);
      return;
    }

    const from = getPin(symbols, pendingPin.symbolId, pendingPin.pinId);
    const to = getPin(symbols, symbolId, pinId);
    if (!from || !to) return;

    const suggested = from.pin.name === "GND" || to.pin.name === "GND"
      ? "GND"
      : from.pin.name === "VCC" || to.pin.name === "VCC"
        ? "VCC"
        : "NET_" + (wires.length + 1);

    const input = window.prompt("Net name", suggested);
    const netName = input?.trim().toUpperCase();
    if (!netName) {
      setPendingPin(null);
      return;
    }

    setSymbols((prev) => prev.map((symbol) => {
      if (symbol.id !== pendingPin.symbolId && symbol.id !== symbolId) return symbol;
      return {
        ...symbol,
        pins: symbol.pins.map((pin) => {
          if (symbol.id === pendingPin.symbolId && pin.id === pendingPin.pinId) return { ...pin, netName };
          if (symbol.id === symbolId && pin.id === pinId) return { ...pin, netName };
          return pin;
        }),
      };
    }));

    setWires((prev) => [...prev, {
      id: uid("wire"),
      netName,
      fromSymbolId: pendingPin.symbolId,
      fromPinId: pendingPin.pinId,
      toSymbolId: symbolId,
      toPinId: pinId,
    }]);
    setPendingPin(null);
  }


  function sendSymbolsToPcb() {
    if (!symbols.length) {
      alert("No schematic symbols to send.");
      return;
    }

    if (!onSendToPcb) {
      alert("PCB link is not available in this build.");
      return;
    }

    onSendToPcb({
      symbols: symbols.map((symbol) => ({
        id: symbol.id,
        type: symbol.type,
        name: symbol.name,
        value: symbol.value,
        pins: symbol.pins.map((pin) => ({
          id: pin.id,
          name: pin.name,
          netName: pin.netName,
        })),
      })),
      wires,
      netNames,
    });
  }

  function exportSchematicJson() {
    downloadTextFile("schematic.json", JSON.stringify({ version: "0.1.0", symbols, wires }, null, 2));
  }

  function exportNetlistCsv() {
    const lines = ["Net,From,FromPin,To,ToPin"];
    wires.forEach((wire) => {
      const from = getPin(symbols, wire.fromSymbolId, wire.fromPinId);
      const to = getPin(symbols, wire.toSymbolId, wire.toPinId);
      lines.push([wire.netName, from?.symbol.name ?? wire.fromSymbolId, from?.pin.name ?? wire.fromPinId, to?.symbol.name ?? wire.toSymbolId, to?.pin.name ?? wire.toPinId].join(","));
    });
    downloadTextFile("schematic_netlist.csv", lines.join("\n"));
  }

  return (
    <section className="schematic-workspace canvas-shell">
      <div className="status-bar status-bar-strong">
        Schematic Workspace · Symbols: <strong>{symbols.length}</strong> · Wires: <strong>{wires.length}</strong> · Nets: <strong>{netNames.length}</strong>
      </div>
      <div className="pcb-help-strip compact-help">
        <span><strong>Schematic:</strong> Add symbol → connect pins → name net → Sync parts + nets. Re-sync updates existing PCB parts instead of duplicating them.</span>
      </div>

      <div className="schematic-toolbar">
        <button className="btn" onClick={() => addSymbol("resistor")}>+ Resistor</button>
        <button className="btn" onClick={() => addSymbol("capacitor")}>+ Capacitor</button>
        <button className="btn" onClick={() => addSymbol("led")}>+ LED/Diode</button>
        <button className="btn" onClick={() => addSymbol("ic")}>+ NE555 IC</button>
        <button className="btn" onClick={() => addSymbol("connector")}>+ Connector</button>
        <button className="btn" onClick={() => onSendNetsToPcb(netNames)}>Send nets to PCB</button>
        <button className="btn btn-primary" onClick={sendSymbolsToPcb}>Sync parts + nets to PCB</button>
        <button className="btn" onClick={exportNetlistCsv}>Export netlist CSV</button>
        <button className="btn" onClick={exportSchematicJson}>Export schematic JSON</button>
      </div>

      <div className="schematic-main">
        <svg
          className="schematic-svg"
          width="100%"
          height="580"
          viewBox="0 0 980 580"
          onMouseMove={(event) => {
            if (!draggingSymbolId) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 980;
            const y = ((event.clientY - rect.top) / rect.height) * 580;
            setSymbols((prev) => prev.map((symbol) => symbol.id === draggingSymbolId ? { ...symbol, x: x - mouseOffset.x, y: y - mouseOffset.y } : symbol));
          }}
          onMouseUp={() => setDraggingSymbolId(null)}
          onMouseLeave={() => setDraggingSymbolId(null)}
        >
          <defs>
            <pattern id="schematicGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--grid-line)" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="980" height="580" fill="url(#schematicGrid)" />

          {wires.map((wire) => {
            const from = getPin(symbols, wire.fromSymbolId, wire.fromPinId);
            const to = getPin(symbols, wire.toSymbolId, wire.toPinId);
            if (!from || !to) return null;
            return (
              <g key={wire.id}>
                <polyline
                  points={`${from.x},${from.y} ${(from.x + to.x) / 2},${from.y} ${(from.x + to.x) / 2},${to.y} ${to.x},${to.y}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
                <text x={(from.x + to.x) / 2 + 6} y={(from.y + to.y) / 2 - 6} className="schematic-net-label">{wire.netName}</text>
              </g>
            );
          })}

          {symbols.map((symbol) => (
            <SchematicSymbolView
              key={symbol.id}
              symbol={symbol}
              selected={symbol.id === selectedSymbolId}
              pendingPin={pendingPin}
              onSelect={() => setSelectedSymbolId(symbol.id)}
              onPinClick={connectPin}
              onDragStart={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (!rect) return;
                const x = ((event.clientX - rect.left) / rect.width) * 980;
                const y = ((event.clientY - rect.top) / rect.height) * 580;
                setMouseOffset({ x: x - symbol.x, y: y - symbol.y });
                setDraggingSymbolId(symbol.id);
                setSelectedSymbolId(symbol.id);
              }}
            />
          ))}
        </svg>

        <aside className="schematic-inspector panel">
          <h2 className="panel-title">Schematic inspector</h2>
          {selectedSymbol ? (
            <div className="stack">
              <label className="field-label">Name<input value={selectedSymbol.name} onChange={(event) => updateSelectedSymbol({ name: event.target.value })} /></label>
              <label className="field-label">Value<input value={selectedSymbol.value} onChange={(event) => updateSelectedSymbol({ value: event.target.value })} /></label>
              <div className="small-help muted">Pins: {selectedSymbol.pins.map((pin) => `${pin.id} ${pin.name}${pin.netName ? `=${pin.netName}` : ""}`).join(", ")}</div>
              <button className="btn btn-danger" onClick={deleteSelectedSymbol}>Delete symbol</button>
            </div>
          ) : (
            <p className="small-help muted">Select a symbol to edit name and value.</p>
          )}
          <hr />
          <h3 className="panel-title small">Nets</h3>
          <div className="stack compact-list">
            {netNames.length ? netNames.map((name) => <div key={name} className="row"><span>{name}</span><strong>net</strong></div>) : <p className="small-help muted">No nets yet.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SchematicSymbolView({
  symbol,
  selected,
  pendingPin,
  onSelect,
  onPinClick,
  onDragStart,
}: {
  symbol: SchematicSymbol;
  selected: boolean;
  pendingPin: PendingPin;
  onSelect: () => void;
  onPinClick: (symbolId: string, pinId: string) => void;
  onDragStart: (event: React.MouseEvent<SVGGElement>) => void;
}) {
  const width = symbol.type === "ic" ? 82 : symbol.type === "connector" ? 70 : 78;
  const height = symbol.type === "ic" ? 120 : symbol.type === "connector" ? 86 : 42;

  return (
    <g transform={`translate(${symbol.x},${symbol.y})`} onMouseDown={onDragStart} onClick={(event) => { event.stopPropagation(); onSelect(); }} style={{ cursor: "move" }}>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="8" className={selected ? "schematic-symbol selected" : "schematic-symbol"} />
      <text x="0" y="-4" textAnchor="middle" className="component-label">{symbol.name}</text>
      <text x="0" y="13" textAnchor="middle" className="component-value-label">{symbol.value}</text>
      {symbol.pins.map((pin) => {
        const active = pendingPin?.symbolId === symbol.id && pendingPin?.pinId === pin.id;
        const labelX = pin.x < 0 ? pin.x + 11 : pin.x - 11;
        const anchor = pin.x < 0 ? "start" : "end";
        return (
          <g key={pin.id} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPinClick(symbol.id, pin.id); }} style={{ cursor: "crosshair" }}>
            <circle cx={pin.x} cy={pin.y} r="6" className={active ? "schematic-pin active" : "schematic-pin"} />
            <text x={labelX} y={pin.y + 4} textAnchor={anchor} className="schematic-pin-label">{pin.name}</text>
          </g>
        );
      })}
    </g>
  );
}
