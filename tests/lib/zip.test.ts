// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import {
  buildZipPath,
  sanitizePathSegment,
  createZip,
  createZipFromResults,
  formatZipName,
} from '../../src/lib/zip';
import type { DownloadResult } from '../../src/lib/moodle/downloader';

describe('sanitizePathSegment', () => {
  it('removes invalid characters', () => {
    expect(sanitizePathSegment('file<>:"/\\|?*name')).toBe('file_________name');
  });

  it('removes trailing dots', () => {
    expect(sanitizePathSegment('folder...')).toBe('folder');
  });

  it('collapses whitespace', () => {
    expect(sanitizePathSegment('hello   world')).toBe('hello world');
  });

  it('returns unnamed for empty string', () => {
    expect(sanitizePathSegment('')).toBe('unnamed');
  });
});

describe('buildZipPath', () => {
  it('builds path with course/section/file', () => {
    const paths = new Set<string>();
    const path = buildZipPath('My Course', 'Week 1', 'lecture.pdf', paths);
    expect(path).toBe('My Course/Week 1/lecture.pdf');
  });

  it('uses Unsorted when no section provided', () => {
    const paths = new Set<string>();
    const path = buildZipPath('Course', undefined, 'file.pdf', paths);
    expect(path).toBe('Course/Unsorted/file.pdf');
  });

  it('handles duplicate filenames', () => {
    const paths = new Set<string>();
    const p1 = buildZipPath('C', 'S', 'file.pdf', paths);
    const p2 = buildZipPath('C', 'S', 'file.pdf', paths);
    const p3 = buildZipPath('C', 'S', 'file.pdf', paths);

    expect(p1).toBe('C/S/file.pdf');
    expect(p2).toBe('C/S/file (1).pdf');
    expect(p3).toBe('C/S/file (2).pdf');
  });

  it('handles filenames without extension', () => {
    const paths = new Set<string>();
    const p1 = buildZipPath('C', 'S', 'README', paths);
    const p2 = buildZipPath('C', 'S', 'README', paths);

    expect(p1).toBe('C/S/README');
    expect(p2).toBe('C/S/README (1)');
  });
});

describe('createZip', () => {
  it('creates a valid ZIP with entries', () => {
    const data = new TextEncoder().encode('hello world');
    const zip = createZip([{ path: 'test/file.txt', data }]);

    // Verify by decompressing
    const unzipped = unzipSync(zip);
    expect(unzipped['test/file.txt']).toBeDefined();
    expect(new TextDecoder().decode(unzipped['test/file.txt'])).toBe('hello world');
  });

  it('creates ZIP with multiple entries', () => {
    const entries = [
      { path: 'a.txt', data: new TextEncoder().encode('aaa') },
      { path: 'b.txt', data: new TextEncoder().encode('bbb') },
    ];
    const zip = createZip(entries);
    const unzipped = unzipSync(zip);

    expect(Object.keys(unzipped)).toHaveLength(2);
    expect(new TextDecoder().decode(unzipped['a.txt'])).toBe('aaa');
    expect(new TextDecoder().decode(unzipped['b.txt'])).toBe('bbb');
  });
});

describe('createZipFromResults', () => {
  it('creates ZIP with proper folder structure', () => {
    const results: DownloadResult[] = [
      {
        file: {
          id: '1',
          name: 'lecture.pdf',
          url: 'https://moodle.com/file.pdf',
          extension: 'pdf',
          sectionName: 'Week 1',
        },
        data: new Uint8Array([1, 2, 3]),
      },
      {
        file: {
          id: '2',
          name: 'notes.docx',
          url: 'https://moodle.com/notes.docx',
          extension: 'docx',
          sectionName: 'Week 2',
        },
        data: new Uint8Array([4, 5, 6]),
      },
    ];

    const zip = createZipFromResults(results, 'My Course');
    const unzipped = unzipSync(zip);

    expect(unzipped['My Course/Week 1/lecture.pdf']).toBeDefined();
    expect(unzipped['My Course/Week 2/notes.docx']).toBeDefined();
  });
});

describe('formatZipName', () => {
  it('replaces courseName token', () => {
    const name = formatZipName('{courseName}_{date}', 'Algorithms');
    expect(name).toMatch(/^Algorithms_\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it('sanitizes result', () => {
    const name = formatZipName('{courseName}', 'Course: "Advanced"');
    expect(name).toBe('Course_ _Advanced_.zip');
  });
});
