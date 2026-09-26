/**
 * Parses raw decoded QR string into structured metadata
 * Supports Railway Tickets (PNR), UPI Payments, JSON, URLs, and General Text
 */
export function parseQrData(rawText = "") {
  const text = String(rawText).trim();
  if (!text) {
    return { qrType: "TEXT", parsedData: {}, pnr: null };
  }

  // 1. Check for JSON
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      const parsed = JSON.parse(text);
      const pnr = parsed?.pnr || parsed?.PNR || (typeof parsed === "object" ? find10DigitPnr(JSON.stringify(parsed)) : null);
      return {
        qrType: "JSON",
        parsedData: enrichRailwayData(parsed, pnr),
        pnr: pnr ? String(pnr) : null
      };
    } catch {
      // not valid JSON, continue
    }
  }

  // 2. Check for UPI Payment QR
  if (text.startsWith("upi://pay")) {
    try {
      const url = new URL(text);
      const params = Object.fromEntries(url.searchParams.entries());
      return {
        qrType: "UPI_PAYMENT",
        parsedData: {
          payeeVpa: params.pa || "",
          payeeName: params.pn || "",
          amount: params.am ? Number(params.am) : null,
          currency: params.cu || "INR",
          transactionNote: params.tn || "",
          merchantCode: params.mc || ""
        },
        pnr: null
      };
    } catch {
      // fallback
    }
  }

  // 3. Check for Railway Ticket QR or PNR inside text
  const pnrMatch = text.match(/\b([2-9]\d{9})\b/);
  const isRailway =
    Boolean(pnrMatch) ||
    /IRCTC|CRIS|INDIAN RAILWAYS|TRAIN|JOURNEY|UTS|BERTH|COACH/i.test(text);

  if (isRailway) {
    const pnr = pnrMatch ? pnrMatch[1] : null;
    const trainMatch = text.match(/\b(\d{5})\b/);
    const dateMatch = text.match(/\b(\d{2}[-/.]\d{2}[-/.]\d{2,4})\b/);

    return {
      qrType: "RAILWAY_TICKET",
      parsedData: {
        pnr,
        trainNumber: trainMatch ? trainMatch[1] : null,
        trainName: extractField(text, [/train\\s*name\\s*[:=-]\\s*([^\\n|;,]+)/i]),
        journeyDate: dateMatch ? dateMatch[1] : null,
        fromStation: extractField(text, [/(?:from|source|boarding)\\s*[:=-]\\s*([^\\n|;,]+?)(?:\\s+to\\s+|\\s+->\\s+|\\s+→\\s+)/i]),
        toStation: extractField(text, [/(?:to|destination)\\s*[:=-]\\s*([^\\n|;,]+)/i]),
        travelClass: extractField(text, [/(?:class|travel\\s*class)\\s*[:=-]\\s*([A-Z0-9 -]{1,20})/i]),
        passengerCount: extractNumber(text, [/(?:passengers?|pax|adult(?:s)?)\\s*[:=-]\\s*(\\d{1,2})/i]),
        detailsText: text
      },
      pnr
    };
  }

  // 4. Check for URL
  if (text.startsWith("http://") || text.startsWith("https://")) {
    const pnr = find10DigitPnr(text);
    return {
      qrType: "URL",
      parsedData: { url: text },
      pnr
    };
  }

  // 5. Default General Text
  const pnr = find10DigitPnr(text);
  return {
    qrType: "TEXT",
    parsedData: { text },
    pnr
  };
}

function enrichRailwayData(value, pnr) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const copy = { ...value };
  copy.pnr = copy.pnr || copy.PNR || pnr || null;
  copy.trainNumber = copy.trainNumber || copy.trainNo || copy.train_number || copy.train?.number || null;
  copy.trainName = copy.trainName || copy.train_name || copy.train?.name || null;
  copy.journeyDate = copy.journeyDate || copy.dateOfJourney || copy.journey?.dateOfJourney || copy.journey?.date || null;
  copy.fromStation = copy.fromStation || copy.sourceName || copy.source?.name || copy.journey?.source?.name || null;
  copy.toStation = copy.toStation || copy.destinationName || copy.destination?.name || copy.journey?.destination?.name || null;
  copy.travelClass = copy.travelClass || copy.class || copy.journey?.class || null;
  copy.passengerCount = copy.passengerCount || (Array.isArray(copy.passengers) ? copy.passengers.length : null);
  copy.journeyDateISO = toISODate(copy.journeyDate);
  return copy;
}

function extractField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractNumber(text, patterns) {
  const value = extractField(text, patterns);
  return value ? Number(value) : null;
}

function toISODate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? "20" + match[3] : match[3];
  return year + "-" + month + "-" + day;
}

function find10DigitPnr(str) {
  const match = String(str).match(/\b([2-9]\d{9})\b/);
  return match ? match[1] : null;
}
