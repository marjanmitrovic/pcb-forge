const offlineParts = [
  {
    mpn: "NE555P",
    description: "Texas Instruments NE555 precision timer, PDIP-8, THT",
    totalAvail: 1315735,
  },
  {
    mpn: "NE555DR",
    description: "Texas Instruments NE555 precision timer, SOIC-8, SMD",
    totalAvail: 5695221,
  },
  {
    mpn: "LM358P",
    description: "Texas Instruments LM358 dual op-amp, PDIP-8",
    totalAvail: 800000,
  },
  {
    mpn: "BC547B",
    description: "NPN bipolar transistor, TO-92, C-B-E pinout",
    totalAvail: 500000,
  },
  {
    mpn: "1N4007",
    description: "Rectifier diode, DO-41, 1000V",
    totalAvail: 1500000,
  },
  {
    mpn: "L7805CV",
    description: "ST linear voltage regulator 5V, TO-220-3, IN-GND-OUT",
    totalAvail: 300000,
  },
];

function offlineSearch(q) {
  const clean = String(q || "").trim().toLowerCase();

  const found = offlineParts.filter((part) =>
    `${part.mpn} ${part.description}`.toLowerCase().includes(clean)
  );

  return found.length
    ? found
    : [
        {
          mpn: String(q || "UNKNOWN").toUpperCase(),
          description: "Offline catalog placeholder result.",
          totalAvail: 0,
        },
      ];
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { q, limit = 5 } = req.body || {};

    if (!q) {
      res.status(400).json({ error: "Missing search query." });
      return;
    }

    const provider = process.env.CATALOG_PROVIDER || "offline";

    // Za sada siguran offline fallback.
    // Mouser se kasnije dodaje ovde preko process.env.MOUSER_API_KEY.
    const results = offlineSearch(q).slice(0, Number(limit || 5));

    res.status(200).json({
      results,
      provider,
      mode: "offline-vercel",
    });
  } catch (error) {
    res.status(200).json({
      results: offlineSearch("NE555"),
      warning: "Recovered with offline catalog.",
      details: String(error),
    });
  }
}
const offlineParts = [
  { mpn: "NE555P", manufacturer: "Texas Instruments", description: "NE555 precision timer, PDIP-8, THT", totalAvail: 1315735, supplier: "Offline catalog" },
  { mpn: "NE555DR", manufacturer: "Texas Instruments", description: "NE555 precision timer, SOIC-8, SMD", totalAvail: 5695221, supplier: "Offline catalog" },
  { mpn: "BC547B", manufacturer: "onsemi", description: "NPN bipolar transistor, TO-92", totalAvail: 500000, supplier: "Offline catalog" },
  { mpn: "1N4007", manufacturer: "Vishay", description: "Rectifier diode, DO-41, 1000V", totalAvail: 1500000, supplier: "Offline catalog" },
  { mpn: "L7805CV", manufacturer: "STMicroelectronics", description: "5V linear voltage regulator, TO-220-3", totalAvail: 300000, supplier: "Offline catalog" }
];

function offlineSearch(q) {
  const clean = String(q || "").trim().toLowerCase();
  const results = offlineParts.filter((part) =>
    `${part.mpn} ${part.manufacturer} ${part.description}`.toLowerCase().includes(clean)
  );

  return results.length
    ? results
    : [{ mpn: String(q || "UNKNOWN").toUpperCase(), manufacturer: "Generic", description: "Offline catalog placeholder result.", totalAvail: 0, supplier: "Offline catalog" }];
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { q, limit = 10 } = req.body || {};

    if (!q) {
      res.status(400).json({ error: "Missing search query." });
      return;
    }

    res.status(200).json({
      results: offlineSearch(q).slice(0, Number(limit || 10)),
      provider: "offline",
      mode: "vercel-offline"
    });
  } catch (error) {
    res.status(200).json({
      results: offlineSearch("NE555"),
      warning: "Recovered with offline catalog.",
      details: String(error)
    });
  }
}
