import { Cpu, Footprints, Lightbulb, Plug, Search, Zap, Power, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import type { Footprint, Tool } from "../model/pcb";
import { componentCatalog, componentCategories, type LibraryComponentTemplate } from "../library/componentCatalog";

type Props = {
  footprints: Footprint[];
  selectedFootprintId: string | null;
  selectedLibraryComponentId: string | null;
  setSelectedFootprintId: (id: string | null) => void;
  setSelectedLibraryComponentId: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  extraComponents?: LibraryComponentTemplate[];
};

function iconFor(category: string) {
  if (category === "Resistors") return <Zap size={16} />;
  if (category === "Capacitors") return <Power size={16} />;
  if (category === "Diodes") return <Lightbulb size={16} />;
  if (category === "Transistors") return <Radio size={16} />;
  if (category === "ICs") return <Cpu size={16} />;
  if (category === "Connectors") return <Plug size={16} />;
  if (category === "Power") return <Power size={16} />;
  return <Radio size={16} />;
}

export function ComponentLibrary({
  footprints,
  selectedFootprintId,
  selectedLibraryComponentId,
  setSelectedFootprintId,
  setSelectedLibraryComponentId,
  setTool,
  extraComponents = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string>("Resistors");
  const fullCatalog = useMemo(() => [...extraComponents, ...componentCatalog], [extraComponents]);
  const selectedTemplate = fullCatalog.find((item) => item.id === selectedLibraryComponentId) ?? null;

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fullCatalog;

    return fullCatalog.filter((item) =>
      [item.label, item.value, item.packageName, item.category, item.prefix, item.mpn, item.supplierSku, item.catalogCode, item.orderCode, item.marking]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [fullCatalog, query]);

  return (
    <section className="panel component-library-panel">
      <h2 className="panel-title">Component Library</h2>
      <p className="small-help muted">Katalog konkretnih delova: vrednost, proizvođač, MPN, oznaka i kućište. Izaberi deo, pa klikni na zelenu PCB ploču.</p>

      <label className="library-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search: 10Ω, 25µF, BC547, NE555, 1N4007..."
        />
      </label>

      {selectedTemplate && (
        <div className="catalog-selected-card">
          <div className="catalog-selected-title">Izabrana kataloška komponenta</div>
          <div className="catalog-main-line">
            <strong>{selectedTemplate.label}</strong>
            <span>{selectedTemplate.value}</span>
          </div>
          <div className="catalog-grid">
            <div><span>Package</span><strong>{selectedTemplate.packageName}</strong></div>
            <div><span>MPN</span><strong>{selectedTemplate.mpn ?? "—"}</strong></div>
            <div><span>Manufacturer</span><strong>{selectedTemplate.manufacturer ?? "—"}</strong></div>
            <div><span>Supplier</span><strong>{selectedTemplate.supplier ?? "—"}</strong></div>
            <div><span>Supplier SKU</span><strong>{selectedTemplate.supplierSku ?? "—"}</strong></div>
            <div><span>Catalog code</span><strong>{selectedTemplate.catalogCode ?? "—"}</strong></div>
            <div><span>Marking</span><strong>{selectedTemplate.marking ?? "—"}</strong></div>
            <div><span>Mount</span><strong>{selectedTemplate.mountType ?? "—"}</strong></div>
          </div>
          {selectedTemplate.description && <p className="catalog-description">{selectedTemplate.description}</p>}
          <p className="small-help"><strong>Sada klikni na zelenu PCB ploču</strong> da ubaciš ovu komponentu.</p>
        </div>
      )}

      <div className="library-categories">
        {componentCategories.map((category) => {
          const items = filteredCatalog.filter((item) => item.category === category);
          if (query && items.length === 0) return null;

          return (
            <div key={category} className="library-category">
              <button
                className="library-category-header"
                onClick={() => setOpenCategory(openCategory === category ? "" : category)}
              >
                <span>{iconFor(category)} {category}</span>
                <strong>{items.length}</strong>
              </button>

              {(openCategory === category || query) && (
                <div className="stack library-category-items">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedFootprintId(null);
                        setSelectedLibraryComponentId(item.id);
                        setTool("add-library-component");
                      }}
                      className={`library-button ${selectedLibraryComponentId === item.id ? "library-button-active" : ""}`}
                    >
                      {iconFor(item.category)}
                      <span>
                        {item.label}
                        <small>{item.value} · {item.packageName}</small>
                        <small className="catalog-line">MPN: {item.mpn ?? "—"}</small>
                        <small className="catalog-line">Code: {item.catalogCode ?? item.orderCode ?? "—"}</small>
                        <small className="catalog-line">Marking: {item.marking ?? "—"} · {item.pads.length} pads</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="library-section-title">Custom footprints</div>
      <div className="stack">
        {footprints.length === 0 ? (
          <p className="small-help muted">No custom footprints yet. Create one in Footprint Editor.</p>
        ) : (
          footprints.map((footprint) => (
            <button
              key={footprint.id}
              onClick={() => {
                setSelectedLibraryComponentId(null);
                setSelectedFootprintId(footprint.id);
                setTool("add-custom-footprint");
              }}
              className={`library-button ${selectedFootprintId === footprint.id ? "library-button-active" : ""}`}
            >
              <Footprints size={16} />
              <span>
                {footprint.name}
                <small>{footprint.pads.length} pads · {footprint.prefix}</small>
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
