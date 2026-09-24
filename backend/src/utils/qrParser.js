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
      const pnr = parsed.pnr || parsed.PNR || (typeof parsed === "object" ? find10DigitPnr(JSON.stringify(parsed)) : null);
      return {
        qrType: "JSON",
        parsedData: parsed,
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
        journeyDate: dateMatch ? dateMatch[1] : null,
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

function find10DigitPnr(str) {
  const match = String(str).match(/\b([2-9]\d{9})\b/);
  return match ? match[1] : null;
}
