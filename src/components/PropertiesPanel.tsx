import { Cpu } from "lucide-react";
import type { Net, PCBComponent } from "../model/pcb";

const emptyParams: Record<string, string> = {};

type Props = {
  selectedComponent: PCBComponent | null;
  nets: Net[];
  updateSelectedComponent: (patch: Partial<PCBComponent>) => void;
};

export function PropertiesPanel({ selectedComponent, nets, updateSelectedComponent }: Props) {
  const parameters = selectedComponent?.parameters ?? emptyParams;

  return (
    <section className="panel">
      <h2 className="panel-title"><Cpu size={18} /> Catalog component data</h2>
      {selectedComponent ? (
        <div className="stack">
          <div className="component-catalog-summary">
            <div>
              <span>Component</span>
              <strong>{selectedComponent.name} · {selectedComponent.value ?? "no value"}</strong>
            </div>
            <div>
              <span>Catalog</span>
              <strong>{selectedComponent.mpn ?? selectedComponent.catalogCode ?? "no catalog code"}</strong>
            </div>
            <div>
              <span>Marking</span>
              <strong>{selectedComponent.marking ?? "—"}</strong>
            </div>
          </div>

          <div className="param-card strong-card">
            <div className="param-title">PCB markings</div>
            <div className="form-grid compact-form">
              <Field label="Designator" value={selectedComponent.name} onChange={(value) => updateSelectedComponent({ name: value })} />
              <Field label="Value shown on board" value={selectedComponent.value ?? ""} placeholder="10kΩ, 100nF, NE555P..." onChange={(value) => updateSelectedComponent({ value })} />
              <Field label="Part marking / body text" value={selectedComponent.marking ?? ""} placeholder="104, 1N4148, NE555P..." onChange={(value) => updateSelectedComponent({ marking: value })} />
              <Field label="Package / footprint" value={selectedComponent.packageName ?? selectedComponent.footprintName ?? ""} placeholder="DIP-8, TO-220-3, R_Axial..." onChange={(value) => updateSelectedComponent({ packageName: value })} />
            </div>
          </div>

          <div className="param-card catalog-highlight">
            <div className="param-title">Catalog / ordering</div>
            <div className="form-grid compact-form">
              <Field label="Manufacturer" value={selectedComponent.manufacturer ?? ""} placeholder="Microchip, TI, Vishay..." onChange={(value) => updateSelectedComponent({ manufacturer: value })} />
              <Field label="MPN / manufacturer part number" value={selectedComponent.mpn ?? ""} placeholder="ATMEGA328P-PU, NE555P..." onChange={(value) => updateSelectedComponent({ mpn: value })} />
              <Field label="Supplier" value={selectedComponent.supplier ?? ""} placeholder="Mouser, DigiKey, TME, LCSC..." onChange={(value) => updateSelectedComponent({ supplier: value })} />
              <Field label="Supplier SKU" value={selectedComponent.supplierSku ?? ""} placeholder="supplier stock number" onChange={(value) => updateSelectedComponent({ supplierSku: value })} />
              <Field label="Catalog code" value={selectedComponent.catalogCode ?? ""} placeholder="internal/catalog code" onChange={(value) => updateSelectedComponent({ catalogCode: value })} />
              <Field label="Order code" value={selectedComponent.orderCode ?? ""} placeholder="your purchase/order code" onChange={(value) => updateSelectedComponent({ orderCode: value })} />
              <Field label="Series" value={selectedComponent.series ?? ""} placeholder="78xx, carbon film, AVR..." onChange={(value) => updateSelectedComponent({ series: value })} />
              <Field label="Mount type" value={selectedComponent.mountType ?? ""} placeholder="THT, SMD, Module..." onChange={(value) => updateSelectedComponent({ mountType: value })} />
            </div>
          </div>

          <div className="param-card">
            <div className="param-title">Electrical values</div>
            <div className="form-grid compact-form">
              <Field label="Tolerance" value={selectedComponent.tolerance ?? ""} placeholder="1%, 5%, 10%..." onChange={(value) => updateSelectedComponent({ tolerance: value })} />
              <Field label="Power" value={selectedComponent.powerRating ?? ""} placeholder="0.25W, 1W..." onChange={(value) => updateSelectedComponent({ powerRating: value })} />
              <Field label="Voltage" value={selectedComponent.voltageRating ?? ""} placeholder="5V, 16V, 50V..." onChange={(value) => updateSelectedComponent({ voltageRating: value })} />
              <Field label="Current" value={selectedComponent.currentRating ?? ""} placeholder="20mA, 1A..." onChange={(value) => updateSelectedComponent({ currentRating: value })} />
              <Field label="Datasheet URL" value={selectedComponent.datasheetUrl ?? ""} placeholder="https://..." onChange={(value) => updateSelectedComponent({ datasheetUrl: value })} />
            </div>
            <label className="textarea-field">
              Description
              <textarea
                value={selectedComponent.description ?? ""}
                placeholder="Catalog description / component note"
                onChange={(event) => updateSelectedComponent({ description: event.target.value })}
                rows={3}
              />
            </label>
          </div>

          <div className="param-card">
            <div className="param-title">Catalog parameters</div>
            {Object.keys(parameters).length === 0 ? (
              <p className="small-help muted">No catalog parameter table for this component.</p>
            ) : (
              <div className="param-table">
                {Object.entries(parameters).map(([key, value]) => (
                  <div className="param-table-row" key={key}>
                    <span>{key}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="param-card">
            <div className="param-title">Geometry</div>
            <Row label="Type" value={selectedComponent.type} />
            <Row label="Position" value={`${selectedComponent.x}, ${selectedComponent.y}`} />
            <Row label="Rotation" value={`${selectedComponent.rotation}°`} />
            <Row label="Pads" value={String(selectedComponent.pads.length)} />
          </div>

          <div className="param-card">
            <div className="param-title">Pads / nets</div>
            <div className="stack">
              {selectedComponent.pads.map((pad) => {
                const net = nets.find((n) => n.id === pad.netId);
                return (
                  <div key={pad.id} className="row pad-row">
                    <span className="muted">{pad.id.split("_").slice(-1)[0]} · {pad.pinName ?? "pin"}</span>
                    <strong>{net?.name ?? "unconnected"}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">Select a component from PCB board to see catalog values, markings, MPN, supplier SKU and order codes.</p>
      )}
    </section>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
