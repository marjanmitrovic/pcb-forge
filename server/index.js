import http from "node:http";
import { readFileSync, existsSync } from "node:fs";

const PORT = Number(process.env.PORT || 5174);

const NEXAR_GRAPHQL_URL = process.env.NEXAR_API_URL || "https://api.nexar.com/graphql";
const NEXAR_TOKEN_URL = process.env.NEXAR_TOKEN_URL || "https://identity.nexar.com/connect/token";

const MOUSER_SEARCH_URL =
  process.env.MOUSER_SEARCH_URL || "https://api.mouser.com/api/v1.0/search/keyword";

function loadDotEnv() {
  const path = new URL("../.env", import.meta.url);
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

loadDotEnv();

let cachedNexarToken = process.env.NEXAR_TOKEN || "";
let cachedNexarTokenExpiresAt = 0;

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}

function toNumberFromAvailability(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const match = String(value).replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function offlineCatalog(q) {
  const clean = String(q || "NE555").trim().toUpperCase();

  const database = [
    {
      mpn: "NE555P",
      manufacturer: "Texas Instruments",
      description: "NE555 precision timer, PDIP-8, THT",
      totalAvail: 1315735,
      packageName: "DIP-8",
      source: "offline",
    },
    {
      mpn: "NE555DR",
      manufacturer: "Texas Instruments",
      description: "NE555 precision timer, SOIC-8, SMD, tape and reel",
      totalAvail: 5695221,
      packageName: "SOIC-8",
      source: "offline",
    },
    {
      mpn: "NE555D",
      manufacturer: "STMicroelectronics",
      description: "NE555D bipolar timer, SOIC-8",
      totalAvail: 2340810,
      packageName: "SOIC-8",
      source: "offline",
    },
    {
      mpn: "LM358P",
      manufacturer: "Texas Instruments",
      description: "LM358 dual operational amplifier, PDIP-8",
      totalAvail: 800000,
      packageName: "DIP-8",
      source: "offline",
    },
    {
      mpn: "BC547B",
      manufacturer: "onsemi / generic",
      description: "NPN bipolar transistor, TO-92, C-B-E pinout",
      totalAvail: 500000,
      packageName: "TO-92",
      source: "offline",
    },
    {
      mpn: "2N3904",
      manufacturer: "onsemi / generic",
      description: "NPN switching transistor, TO-92",
      totalAvail: 900000,
      packageName: "TO-92",
      source: "offline",
    },
    {
      mpn: "2N3906",
      manufacturer: "onsemi / generic",
      description: "PNP switching transistor, TO-92",
      totalAvail: 600000,
      packageName: "TO-92",
      source: "offline",
    },
    {
      mpn: "IRFZ44N",
      manufacturer: "Infineon / Vishay / generic",
      description: "N-channel MOSFET, TO-220-3, G-D-S",
      totalAvail: 200000,
      packageName: "TO-220-3",
      source: "offline",
    },
    {
      mpn: "1N4007",
      manufacturer: "Vishay / Diodes Inc / generic",
      description: "Rectifier diode, DO-41, 1000 V",
      totalAvail: 1500000,
      packageName: "DO-41",
      source: "offline",
    },
    {
      mpn: "1N4148",
      manufacturer: "Vishay / Diodes Inc / generic",
      description: "Small signal switching diode, DO-35",
      totalAvail: 1200000,
      packageName: "DO-35",
      source: "offline",
    },
    {
      mpn: "L7805CV",
      manufacturer: "STMicroelectronics",
      description: "Linear voltage regulator 5 V, TO-220-3, IN-GND-OUT",
      totalAvail: 300000,
      packageName: "TO-220-3",
      source: "offline",
    },
    {
      mpn: "ATMEGA328P-PU",
      manufacturer: "Microchip",
      description: "ATmega328P microcontroller, DIP-28",
      totalAvail: 90000,
      packageName: "DIP-28",
      source: "offline",
    },
  ];

  const results = database.filter((part) => {
    const haystack = `${part.mpn} ${part.manufacturer} ${part.description}`.toLowerCase();
    return haystack.includes(clean.toLowerCase());
  });

  if (results.length > 0) return results;

  return [
    {
      mpn: clean,
      manufacturer: "Offline catalog",
      description: `Offline placeholder for ${clean}. Add MOUSER_API_KEY for live Mouser data.`,
      totalAvail: 0,
      source: "offline",
    },
    {
      mpn: `${clean}-DIP`,
      manufacturer: "Offline catalog",
      description: `${clean} generic DIP/THT package placeholder.`,
      totalAvail: 0,
      packageName: "DIP / THT",
      source: "offline",
    },
    {
      mpn: `${clean}-SMD`,
      manufacturer: "Offline catalog",
      description: `${clean} generic SMD/SOIC package placeholder.`,
      totalAvail: 0,
      packageName: "SMD / SOIC",
      source: "offline",
    },
  ];
}

function normalizeMouserPart(part) {
  const priceBreaks = Array.isArray(part.PriceBreaks) ? part.PriceBreaks : [];
  const firstPrice = priceBreaks[0]?.Price || "";

  return {
    mpn: part.ManufacturerPartNumber || part.MouserPartNumber || "",
    manufacturer: part.Manufacturer || "",
    description: stripHtml(part.Description || part.ProductDescription || ""),
    totalAvail: toNumberFromAvailability(part.Availability),
    availability: part.Availability || "",
    mouserPartNumber: part.MouserPartNumber || "",
    supplier: "Mouser",
    supplierSku: part.MouserPartNumber || "",
    datasheetUrl: part.DataSheetUrl || "",
    productUrl: part.ProductDetailUrl || "",
    category: part.Category || "",
    lifecycleStatus: part.LifecycleStatus || "",
    leadTime: part.LeadTime || "",
    price: firstPrice,
    source: "mouser",
  };
}

async function searchMouser(q, limit) {
  const apiKey = process.env.MOUSER_API_KEY;

  if (!apiKey) {
    return {
      results: offlineCatalog(q),
      provider: "offline",
      warning: "MOUSER_API_KEY is missing. Offline catalog used.",
    };
  }

  const url = `${MOUSER_SEARCH_URL}?apiKey=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    SearchByKeywordRequest: {
      keyword: q,
      records: Math.min(50, Math.max(1, Number(limit || 10))),
      startingRecord: 0,
      searchOptions: "None",
      searchWithYourSignUpLanguage: "false",
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    const errors = data.Errors || data.SearchResults?.Errors || data.errors;
    if (!response.ok || (Array.isArray(errors) && errors.length > 0)) {
      console.error("Mouser API error:", JSON.stringify(errors || data, null, 2));
      return {
        results: offlineCatalog(q),
        provider: "offline-fallback",
        warning: "Mouser API error. Offline catalog used.",
        details: errors || data,
      };
    }

    const parts = data.SearchResults?.Parts || data.Parts || [];
    const results = parts.map(normalizeMouserPart).filter((item) => item.mpn);

    return {
      results: results.length > 0 ? results : offlineCatalog(q),
      provider: results.length > 0 ? "mouser" : "offline-fallback",
      warning: results.length > 0 ? "" : "No Mouser matches. Offline catalog used.",
      rawCount: data.SearchResults?.NumberOfResult ?? results.length,
    };
  } catch (error) {
    console.error("Mouser fetch failed:", error);
    return {
      results: offlineCatalog(q),
      provider: "offline-fallback",
      warning: "Mouser request failed. Offline catalog used.",
      details: String(error),
    };
  }
}

async function getNexarToken() {
  if (cachedNexarToken && Date.now() < cachedNexarTokenExpiresAt) return cachedNexarToken;
  if (process.env.NEXAR_TOKEN) return process.env.NEXAR_TOKEN;

  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) return "";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: process.env.NEXAR_SCOPE || "supply.domain",
  });

  const response = await fetch(NEXAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Nexar token error: ${JSON.stringify(data)}`);
  }

  cachedNexarToken = data.access_token;
  cachedNexarTokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  return cachedNexarToken;
}

async function searchNexar(q, country, limit) {
  const token = await getNexarToken();
  if (!token) {
    return {
      results: offlineCatalog(q),
      provider: "offline",
      warning: "Nexar token missing. Offline catalog used.",
    };
  }

  const query = `
    query SearchMpn($q: String!, $country: String!, $limit: Int!) {
      supSearchMpn(q: $q, country: $country, limit: $limit) {
        results {
          description
          part {
            mpn
            totalAvail
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(NEXAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: { q, country, limit } }),
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
      console.error("Nexar API error:", JSON.stringify(data.errors || data, null, 2));
      return {
        results: offlineCatalog(q),
        provider: "offline-fallback",
        warning: "Nexar API unavailable or plan limit exceeded. Offline catalog used.",
        details: data.errors || data,
      };
    }

    const results = (data.data?.supSearchMpn?.results ?? []).map((item) => ({
      mpn: item.part?.mpn ?? "",
      manufacturer: "",
      description: stripHtml(item.description ?? ""),
      totalAvail: item.part?.totalAvail ?? 0,
      supplier: "Nexar / Octopart",
      supplierSku: item.part?.mpn ?? "",
      source: "nexar",
    }));

    return {
      results: results.length > 0 ? results : offlineCatalog(q),
      provider: results.length > 0 ? "nexar" : "offline-fallback",
      warning: results.length > 0 ? "" : "No Nexar matches. Offline catalog used.",
    };
  } catch (error) {
    console.error("Nexar fetch failed:", error);
    return {
      results: offlineCatalog(q),
      provider: "offline-fallback",
      warning: "Nexar request failed. Offline catalog used.",
      details: String(error),
    };
  }
}

async function searchCatalog(q, country, limit, requestedProvider) {
  const provider = String(requestedProvider || process.env.CATALOG_PROVIDER || "auto").toLowerCase();

  if (provider === "offline") {
    return { results: offlineCatalog(q), provider: "offline" };
  }

  if (provider === "mouser") return searchMouser(q, limit);
  if (provider === "nexar") return searchNexar(q, country, limit);

  // auto mode: prefer Mouser, then Nexar, then offline.
  if (process.env.MOUSER_API_KEY) return searchMouser(q, limit);
  if (process.env.NEXAR_TOKEN || (process.env.NEXAR_CLIENT_ID && process.env.NEXAR_CLIENT_SECRET)) {
    return searchNexar(q, country, limit);
  }

  return {
    results: offlineCatalog(q),
    provider: "offline",
    warning: "No online catalog key configured. Offline catalog used.",
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return sendJson(res, 200, {});

    if (req.method === "GET" && (req.url === "/api/health" || req.url === "/health")) {
      return sendJson(res, 200, {
        ok: true,
        catalogProvider: process.env.CATALOG_PROVIDER || "auto",
        hasMouserKey: Boolean(process.env.MOUSER_API_KEY),
        hasNexarToken: Boolean(process.env.NEXAR_TOKEN || process.env.NEXAR_CLIENT_ID),
      });
    }

    if (req.method === "POST" && req.url === "/api/catalog/search") {
      const body = await readJsonBody(req);
      const q = String(body.q || "").trim();
      const country = String(body.country || process.env.NEXAR_COUNTRY || "CZ").trim().toUpperCase();
      const limit = Math.min(50, Math.max(1, Number(body.limit || 10)));
      const provider = String(body.provider || process.env.CATALOG_PROVIDER || "auto").trim().toLowerCase();

      if (!q) return sendJson(res, 400, { error: "Missing search query." });

      const result = await searchCatalog(q, country, limit, provider);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    console.error("Local server error:", error);
    return sendJson(res, 200, {
      results: offlineCatalog("NE555"),
      provider: "offline-recovery",
      warning: "Local server recovered with offline catalog.",
      details: String(error),
    });
  }
});

server.on("error", (error) => {
  console.error("Server failed:", error);
});

server.listen(PORT, () => {
  console.log(`PCB Forge Catalog API running on http://localhost:${PORT}`);
});
