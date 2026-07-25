import { ExternalLink } from "lucide-react";
import { createSupplierLinks } from "../utils/supplierLinks";

type Props = {
  query: string;
};

export function SupplierSearchLinks({ query }: Props) {
  const links = createSupplierLinks(query);

  if (!query.trim()) {
    return (
      <p className="muted small-help">
        Enter a part number to search supplier websites.
      </p>
    );
  }

  return (
    <div className="stack">
      <p className="muted small-help">
        Search this component on supplier websites. Orders are completed directly on the supplier website.
      </p>

      <div className="grid-2">
        {links.map((link) => (
          <button
            key={link.id}
            className="btn"
            onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink size={15} />
            {link.name}
          </button>
        ))}
      </div>
    </div>
  );
}
