/**
 * ID generation — auto-increment from max existing ID.
 *
 * IDs are stored as strings but are numeric auto-incremented integers.
 * Non-numeric IDs are ignored when computing the next value.
 */

/** Generate the next ID for a collection of records */
export function nextId(records: { id: string }[]): string {
  let max = 0;
  for (const record of records) {
    const n = parseInt(record.id, 10);
    if (!isNaN(n) && n > max) {
      max = n;
    }
  }
  return String(max + 1);
}
