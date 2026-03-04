import type { MoodleFile } from './types';
import { extractFilesFromContainer, isResourceUrl, resetIdCounter } from './parser';

export interface CrawlOptions {
  /** Maximum depth for BFS traversal (default: 3) */
  maxDepth: number;
  /** Maximum number of pages to visit (default: 100) */
  maxPages: number;
  /** Callback for progress updates */
  onProgress?: (visited: number, queued: number) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export const DEFAULT_CRAWL_OPTIONS: CrawlOptions = {
  maxDepth: 3,
  maxPages: 100,
};

interface CrawlQueueItem {
  url: string;
  depth: number;
}

/**
 * BFS crawl from a starting URL, following Moodle folder/resource links.
 * Fetches pages and extracts file links from each.
 *
 * @param startUrl - The URL to start crawling from
 * @param fetchPage - Function that fetches a URL and returns its Document (injected for testability)
 * @param options - Crawl options
 * @returns Array of discovered files
 */
export async function crawl(
  startUrl: string,
  fetchPage: (url: string) => Promise<Document>,
  options: Partial<CrawlOptions> = {},
): Promise<MoodleFile[]> {
  const opts = { ...DEFAULT_CRAWL_OPTIONS, ...options };
  const visited = new Set<string>();
  const allFiles: MoodleFile[] = [];
  const seenFileUrls = new Set<string>();
  const queue: CrawlQueueItem[] = [{ url: normalizeUrl(startUrl), depth: 0 }];

  while (queue.length > 0) {
    if (opts.signal?.aborted) break;
    if (visited.size >= opts.maxPages) break;

    const item = queue.shift()!;
    const normalized = normalizeUrl(item.url);

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    opts.onProgress?.(visited.size, queue.length);

    let doc: Document;
    try {
      doc = await fetchPage(item.url);
    } catch {
      continue; // Skip unreachable pages
    }

    // Extract files from this page
    const files = extractFilesFromContainer(doc.body ?? doc.documentElement);
    for (const file of files) {
      if (!seenFileUrls.has(file.url)) {
        seenFileUrls.add(file.url);
        allFiles.push(file);
      }
    }

    // If we haven't reached max depth, enqueue sub-links (folders, sub-pages)
    if (item.depth < opts.maxDepth) {
      const subLinks = extractCrawlableLinks(doc, normalized);
      for (const link of subLinks) {
        if (!visited.has(normalizeUrl(link))) {
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    }
  }

  return allFiles;
}

/**
 * Extract links from a page that are worth crawling deeper
 * (folder views, sub-sections, resource pages — but not file downloads).
 */
export function extractCrawlableLinks(doc: Document, currentUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const currentOrigin = new URL(currentUrl).origin;

  const anchors = doc.querySelectorAll('a[href]');
  for (const a of anchors) {
    const href = (a as HTMLAnchorElement).href;
    if (!href) continue;

    let parsed: URL;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }

    // Stay on same origin
    if (parsed.origin !== currentOrigin) continue;

    const path = parsed.pathname;

    // Only follow Moodle navigation links, not direct file downloads
    const isCrawlable =
      path.includes('/mod/folder/view.php') ||
      path.includes('/mod/page/view.php') ||
      path.includes('/course/view.php') ||
      path.includes('/course/resources.php');

    // Skip if it's a direct file link
    if (isResourceUrl(href) && !isCrawlable) continue;

    if (isCrawlable) {
      const normalized = normalizeUrl(href);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        links.push(href);
      }
    }
  }

  return links;
}

/**
 * Normalize a URL for deduplication (remove hash, sort params).
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url;
  }
}

// Re-export for convenience
export { resetIdCounter };
