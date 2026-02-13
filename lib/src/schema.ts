/**
 * Field schemas — single source of truth for CSV ↔ typed record conversion.
 *
 * Each schema defines field names, types, and defaults. Money fields use
 * integer representation in memory (no floating-point drift) with currency
 * precision controlling conversion.
 */

import type { Account, Transaction, Category } from './types.js';

// ---------------------------------------------------------------------------
// Field types
// ---------------------------------------------------------------------------

export type FieldType = 'string' | 'number' | 'boolean' | 'money';

export interface FieldDef<K extends string = string> {
  readonly name: K;
  readonly type: FieldType;
}

/**
 * A Schema is an ordered list of field definitions.
 * The order determines CSV column order.
 */
export type Schema<T = unknown> = readonly FieldDef<Extract<keyof T, string>>[];

// ---------------------------------------------------------------------------
// Compile-time completeness check
// ---------------------------------------------------------------------------

/**
 * Resolves to `true` if every key of T appears in the schema, else
 * becomes a string literal describing the missing keys.
 */
type AssertComplete<T, S extends readonly { name: string }[]> =
  [Exclude<Extract<keyof T, string>, S[number]['name']>] extends [never]
    ? true
    : `Missing fields: ${Exclude<Extract<keyof T, string>, S[number]['name']> & string}`;

// ---------------------------------------------------------------------------
// Currency precision map
// ---------------------------------------------------------------------------

/**
 * Maps currency codes to decimal precision.
 * Determines ×10^n on read (CSV → memory) and ÷10^n on write (memory → CSV).
 */
export const CURRENCY_PRECISION: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  CHF: 2,
  CNY: 2,
  JPY: 0,
  KRW: 0,
  BTC: 8,
  ETH: 8,
  SOL: 8,
};

/** Get precision for a currency code (defaults to 2) */
export function getPrecision(currency: string): number {
  return CURRENCY_PRECISION[currency] ?? 2;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ACCOUNT_SCHEMA = [
  { name: 'id', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'type', type: 'string' },
  { name: 'currency', type: 'string' },
  { name: 'institution', type: 'string' },
  { name: 'balance', type: 'money' },
  { name: 'hidden', type: 'boolean' },
  { name: 'reconciled', type: 'string' },
  { name: 'createdAt', type: 'string' },
] as const satisfies Schema<Account>;

// Compile-time: ensure every Account key is present
const _accountComplete: AssertComplete<Account, typeof ACCOUNT_SCHEMA> = true;
void _accountComplete;

export const TRANSACTION_SCHEMA = [
  { name: 'id', type: 'string' },
  { name: 'type', type: 'string' },
  { name: 'accountId', type: 'string' },
  { name: 'date', type: 'string' },
  { name: 'categoryId', type: 'string' },
  { name: 'description', type: 'string' },
  { name: 'payee', type: 'string' },
  { name: 'transferPairId', type: 'string' },
  { name: 'amount', type: 'money' },
  { name: 'notes', type: 'string' },
  { name: 'source', type: 'string' },
  { name: 'createdAt', type: 'string' },
] as const satisfies Schema<Transaction>;

const _transactionComplete: AssertComplete<Transaction, typeof TRANSACTION_SCHEMA> = true;
void _transactionComplete;

export const CATEGORY_SCHEMA = [
  { name: 'id', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'group', type: 'string' },
  { name: 'assigned', type: 'money' },
  { name: 'hidden', type: 'boolean' },
] as const satisfies Schema<Category>;

const _categoryComplete: AssertComplete<Category, typeof CATEGORY_SCHEMA> = true;
void _categoryComplete;

// ---------------------------------------------------------------------------
// fieldNames — extract ordered header list from a schema
// ---------------------------------------------------------------------------

/** Extract ordered field names from a schema (for CSV headers) */
export function fieldNames<T>(schema: Schema<T>): string[] {
  return schema.map((f) => f.name);
}

// ---------------------------------------------------------------------------
// Backward-compatible field arrays (derived from schemas)
// ---------------------------------------------------------------------------

export const ACCOUNT_FIELDS: readonly (keyof Account)[] = fieldNames(ACCOUNT_SCHEMA) as (keyof Account)[];
export const TRANSACTION_FIELDS: readonly (keyof Transaction)[] = fieldNames(TRANSACTION_SCHEMA) as (keyof Transaction)[];
export const CATEGORY_FIELDS: readonly (keyof Category)[] = fieldNames(CATEGORY_SCHEMA) as (keyof Category)[];

// ---------------------------------------------------------------------------
// Money conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert a decimal string from CSV to an integer amount.
 * "10.50" with precision 2 → 1050
 */
export function toIntegerAmount(value: string, precision: number): number {
  if (value === '') return 0;
  const num = Number(value);
  if (isNaN(num)) return 0;
  // Use rounding to avoid floating-point drift
  return Math.round(num * Math.pow(10, precision));
}

/**
 * Convert an integer amount to a decimal string for CSV.
 * 1050 with precision 2 → "10.50"
 */
export function fromIntegerAmount(value: number, precision: number): string {
  if (precision === 0) return String(value);
  const divisor = Math.pow(10, precision);
  return (value / divisor).toFixed(precision);
}

// ---------------------------------------------------------------------------
// Defaults per field type
// ---------------------------------------------------------------------------

function defaultForType(type: FieldType): string | number | boolean {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'money': return 0;
  }
}

// ---------------------------------------------------------------------------
// Deserialize: raw CSV record → typed record
// ---------------------------------------------------------------------------

/**
 * Convert a raw string record (from CSV) into a typed record.
 *
 * - string fields: kept as-is (missing → '')
 * - number fields: parsed (missing/invalid → 0)
 * - boolean fields: 'true' → true, everything else → false
 * - money fields: decimal string → integer (×10^precision)
 *
 * Missing columns are filled with defaults (schema migration).
 * Extra columns in raw are ignored.
 */
export function deserialize<T>(
  raw: Record<string, string>,
  schema: Schema<T>,
  precision: number = 2,
): T {
  const result: Record<string, unknown> = {};
  for (const field of schema) {
    const rawValue = raw[field.name];
    const missing = rawValue === undefined || rawValue === null;

    switch (field.type) {
      case 'string':
        result[field.name] = missing ? '' : rawValue;
        break;
      case 'number': {
        if (missing || rawValue === '') {
          result[field.name] = 0;
        } else {
          const n = Number(rawValue);
          result[field.name] = isNaN(n) ? 0 : n;
        }
        break;
      }
      case 'boolean':
        result[field.name] = missing ? false : rawValue === 'true';
        break;
      case 'money':
        result[field.name] = missing ? 0 : toIntegerAmount(rawValue, precision);
        break;
    }
  }
  return result as T;
}

// ---------------------------------------------------------------------------
// Serialize: typed record → raw CSV record
// ---------------------------------------------------------------------------

/**
 * Convert a typed record into a string record for CSV writing.
 *
 * - string fields: kept as-is
 * - number fields: converted to string
 * - boolean fields: 'true' or 'false'
 * - money fields: integer → decimal string (÷10^precision)
 */
export function serialize<T>(
  record: T,
  schema: Schema<T>,
  precision: number = 2,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of schema) {
    const value = (record as Record<string, unknown>)[field.name];

    switch (field.type) {
      case 'string':
        result[field.name] = String(value ?? '');
        break;
      case 'number':
        result[field.name] = String(value ?? 0);
        break;
      case 'boolean':
        result[field.name] = String(value ?? false);
        break;
      case 'money':
        result[field.name] = fromIntegerAmount(Number(value ?? 0), precision);
        break;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Schema lookup helpers
// ---------------------------------------------------------------------------

/** Get the FieldDef for a given field name */
export function getFieldDef<T>(schema: Schema<T>, name: string): FieldDef | undefined {
  return schema.find((f) => f.name === name);
}

/** Get default values for all fields in a schema */
export function schemaDefaults<T>(schema: Schema<T>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of schema) {
    result[field.name] = defaultForType(field.type);
  }
  return result;
}
