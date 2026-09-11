/**
 * Minimal RFC 4180 CSV writer for admin exports. Every cell is quoted when it
 * contains a comma, quote, or newline; quotes are doubled. Cells starting with
 * a formula trigger are prefixed with an apostrophe so a spreadsheet opening
 * the file never executes user-supplied text.
 */

export type CsvCell = string | number | boolean | Date | null | undefined;

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (text.length > 0 && FORMULA_TRIGGERS.has(text[0]!)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
