export type SupplierId =
  | "mouser"
  | "digikey"
  | "tme"
  | "farnell"
  | "lcsc"
  | "google";

export type SupplierLink = {
  id: SupplierId;
  name: string;
  url: string;
};

function encodeSearch(value: string) {
  return encodeURIComponent(value.trim());
}

export function createSupplierLinks(query: string): SupplierLink[] {
  const q = encodeSearch(query);

  return [
    {
      id: "mouser",
      name: "Mouser",
      url: `https://www.mouser.com/c/?q=${q}`,
    },
    {
      id: "digikey",
      name: "DigiKey",
      url: `https://www.digikey.com/en/products?keywords=${q}`,
    },
    {
      id: "tme",
      name: "TME",
      url: `https://www.tme.eu/en/katalog/?search=${q}`,
    },
    {
      id: "farnell",
      name: "Farnell",
      url: `https://uk.farnell.com/search?st=${q}`,
    },
    {
      id: "lcsc",
      name: "LCSC",
      url: `https://www.lcsc.com/search?q=${q}`,
    },
    {
      id: "google",
      name: "Google Datasheet",
      url: `https://www.google.com/search?q=${q}+datasheet`,
    },
  ];
}
