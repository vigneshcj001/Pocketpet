/** Extract display hints only; source answer and audit log stay authoritative. */
export function resultHints(answer) {
  const text = String(answer || "");
  const urls = [...new Set((text.match(/https?:\/\/[^\s)\]>"']+/g) || []).map((raw) => raw.replace(/[.,;!?]+$/, "")))].slice(0, 8);
  const prices = [...new Set(text.match(/(?:[$₹€£]\s?\d[\d,.]*|\b(?:USD|INR|EUR|GBP)\s?\d[\d,.]*)/gi) || [])].slice(0, 8);
  const dates = [...new Set(text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [])].slice(0, 8);
  return { urls, prices, dates };
}
