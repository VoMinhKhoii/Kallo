/** RFC 4180: quote fields containing delimiters, quotes or line breaks. */
export function csvField(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
