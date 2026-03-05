import { zipSync } from 'fflate';
import type { DownloadResult } from './moodle/downloader';

export interface ZipEntry {
  /** Path within the ZIP (e.g. "Course/Section/file.pdf") */
  path: string;
  data: Uint8Array;
}

interface ZipTree {
  [key: string]: ZipTree | Uint8Array;
};

/**
 * Build a ZIP path for a file, handling duplicate names.
 */
export function buildZipPath(
  courseName: string,
  sectionName: string | undefined,
  fileName: string,
  existingPaths: Set<string>,
): string {
  const sanitizedCourse = sanitizePathSegment(courseName);
  const sanitizedSection = sectionName ? sanitizePathSegment(sectionName) : 'Unsorted';
  const sanitizedName = sanitizePathSegment(fileName);

  let path = `${sanitizedCourse}/${sanitizedSection}/${sanitizedName}`;

  // Handle duplicates
  if (existingPaths.has(path)) {
    const dotIndex = sanitizedName.lastIndexOf('.');
    const base = dotIndex > 0 ? sanitizedName.slice(0, dotIndex) : sanitizedName;
    const ext = dotIndex > 0 ? sanitizedName.slice(dotIndex) : '';

    let counter = 1;
    do {
      path = `${sanitizedCourse}/${sanitizedSection}/${base} (${counter})${ext}`;
      counter++;
    } while (existingPaths.has(path));
  }

  existingPaths.add(path);
  return path;
}

/**
 * Sanitize a single path segment (folder or file name).
 */
export function sanitizePathSegment(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove invalid chars
    .replace(/\.+$/, '') // Remove trailing dots
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
    || 'unnamed';
}

/**
 * Create a ZIP file from download results.
 *
 * @param results - Download results to package
 * @param courseName - Course name for folder structure
 * @returns ZIP file as Uint8Array
 */
export function createZipFromResults(
  results: DownloadResult[],
  courseName: string,
): Uint8Array {
  const existingPaths = new Set<string>();
  const entries: ZipEntry[] = results.map((result) => ({
    path: buildZipPath(
      courseName,
      result.file.sectionName,
      result.file.name,
      existingPaths,
    ),
    data: result.data,
  }));

  return createZip(entries);
}

/**
 * Ensures a directory exists inside a ZipTree node and returns it.
 *
 * In the fflate ZIP structure, directories are represented as nested objects,
 * while files are stored as Uint8Array values. This helper checks whether the
 * given key already exists:
 *
 * - If the entry is missing or is currently a file (Uint8Array), it creates
 *   a new directory object and assigns it.
 * - If the entry is already a directory, it simply returns it.
 *
 * This guarantees that callers always receive a ZipTree directory node,
 * avoiding TypeScript union issues when traversing the tree.
 */
function getOrCreateDir(node: ZipTree, name: string): ZipTree {
  const existing = node[name];

  // if missing OR it's a file, replace with a directory
  if (!existing || existing instanceof Uint8Array) {
    const dir: ZipTree = {};
    node[name] = dir;
    return dir;
  }

  // here TS knows it's ZipTree (because not Uint8Array)
  return existing;
}

/**
 * Create a ZIP file from entries using fflate.
 * fflate's zipSync expects nested objects for directory paths.
 */
export function createZip(entries: ZipEntry[]): Uint8Array {
  const root: ZipTree = {};

  for (const entry of entries) {
    const parts = entry.path.split('/');
    let current = root;
    
    for (let i = 0; i < parts.length - 1; i++) {
      current = getOrCreateDir(current, parts[i]);
    }
    
    current[parts[parts.length - 1]] = entry.data;
  }

  return zipSync(root);
}

/**
 * Format a ZIP filename from a pattern.
 * Supported tokens: {courseName}, {date}
 */
export function formatZipName(pattern: string, courseName: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return (
    sanitizePathSegment(
      pattern.replace('{courseName}', courseName).replace('{date}', date),
    ) + '.zip'
  );
}
