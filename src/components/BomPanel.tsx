import { ClipboardList, Download } from "lucide-react";
import type { PCBComponent } from "../model/pcb";

type BomRow = {
  key: string;
  qty: number;
  refs: string[];
  value: string;
  packageName: string;
  manufacturer: string;
  mpn: string;
  supplier: string;
  supplierSku: string;
  totalAvailability: number | "";
  description: string;
};

type Props = {
  components: PCBComponent[];
};

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function makeKey(component: PCBComponent) {
  return [
    component.mpn || component.manufacturerPartNumber || "",
    component.value || "",
    component.packageName || component.footprintName || "",
    component.type,
  ].join("|");
}

function buildBomRows(components: PCBComponent[]): BomRow[] {
  const map = new Map<string, BomRow>();

  components.forEach((component) => {
    const key = makeKey(component);
    const existing = map.get(key);

    if (existing) {
      existing.qty += 1;
      existing.refs.push(component.name);
      return;
    }

    map.set(key, {
      key,
      qty: 1,
      refs: [component.name],
      value: component.value || "",
      packageName: component.packageName || component.footprintName || "",
      manufacturer: component.manufacturer || "",
      mpn: component.mpn || component.manufacturerPartNumber || "",
      supplier: component.supplier || "",
      supplierSku: component.supplierSku || "",
      totalAvailability: component.totalAvailability ?? "",
      description: component.description || component.catalogDescription || "",
    });
  });

  return Array.from(map.values()).sort((a, b) => a.refs[0].localeCompare(b.refs[0]));
}

function makeBomCsv(rows: BomRow[]) {
  const header = [
    "Qty",
    "Refs",
    "Value",
    "Package",
    "Manufacturer",
    "MPN",
    "Supplier",
    "Supplier SKU",
    "Total availability",
    "Description",
  ];

  const body = rows.map((row) => [
    row.qty,
    row.refs.join(" "),
    row.value,
    row.packageName,
    row.manufacturer,
    row.mpn,
    row.supplier,
    row.supplierSku,
    row.totalAvailability,
    row.description,
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

export function BomPanel({ components }: Props) {
  const rows = buildBomRows(components);
  const totalParts = rows.reduce((sum, row) => sum + row.qty, 0);
  const catalogRows = rows.filter((row) => row.mpn || row.supplierSku).length;

  function exportBom() {
    downloadTextFile("bom_grouped_catalog.csv", makeBomCsv(rows));
  }

  return (
    <section className="panel bom-panel">
      <h2 className="panel-title"><ClipboardList size={18} /> BOM / Ordering list</h2>
      <p className="small-help muted">Grouped bill of materials. Same value + package + MPN are combined into one order row.</p>

      <div className="bom-stats">
        <div><span>Unique rows</span><strong>{rows.length}</strong></div>
        <div><span>Total parts</span><strong>{totalParts}</strong></div>
        <div><span>Catalog rows</span><strong>{catalogRows}</strong></div>
      </div>

      <button className="full-btn primary-btn" onClick={exportBom} disabled={rows.length === 0}>
        <Download size={16} /> Export grouped BOM CSV
      </button>

      {rows.length === 0 ? (
        <p className="small-help muted">No components on the PCB yet.</p>
      ) : (
        <div className="bom-table">
          {rows.map((row) => (
            <div className="bom-row" key={row.key}>
              <div className="bom-row-top">
                <strong>{row.refs.join(", ")}</strong>
                <span>Qty {row.qty}</span>
              </div>
              <div className="bom-row-grid">
                <div><span>Value</span><strong>{row.value || "—"}</strong></div>
                <div><span>Package</span><strong>{row.packageName || "—"}</strong></div>
                <div><span>MPN</span><strong>{row.mpn || "—"}</strong></div>
                <div><span>Supplier SKU</span><strong>{row.supplierSku || "—"}</strong></div>
                <div><span>Supplier</span><strong>{row.supplier || "—"}</strong></div>
                <div><span>Availability</span><strong>{row.totalAvailability || "—"}</strong></div>
              </div>
              {row.description && <p>{row.description}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
