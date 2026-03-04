import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  formatSpeed,
  formatEta,
  sanitizeFilename,
  generateId,
  dedupeBy,
} from '../../src/lib/utils';

describe('formatFileSize', () => {
  it('formats zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });
});

describe('formatSpeed', () => {
  it('formats speed', () => {
    expect(formatSpeed(1048576)).toBe('1.0 MB/s');
  });
});

describe('formatEta', () => {
  it('formats seconds', () => {
    expect(formatEta(65)).toBe('01:05');
  });

  it('formats hours', () => {
    expect(formatEta(3661)).toBe('01:01:01');
  });

  it('handles zero/negative', () => {
    expect(formatEta(0)).toBe('--:--');
    expect(formatEta(-1)).toBe('--:--');
  });

  it('handles infinity', () => {
    expect(formatEta(Infinity)).toBe('--:--');
  });
});

describe('sanitizeFilename', () => {
  it('replaces invalid chars', () => {
    expect(sanitizeFilename('file<>name.pdf')).toBe('file__name.pdf');
  });

  it('returns unnamed for empty', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
  });
});

describe('generateId', () => {
  it('generates unique IDs', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});

describe('dedupeBy', () => {
  it('deduplicates by key', () => {
    const items = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '1', name: 'c' },
    ];
    const result = dedupeBy(items, (i) => i.id);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('a');
    expect(result[1].name).toBe('b');
  });

  it('handles empty array', () => {
    expect(dedupeBy([], (x) => String(x))).toEqual([]);
  });
});
