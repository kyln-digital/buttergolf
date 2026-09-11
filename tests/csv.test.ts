import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "../apps/web/src/lib/csv";

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
  });

  it("renders empty for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("writes dates as ISO strings", () => {
    expect(csvCell(new Date("2026-09-11T10:00:00Z"))).toBe("2026-09-11T10:00:00.000Z");
  });
});

describe("toCsv", () => {
  it("joins header and rows with CRLF and a trailing newline", () => {
    const out = toCsv(
      ["email", "source"],
      [
        ["a@example.com", "homepage"],
        ["b@example.com", "coming,soon"],
      ]
    );
    expect(out).toBe('email,source\r\na@example.com,homepage\r\nb@example.com,"coming,soon"\r\n');
  });
});
