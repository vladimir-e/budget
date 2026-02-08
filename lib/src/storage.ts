/**
 * Atomic file I/O for CSV data.
 *
 * All writes go through a temp-file + fsync + rename pattern so a crash
 * mid-write never corrupts the original file.
 */

import { readFile, writeFile, open, rename, appendFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseCSV, writeCSV, escapeField } from './csv.js';
import type { Schema } from './schema.js';
import { deserialize, serialize, fieldNames, getPrecision } from './schema.js';

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

/**
 * Write content to a file atomically: write to a temp file, fsync, then
 * rename over the original. If the process crashes mid-write, the original
 * file is untouched.
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tmpPath = join(dir, `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const fh = await open(tmpPath, 'w');
  try {
    await fh.writeFile(content, 'utf-8');
    await fh.sync();
  } finally {
    await fh.close();
  }

  await rename(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// CSV file read
// ---------------------------------------------------------------------------

export interface ReadCSVOptions {
  /** Fixed precision for all money fields (default 2) */
  precision?: number;
  /** Per-record precision — takes precedence over `precision` */
  getPrecisionForRecord?: (raw: Record<string, string>) => number;
}

/**
 * Read a CSV file and deserialize records using the given schema.
 *
 * - Missing columns in the CSV are filled with defaults.
 * - Extra columns in the CSV are ignored.
 * - Returns an empty array if the file is empty or has headers only.
 */
export async function readCSVFile<T>(
  filePath: string,
  schema: Schema<T>,
  options?: ReadCSVOptions,
): Promise<T[]> {
  const content = await readFile(filePath, 'utf-8');
  const rawRecords = parseCSV<Record<string, string>>(content);

  const defaultPrecision = options?.precision ?? 2;
  const getPrecisionFn = options?.getPrecisionForRecord;

  return rawRecords.map((raw) => {
    const precision = getPrecisionFn ? getPrecisionFn(raw) : defaultPrecision;
    return deserialize<T>(raw, schema, precision);
  });
}

// ---------------------------------------------------------------------------
// CSV file write
// ---------------------------------------------------------------------------

export interface WriteCSVOptions {
  /** Fixed precision for all money fields (default 2) */
  precision?: number;
  /** Per-record precision — takes precedence over `precision` */
  getPrecisionForRecord?: (record: Record<string, unknown>) => number;
}

/**
 * Serialize records and write them atomically to a CSV file.
 * Always writes ALL schema columns (schema migration on write).
 */
export async function writeCSVFile<T>(
  filePath: string,
  schema: Schema<T>,
  records: T[],
  options?: WriteCSVOptions,
): Promise<void> {
  const defaultPrecision = options?.precision ?? 2;
  const getPrecisionFn = options?.getPrecisionForRecord;
  const headers = fieldNames(schema);

  const serialized = records.map((record) => {
    const rec = record as Record<string, unknown>;
    const precision = getPrecisionFn ? getPrecisionFn(rec) : defaultPrecision;
    return serialize(record, schema, precision);
  });

  const csv = writeCSV(headers, serialized);
  await atomicWriteFile(filePath, csv);
}

// ---------------------------------------------------------------------------
// CSV append (transactions optimization)
// ---------------------------------------------------------------------------

/**
 * Append records to an existing CSV file without rewriting.
 * If the file doesn't exist or is empty, a full write is done instead.
 */
export async function appendCSVRecords<T>(
  filePath: string,
  schema: Schema<T>,
  records: T[],
  options?: WriteCSVOptions,
): Promise<void> {
  if (records.length === 0) return;

  const defaultPrecision = options?.precision ?? 2;
  const getPrecisionFn = options?.getPrecisionForRecord;
  const headers = fieldNames(schema);

  // Check if file exists and has content
  let fileExists = false;
  try {
    const s = await stat(filePath);
    fileExists = s.size > 0;
  } catch {
    // File doesn't exist
  }

  if (!fileExists) {
    // No file — do a full write
    await writeCSVFile(filePath, schema, records, options);
    return;
  }

  // Serialize new records and append (no header row)
  const serialized = records.map((record) => {
    const rec = record as Record<string, unknown>;
    const precision = getPrecisionFn ? getPrecisionFn(rec) : defaultPrecision;
    return serialize(record, schema, precision);
  });

  const lines = serialized.map((rec) =>
    headers.map((h) => escapeField(rec[h] ?? '')).join(','),
  );
  const content = lines.join('\n') + '\n';

  await appendFile(filePath, content, 'utf-8');
}
