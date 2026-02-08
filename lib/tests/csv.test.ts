import { describe, it, expect } from 'vitest';
import { parseCSV, writeCSV } from '../src/csv.js';

describe('csv', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV', () => {
      const input = 'name,age\nAlice,30\nBob,25\n';
      const result = parseCSV(input);
      expect(result).toEqual([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ]);
    });

    it('should handle BOM', () => {
      const input = '\uFEFFname,age\nAlice,30\n';
      const result = parseCSV(input);
      expect(result).toEqual([{ name: 'Alice', age: '30' }]);
    });

    it('should handle quoted fields', () => {
      const input = 'name,desc\nAlice,"Hello, World"\n';
      const result = parseCSV(input);
      expect(result).toEqual([{ name: 'Alice', desc: 'Hello, World' }]);
    });

    it('should handle escaped quotes', () => {
      const input = 'name,desc\nAlice,"She said ""hello"""\n';
      const result = parseCSV(input);
      expect(result).toEqual([{ name: 'Alice', desc: 'She said "hello"' }]);
    });

    it('should handle empty input', () => {
      expect(parseCSV('')).toEqual([]);
    });

    it('should handle headers only', () => {
      expect(parseCSV('name,age\n')).toEqual([]);
    });

    it('should handle newlines in quoted fields', () => {
      const input = 'name,desc\nAlice,"line1\nline2"\n';
      const result = parseCSV(input);
      expect(result).toEqual([{ name: 'Alice', desc: 'line1\nline2' }]);
    });

    it('should handle CRLF line endings', () => {
      const input = 'name,age\r\nAlice,30\r\n';
      const result = parseCSV(input);
      expect(result).toEqual([{ name: 'Alice', age: '30' }]);
    });
  });

  describe('writeCSV', () => {
    it('should write simple CSV', () => {
      const result = writeCSV(['name', 'age'], [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
      expect(result).toBe('name,age\nAlice,30\nBob,25\n');
    });

    it('should escape fields with commas', () => {
      const result = writeCSV(['name'], [{ name: 'Hello, World' }]);
      expect(result).toBe('name\n"Hello, World"\n');
    });

    it('should escape fields with quotes', () => {
      const result = writeCSV(['name'], [{ name: 'She said "hello"' }]);
      expect(result).toBe('name\n"She said ""hello"""\n');
    });

    it('should handle empty records', () => {
      const result = writeCSV(['name', 'age'], []);
      expect(result).toBe('name,age\n');
    });
  });

  describe('roundtrip', () => {
    it('should parse what it writes', () => {
      const headers = ['id', 'name', 'amount'] as const;
      const records = [
        { id: '1', name: 'Test', amount: '100.50' },
        { id: '2', name: 'With, comma', amount: '-50' },
      ];
      const csv = writeCSV(headers as unknown as string[], records);
      const parsed = parseCSV(csv);
      expect(parsed).toEqual(records);
    });
  });
});
