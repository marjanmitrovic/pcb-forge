import { Footprints, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Footprint, Tool } from "../model/pcb";
import { footprintCategories, predefinedFootprints, type PredefinedFootprint } from "../library/footprintLibrary";

type Props = {
  savedFootprints: Footprint[];
  selectedFootprintId: string | null;
  addFootprint: (footprint: Footprint) => void;
  setSelectedFootprintId: (id: string | null) => void;
  setTool: (tool: Tool) => void;
};

function cloneFootprint(footprint: PredefinedFootprint): Footprint {
  return {
    id: footprint.id,
    name: footprint.name,
    prefix: footprint.prefix,
    bodyWidth: footprint.bodyWidth,
    bodyHeight: footprint.bodyHeight,
    pads: footprint.pads.map((pad) => ({ ...pad })),
  };
}

export function FootprintLibraryPanel({
  savedFootprints,
  selectedFootprintId,
  addFootprint,
  setSelectedFootprintId,
  setTool,
}: Props) {
  const [query, setQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string>("Passives SMD");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return predefinedFootprints;

    return predefinedFootprints.filter((footprint) =>
      [footprint.name, footprint.prefix, footprint.category, footprint.description, footprint.pitch, footprint.mountType]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  function useFootprint(footprint: PredefinedFootprint) {
    const exists = savedFootprints.some((item) => item.id === footprint.id);

    if (!exists) {
      addFootprint(cloneFootprint(footprint));
    }

    setSelectedFootprintId(footprint.id);
    setTool("add-custom-footprint");
  }

  return (
    <section className="panel component-library-panel">
      <h2 className="panel-title">
        <Footprints size={18} /> Real Footprint Library
      </h2>
      <p className="small-help muted">
        Gotovi footprinti sa realnim dimenzijama i padovima: 0603, 0805, DIP, SOIC, SOT-23, TO-92, TO-220, terminal block, pin header i moduli.
      </p>

      <label className="library-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search footprint: 0805, DIP-8, SOIC, TO-92, terminal..."
        />
      </label>

      <div className="library-categories">
        {footprintCategories.map((category) => {
          const items = filtered.filter((item) => item.category === category);
          if (query && items.length === 0) return null;

          return (
            <div key={category} className="library-category">
              <button
                className="library-category-header"
                onClick={() => setOpenCategory(openCategory === category ? "" : category)}
              >
                <span><Footprints size={16} /> {category}</span>
                <strong>{items.length}</strong>
              </button>

              {(openCategory === category || query) && (
                <div className="stack library-category-items">
                  {items.map((footprint) => {
                    const saved = savedFootprints.some((item) => item.id === footprint.id);
                    const active = selectedFootprintId === footprint.id;

                    return (
                      <button
                        key={footprint.id}
                        onClick={() => useFootprint(footprint)}
                        className={`library-button ${active ? "library-button-active" : ""}`}
                      >
                        <Footprints size={16} />
                        <span>
                          {footprint.name}
                          <small>{footprint.mountType} · {footprint.pads.length} pads · {footprint.prefix}</small>
                          <small className="catalog-line">{footprint.description}</small>
                          <small className="catalog-line">Pitch: {footprint.pitch ?? "—"} · Body: {(footprint.bodyWidth / 10).toFixed(1)}×{(footprint.bodyHeight / 10).toFixed(1)} mm</small>
                          <small className="catalog-line">{saved ? "Saved in project library" : "Click to add and place on PCB"}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
