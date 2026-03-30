export type RenderableBarcode = {
  format: "EAN13" | "EAN8";
  value: string;
};

export function isScaleItemEan13(value: string): boolean {
  return value.length === 13 && value.startsWith("2") && value.endsWith("000000");
}

/**
* Normalizes a raw barcode string into a renderable format + payload.
*
* Intended for rendering only: it may strip formatting characters and append check digits for
* some formats.
*
* Note: 13-digit scale codes (restricted distribution, `2x` prefix ending in `000000`) may bypass
* check digit validation so we can render the original digits even when the source checksum is
* incorrect.
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
    const checkDigit = digits[12];

    // Some scale-item codes use restricted distribution prefixes (20-29) and end with `000000`.
    // These can come through with a non-EAN check digit, but some scanners/systems still expect
    // the digits exactly as provided (including the six zero suffix), so we accept them as-is and
    // let the renderer handle the non-standard check digit.
    if (isScaleItemEan13(digits)) {
      return { format: "EAN13", value: digits };
    }

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

/**
* Encodes a 13-digit EAN-13 value into a BWIPP `raw` "sbs" string (run-length encoded bars/spaces).
*
* This does not validate the EAN-13 check digit; callers are expected to decide when to permit
* non-standard checksums (e.g. for scale-item barcodes).
*/
export function ean13ToRawSbs(value: string): string | null {
  if (value.length !== 13 || /\D/.test(value)) {
    return null;
  }

  const firstDigit = Number(value[0]);
  const parity = EAN13_PARITY[firstDigit];
  if (!parity) {
    return null;
  }

  let bits = "101";
  for (let index = 0; index < 6; index += 1) {
    const digit = Number(value[index + 1]);
    const code = parity[index] === "G" ? EAN13_G[digit] : EAN13_L[digit];
    if (!code) {
      return null;
    }

    bits += code;
  }

  bits += "01010";
  for (let index = 0; index < 6; index += 1) {
    const digit = Number(value[index + 7]);
    const code = EAN13_R[digit];
    if (!code) {
      return null;
    }

    bits += code;
  }

  bits += "101";

  if (bits[0] !== "1") {
    return null;
  }

  const runs: number[] = [];
  let current = bits[0];
  let count = 1;
  for (let index = 1; index < bits.length; index += 1) {
    const bit = bits[index];
    if (bit === current) {
      count += 1;
      continue;
    }

    runs.push(count);
    current = bit;
    count = 1;
  }
  runs.push(count);

  if (runs.some((run) => run < 1 || run > 9)) {
    return null;
  }

  return runs.map(String).join("");
}

const EAN13_L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];

const EAN13_G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];

const EAN13_R = [
  "1110010",
  "1100110",
  "1101100",
  "1000010",
  "1011100",
  "1001110",
  "1010000",
  "1000100",
  "1001000",
  "1110100",
];

const EAN13_PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

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
