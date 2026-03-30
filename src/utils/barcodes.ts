export type RenderableBarcode = {
  format: "EAN13" | "EAN8" | "CODE128";
  value: string;
};

/**
  * Normalizes a raw barcode string into a renderable format + payload.
  *
  * Intended for rendering only: it may strip formatting characters and append or recompute check
  * digits for some formats.
  */
export function normalizeBarcodeForRendering(value: string): RenderableBarcode | null {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length === 13) {
    const body = digits.slice(0, 12);
    const expectedCheckDigit = ean13CheckDigit(body);

    // PnP occasionally returns scale codes (reserved `2*` prefix) with a non-EAN check digit.
    // Barcode scanners often reject them unless the check digit is corrected, so normalize by
    // recomputing and replacing the final digit for rendering.
    if (digits.startsWith("2")) {
      return { format: "EAN13", value: `${body}${expectedCheckDigit}` };
    }

    const checkDigit = digits[12];
    if (checkDigit !== expectedCheckDigit) {
      return null;
    }

    return { format: "EAN13", value: digits };
  }

  if (digits.length === 12) {
    // Prefer interpreting 12 digits as a full UPC-A (including check digit) and normalizing to EAN-13.
    // Otherwise, treat the 12 digits as an EAN-13 body missing its check digit.
    const upcBody = digits.slice(0, 11);
    const upcCheckDigit = digits[11];
    if (upcCheckDigit === upcACheckDigit(upcBody)) {
      return { format: "EAN13", value: `0${digits}` };
    }

    return { format: "EAN13", value: `${digits}${ean13CheckDigit(digits)}` };
  }

  if (digits.length === 8) {
    const body = digits.slice(0, 7);
    const checkDigit = digits[7];
    if (checkDigit !== ean8CheckDigit(body)) {
      return null;
    }

    return { format: "EAN8", value: digits };
  }

  if (digits.length === 7) {
    return { format: "EAN8", value: `${digits}${ean8CheckDigit(digits)}` };
  }

  return null;
}

function ean13CheckDigit(twelveDigits: string): string {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(twelveDigits[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }

  return String((10 - (sum % 10)) % 10);
}

function upcACheckDigit(elevenDigits: string): string {
  let sum = 0;
  for (let index = 0; index < 11; index += 1) {
    const digit = Number(elevenDigits[index]);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }

  return String((10 - (sum % 10)) % 10);
}

function ean8CheckDigit(sevenDigits: string): string {
  let sum = 0;
  for (let index = 0; index < 7; index += 1) {
    const digit = Number(sevenDigits[index]);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }

  return String((10 - (sum % 10)) % 10);
}
