import type { Transaction } from './types.js';

// TODO: Implement transfer pair creation and sync logic

/** Find the paired transfer transaction */
export function getTransferPair(
  records: Transaction[],
  transaction: Transaction,
): Transaction | undefined {
  if (!transaction.transferPairId) return undefined;
  return records.find((t) => t.id === transaction.transferPairId);
}

/** Check if a transaction is part of a transfer pair */
export function isTransfer(transaction: Transaction): boolean {
  return transaction.type === 'transfer' && !!transaction.transferPairId;
}
