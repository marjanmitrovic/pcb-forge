import { useState } from "react";
import { SupplierSearchLinks } from "./SupplierSearchLinks";

export function SupplierSearchPanel() {
  const [query, setQuery] = useState("");

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Supplier Search</h2>
      </div>

      <div className="stack">
        <label className="field-label">
          Part number
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="NE555, ATmega328P, 10k resistor..."
          />
        </label>

        <SupplierSearchLinks query={query} />
      </div>
    </section>
  );
}
