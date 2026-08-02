const monthNumbers: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const currencySymbols: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "CNY",
};

const supportedCurrencies = [
  "USD",
  "EUR",
  "GBP",
  "HKD",
  "CNY",
  "RMB",
  "JPY",
  "CAD",
  "AUD",
  "SGD",
  "THB",
];

const pad = (value: number) => String(value).padStart(2, "0");

const formatDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
};

export const normalizeDate = (rawValue: string): string | null => {
  const value = rawValue.trim();
  let match = value.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (match) {
    return formatDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = value.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (match) {
    return formatDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = value.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i,
  );
  if (match) {
    return formatDate(
      Number(match[3]),
      monthNumbers[match[1].toLowerCase()],
      Number(match[2]),
    );
  }

  match = value.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)[,]?\s+(20\d{2})\b/i,
  );
  if (match) {
    return formatDate(
      Number(match[3]),
      monthNumbers[match[2].toLowerCase()],
      Number(match[1]),
    );
  }

  return null;
};

const dateTokenPattern =
  /(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)[,]?\s+20\d{2})/gi;

export const normalizeDateRange = (
  rawValue: string,
): { startDate: string; endDate: string } | null => {
  const matches = [...rawValue.matchAll(dateTokenPattern)]
    .map((match) => normalizeDate(match[0]))
    .filter((value): value is string => Boolean(value));
  if (matches.length < 2) return null;
  return {
    startDate: matches[0],
    endDate: matches[1],
  };
};

export const normalizeMoney = (
  rawValue: string,
): { amount: number; currency: string } | null => {
  const currencyGroup = supportedCurrencies.join("|");
  let match = rawValue.match(
    new RegExp(
      `\\b(${currencyGroup})\\b\\s*[$€£¥]?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)`,
      "i",
    ),
  );
  if (match) {
    return {
      amount: Number(match[2].replaceAll(",", "")),
      currency: match[1].toUpperCase() === "RMB" ? "CNY" : match[1].toUpperCase(),
    };
  }

  match = rawValue.match(
    new RegExp(
      `([$€£¥]?)\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)\\s*\\b(${currencyGroup})\\b`,
      "i",
    ),
  );
  if (match) {
    return {
      amount: Number(match[2].replaceAll(",", "")),
      currency: match[3].toUpperCase() === "RMB" ? "CNY" : match[3].toUpperCase(),
    };
  }

  match = rawValue.match(/([$€£¥])\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
  if (!match) return null;
  return {
    amount: Number(match[2].replaceAll(",", "")),
    currency: currencySymbols[match[1]],
  };
};

export const normalizeDays = (rawValue: string): number | null => {
  const netMatch = rawValue.match(/\bNet\s*(\d{1,3})\b/i);
  if (netMatch) return Number(netMatch[1]);

  const englishMatch = rawValue.match(
    /\b(?:within\s+)?(\d{1,3})\s+(?:calendar\s+|business\s+)?days?\b/i,
  );
  if (englishMatch) return Number(englishMatch[1]);

  const chineseMatch = rawValue.match(/(?:收到|收悉)?[^。\n]{0,30}?(\d{1,3})\s*(?:个)?(?:自然|工作)?日(?:内|以内)?/);
  return chineseMatch ? Number(chineseMatch[1]) : null;
};

export const normalizePaymentMethod = (
  rawValue: string,
): "bank_transfer" | "paypal" | "airwallex" | null => {
  if (/PayPal/i.test(rawValue)) return "paypal";
  if (/Airwallex/i.test(rawValue)) return "airwallex";
  if (/bank\s*transfer|wire\s*transfer|银行转账|电汇/i.test(rawValue)) {
    return "bank_transfer";
  }
  return null;
};

export const normalizeTransferFee = (
  rawValue: string,
): "advertiser" | "publisher" | "shared" | null => {
  if (
    /borne\s+by\s+(?:the\s+)?(?:advertiser|client)|广告主承担|客户承担|付款方承担/i.test(
      rawValue,
    )
  ) {
    return "advertiser";
  }
  if (
    /borne\s+by\s+(?:the\s+)?(?:publisher|creator|beneficiary|recipient)|发布方承担|达人承担|创作者承担|收款方承担|收款人承担/i.test(
      rawValue,
    )
  ) {
    return "publisher";
  }
  if (/shared|split equally|双方各自承担|共同承担|各承担/i.test(rawValue)) {
    return "shared";
  }
  return null;
};

export const normalizedIdentity = (value: unknown): string => {
  if (typeof value === "string") {
    return value.normalize("NFKC").trim().toLocaleLowerCase();
  }
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    return JSON.stringify(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizedIdentity(item)]),
    );
  }
  return "";
};
