/**
 * Convert a non-negative integer to Indian-English words.
 * Supports up to 99,99,99,99,999 (99 thousand crore).
 */

const UNITS = ["","one","two","three","four","five","six","seven","eight","nine",
  "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

function twoDigitWords(n) {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TENS[t] : `${TENS[t]}-${UNITS[u]}`;
}

function threeDigitWords(n) {
  if (n < 100) return twoDigitWords(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0
    ? `${UNITS[h]} hundred`
    : `${UNITS[h]} hundred ${twoDigitWords(rest)}`;
}

function integerToIndianWords(num) {
  if (num === 0) return "zero";
  if (num < 0) throw new Error("Negative numbers not supported");
  const parts = [];
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const rest = num;
  if (crore > 0)    parts.push(`${integerToIndianWords(crore)} crore`);
  if (lakh > 0)     parts.push(`${twoDigitWords(lakh)} lakh`);
  if (thousand > 0) parts.push(`${twoDigitWords(thousand)} thousand`);
  if (rest > 0)     parts.push(threeDigitWords(rest));
  return parts.join(" ").trim();
}

function paiseToWords(totalPaise) {
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const rupeePart = integerToIndianWords(rupees);
  let out = `${rupeePart.charAt(0).toUpperCase()}${rupeePart.slice(1)} rupees`;
  if (paise > 0) out += ` and ${twoDigitWords(paise)} paise`;
  out += " only";
  return out;
}

module.exports = { integerToIndianWords, twoDigitWords, threeDigitWords, paiseToWords };
