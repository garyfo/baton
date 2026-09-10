const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

export function formatNumber(value: number): string {
  if (value < 1000) return Math.floor(value).toString();
  const exp = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(value) / 3));
  const scaled = value / Math.pow(1000, exp);
  return `${scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)}${SUFFIXES[exp]}`;
}
