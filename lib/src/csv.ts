/**
 * RFC 4180 compliant CSV parser and writer.
 * BOM-safe, handles quoted fields and escaped quotes.
 * No external dependencies.
 */

/** Parse a CSV string into an array of record objects */
export function parseCSV<T extends Record<string, string>>(input: string): T[] {
  // Strip BOM if present
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows = parseRows(text);
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record = {} as Record<string, string>;
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = row[i] ?? '';
    }
    return record as T;
  });
}

/** Write an array of record objects to a CSV string */
export function writeCSV<T extends Record<string, unknown>>(
  headers: readonly string[],
  records: T[],
): string {
  const lines: string[] = [headers.map(escapeField).join(',')];
  for (const record of records) {
    const row = headers.map((h) => escapeField(String(record[h] ?? '')));
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

/** Parse CSV text into rows of fields */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;

  while (i < text.length) {
    const { row, nextIndex } = parseRow(text, i);
    // Skip empty trailing rows
    if (nextIndex >= text.length && row.length === 1 && row[0] === '') break;
    rows.push(row);
    i = nextIndex;
  }

  return rows;
}

/** Parse a single row starting at index i */
function parseRow(text: string, start: number): { row: string[]; nextIndex: number } {
  const fields: string[] = [];
  let i = start;

  while (i < text.length) {
    if (text[i] === '"') {
      // Quoted field
      const { value, nextIndex } = parseQuotedField(text, i);
      fields.push(value);
      i = nextIndex;
    } else {
      // Unquoted field
      let end = i;
      while (end < text.length && text[end] !== ',' && text[end] !== '\n' && text[end] !== '\r') {
        end++;
      }
      fields.push(text.slice(i, end));
      i = end;
    }

    if (i < text.length && text[i] === ',') {
      i++; // skip comma
      // If comma is at end of line or file, add empty trailing field
      if (i >= text.length || text[i] === '\n' || text[i] === '\r') {
        fields.push('');
      }
      continue;
    }

    // End of row (newline or EOF)
    if (i < text.length && text[i] === '\r') i++;
    if (i < text.length && text[i] === '\n') i++;
    break;
  }

  return { row: fields, nextIndex: i };
}

/** Parse a quoted field starting at index i (which should be a double quote) */
function parseQuotedField(text: string, start: number): { value: string; nextIndex: number } {
  let i = start + 1; // skip opening quote
  let value = '';

  while (i < text.length) {
    if (text[i] === '"') {
      if (i + 1 < text.length && text[i + 1] === '"') {
        // Escaped quote
        value += '"';
        i += 2;
      } else {
        // End of quoted field
        i++; // skip closing quote
        return { value, nextIndex: i };
      }
    } else {
      value += text[i];
      i++;
    }
  }

  // Unterminated quote — return what we have
  return { value, nextIndex: i };
}

/** Escape a field value for CSV output */
function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
