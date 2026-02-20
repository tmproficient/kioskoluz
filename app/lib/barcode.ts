const BARCODE_PREFIX = "KSK";

export function generateBarcodeCandidate() {
  const ts = Date.now().toString().slice(-7);
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${BARCODE_PREFIX}${ts}${rand}`;
}