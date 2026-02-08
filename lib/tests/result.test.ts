import { describe, it, expect } from 'vitest';
import { ok, err } from '../src/result.js';
import type { Result } from '../src/result.js';

describe('result', () => {
  it('should create a successful result with ok()', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('should create a failed result with err()', () => {
    const result = err('something went wrong');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('something went wrong');
    }
  });

  it('should narrow types correctly', () => {
    const result: Result<string> = ok('hello');
    if (result.ok) {
      const value: string = result.value;
      expect(value).toBe('hello');
    }
  });

  it('should handle complex value types', () => {
    const result = ok({ items: [1, 2, 3], count: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toEqual([1, 2, 3]);
      expect(result.value.count).toBe(3);
    }
  });
});
