import { useState } from "react";
import { Database, Plus, Search } from "lucide-react";

type CatalogProvider = "auto" | "mouser" | "nexar" | "offline";

type LiveCatalogResult = {
  mpn: string;
  manufacturer?: string;
  description: string;
  totalAvail: number;
  availability?: string;
  mouserPartNumber?: string;
  supplier?: string;
  supplierSku?: string;
  datasheetUrl?: string;
  productUrl?: string;
  category?: string;
  lifecycleStatus?: string;
  leadTime?: string;
  price?: string;
  source?: string;
};

type Props = {
  onAddCatalogPart: (part: LiveCatalogResult) => void;
  onAddToLocalLibrary: (part: LiveCatalogResult) => void;
};

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function LiveCatalogSearch({ onAddCatalogPart, onAddToLocalLibrary }: Props) {
  const [query, setQuery] = useState("NE555");
  const [country, setCountry] = useState("CZ");
  const [provider, setProvider] = useState<CatalogProvider>("auto");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LiveCatalogResult[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeProvider, setActiveProvider] = useState("");

  async function search() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setNotice("");
    setActiveProvider("");

    try {
     const apiUrl =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5174/api/catalog/search"
    : "/api/catalog-search";

const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, country, limit: 10, provider }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Search failed.");
        setResults([]);
        return;
      }

      setActiveProvider(data.provider || "");
      if (data.warning) setNotice(data.warning);

      setResults(
        (data.results ?? []).map((item: LiveCatalogResult) => ({
          ...item,
          description: stripHtml(item.description || ""),
        }))
      );
    } catch {
      setError("Cannot connect to local catalog API. Run: npm run server");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel catalog-live-panel">
      <h2 className="panel-title"><Database size={18} /> Live Catalog Search</h2>
      <p className="small-help">Search Mouser/Nexar data when configured. If an API key is missing or limited, PCB Forge uses the offline catalog automatically.</p>

      <div className="form-grid compact-form">
        <label>
          MPN search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") search();
            }}
            placeholder="NE555, BC547B, 1N4007, ACS770..."
          />
        </label>
        <label>
          Country
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            placeholder="CZ, US, DE..."
          />
        </label>
        <label>
          Provider
          <select value={provider} onChange={(event) => setProvider(event.target.value as CatalogProvider)}>
            <option value="auto">Auto</option>
            <option value="mouser">Mouser</option>
            <option value="nexar">Nexar</option>
            <option value="offline">Offline</option>
          </select>
        </label>
      </div>

      <button className="full-btn primary-btn" onClick={search} disabled={loading}>
        <Search size={16} /> {loading ? "Searching..." : "Search catalog"}
      </button>

      {activeProvider && <div className="notice">Provider: {activeProvider}</div>}
      {notice && <div className="notice warning-notice">{notice}</div>}
      {error && <div className="notice error-notice">{error}</div>}

      <div className="catalog-result-list">
        {results.map((part, index) => (
          <div className="catalog-result-card" key={`${part.mpn}-${index}`}>
            <div className="catalog-result-header">
              <strong>{part.mpn}</strong>
              <div className="catalog-actions">
                <button className="small-action-btn" onClick={() => onAddCatalogPart(part)}>
                  <Plus size={14} /> Place once
                </button>
                <button className="small-action-btn secondary-action-btn" onClick={() => onAddToLocalLibrary(part)}>
                  <Plus size={14} /> Add to library
                </button>
              </div>
            </div>
            <p>{part.description || "No description"}</p>
            <span>Total availability: {part.totalAvail}</span>
            {part.manufacturer && <span>Manufacturer: {part.manufacturer}</span>}
            {part.mouserPartNumber && <span>Mouser PN: {part.mouserPartNumber}</span>}
            {part.availability && <span>Stock: {part.availability}</span>}
            {part.price && <span>Price: {part.price}</span>}
            {part.datasheetUrl && (
              <a href={part.datasheetUrl} target="_blank" rel="noreferrer">Datasheet</a>
            )}
            {part.productUrl && (
              <a href={part.productUrl} target="_blank" rel="noreferrer">Product page</a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
