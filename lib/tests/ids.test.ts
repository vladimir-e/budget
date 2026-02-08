import { describe, it, expect } from 'vitest';
import { nextId } from '../src/ids.js';

describe('ids', () => {
  it('should return "1" for empty dataset', () => {
    expect(nextId([])).toBe('1');
  });

  it('should return next sequential ID', () => {
    const records = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(nextId(records)).toBe('4');
  });

  it('should handle gaps in IDs', () => {
    const records = [{ id: '1' }, { id: '5' }, { id: '3' }];
    expect(nextId(records)).toBe('6');
  });

  it('should ignore non-numeric IDs', () => {
    const records = [{ id: 'abc' }, { id: '7' }, { id: 'xyz' }];
    expect(nextId(records)).toBe('8');
  });

  it('should handle all non-numeric IDs', () => {
    const records = [{ id: 'abc' }, { id: 'xyz' }];
    expect(nextId(records)).toBe('1');
  });

  it('should handle single record', () => {
    expect(nextId([{ id: '42' }])).toBe('43');
  });
});
