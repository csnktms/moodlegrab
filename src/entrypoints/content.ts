import { detectMoodle } from '@/lib/moodle/detector';
import {
  parseCourseFiles,
  parseResourcesPage,
  parseFolderPage,
  extractFilename,
  extractExtension,
  mimeToExtension,
} from '@/lib/moodle/parser';
import type { MoodleFile, MoodleDetectionResult } from '@/lib/moodle/types';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    const detection = detectMoodle(document, window.location.href);

    if (!detection.isMoodle) return;

    console.log('[MoodleGrab] Moodle detected!', detection);

    browser.runtime.sendMessage({
      type: 'moodle-detected',
      payload: detection,
    });

    browser.runtime.onMessage.addListener(
      (
        message: { type: string; payload?: unknown },
        _sender,
        sendResponse: (response: unknown) => void,
      ) => {
        if (message.type === 'scan-page') {
          const files = scanCurrentPage(detection);
          console.log(`[MoodleGrab] Scanned page, found ${files.length} files. Resolving URLs...`);
          resolveFileUrls(files).then((resolved) => {
            console.log('[MoodleGrab] Resolved files:', resolved.map((f) => `${f.name} → ${f.url}`));
            sendResponse(resolved);
          });
          return true;
        }

        if (message.type === 'fetch-file') {
          const { url } = message.payload as { url: string };
          fetchFileViaContentScript(url).then(sendResponse).catch((err) => {
            console.warn('[MoodleGrab] fetch-file error:', err);
            sendResponse({ error: err instanceof Error ? err.message : String(err) });
          });
          return true;
        }

        return false;
      },
    );
  },
});

/**
 * Fetch a file in the content script context (which has Moodle session cookies).
 * Returns the file data as base64 along with resolved metadata.
 */
async function fetchFileViaContentScript(
  url: string,
): Promise<{
  data: string;
  resolvedUrl: string;
  contentType: string;
  contentDisposition: string;
  error?: string;
}> {
  const response = await fetch(url, {
    redirect: 'follow',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Convert to base64 in chunks to avoid call stack overflow
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const data = btoa(binary);

  return {
    data,
    resolvedUrl: response.url,
    contentType: response.headers.get('Content-Type') || '',
    contentDisposition: response.headers.get('Content-Disposition') || '',
  };
}

/**
 * Scan the current page for downloadable files based on the detected page type.
 */
function scanCurrentPage(detection: MoodleDetectionResult): MoodleFile[] {
  const courseName = getCourseName();

  switch (detection.pageType) {
    case 'course-view':
      return parseCourseFiles(document, courseName).flatMap((s) => s.files);

    case 'course-resources':
      return parseResourcesPage(document, courseName);

    case 'mod-folder':
      return parseFolderPage(document, courseName);

    case 'mod-resource':
    case 'mod-assign':
    case 'mod-page':
    case 'pluginfile':
    default:
      return parseCourseFiles(document, courseName).flatMap((s) => s.files);
  }
}

/**
 * Check if a string looks like a content hash rather than a human-readable name.
 */
function looksLikeHash(name: string): boolean {
  const base = name.replace(/\.\w{1,5}$/, '');
  return /^[0-9a-f]{20,}$/i.test(base);
}

/**
 * Parse the filename from a Content-Disposition header value.
 */
function parseContentDisposition(header: string | null): string {
  if (!header) return '';
  const utf8Match = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const match = header.match(/filename="?([^";\n]+)"?/i);
  if (match) return match[1].trim();
  return '';
}

/**
 * Extract filename from a URL's response-content-disposition query parameter.
 * Moodle S3-backed storage puts the filename in the signed URL query string.
 */
function extractFilenameFromQueryParam(url: string): string {
  try {
    const parsed = new URL(url);
    const disposition = parsed.searchParams.get('response-content-disposition');
    if (disposition) {
      return parseContentDisposition(disposition);
    }
  } catch {
    // Invalid URL, ignore
  }
  return '';
}

/**
 * Resolve wrapper URLs to their final download URLs by following redirects.
 * Uses GET + AbortController to follow the redirect chain without downloading
 * the full file body. The content script has Moodle session cookies.
 */
async function resolveFileUrls(files: MoodleFile[]): Promise<MoodleFile[]> {
  const results = await Promise.all(
    files.map(async (file) => {
      const isWrapper =
        file.url.includes('/mod/resource/view.php') ||
        file.url.includes('/mod/assign/view.php');

      if (!isWrapper) return file;

      try {
        // Use GET (not HEAD — Moodle often doesn't redirect on HEAD).
        // Abort immediately after getting response headers to avoid downloading the body.
        const controller = new AbortController();
        let response: Response;
        try {
          response = await fetch(file.url, {
            method: 'GET',
            redirect: 'follow',
            credentials: 'same-origin',
            signal: controller.signal,
          });
        } finally {
          controller.abort();
        }

        const resolvedUrl = response.url;
        if (resolvedUrl === file.url) return file;

        // Try multiple sources for the real filename (in priority order):
        // 1. Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        const dispositionFilename = parseContentDisposition(disposition);
        // 2. response-content-disposition query param (S3-backed Moodle)
        const queryFilename = extractFilenameFromQueryParam(resolvedUrl);
        // 3. URL path filename
        const urlFilename = extractFilename(resolvedUrl);

        // Determine the real filename from all sources
        const realFilename = dispositionFilename || queryFilename || '';

        // Get extension from multiple sources
        const realFileExt = realFilename ? extractExtension(realFilename) : '';
        const urlExt = extractExtension(resolvedUrl);
        const contentType = response.headers.get('Content-Type');
        const queryContentType = (() => {
          try {
            return new URL(resolvedUrl).searchParams.get('response-content-type') || '';
          } catch {
            return '';
          }
        })();
        const mimeExt = mimeToExtension(contentType || queryContentType || '');
        const resolvedExtension = realFileExt || urlExt || mimeExt;

        // Build display name
        let name: string;
        if (realFilename) {
          // We have a proper filename from the server
          name = realFilename;
        } else if (file.name && !looksLikeHash(file.name)) {
          // Keep original link text, append extension if needed
          if (resolvedExtension && !file.name.match(/\.\w{1,5}$/)) {
            name = `${file.name}.${resolvedExtension}`;
          } else {
            name = file.name;
          }
        } else {
          name = urlFilename !== 'unknown' ? urlFilename : file.name;
        }

        console.log(`[MoodleGrab] Resolved: "${file.name}" → "${name}" (${resolvedUrl.substring(0, 80)}...)`);

        return {
          ...file,
          url: resolvedUrl,
          name,
          extension: resolvedExtension || file.extension,
        };
      } catch (err) {
        // AbortError is expected (we abort after getting headers)
        if (err instanceof DOMException && err.name === 'AbortError') {
          // This means fetch was aborted but we should have gotten the response
          // The abort happens in the finally block, response should be captured
        }
        console.warn(`[MoodleGrab] Failed to resolve URL: ${file.url}`, err);
        return file;
      }
    }),
  );

  return results;
}

/**
 * Try to extract the course name from the page.
 */
function getCourseName(): string {
  const header = document.querySelector(
    '.page-header-headings h1, .course-header h1, [data-region="title"]',
  );
  if (header?.textContent?.trim()) return header.textContent.trim();

  const breadcrumbs = document.querySelectorAll('.breadcrumb a, .breadcrumb-item a');
  for (const crumb of breadcrumbs) {
    const href = (crumb as HTMLAnchorElement).href;
    if (href?.includes('/course/view.php')) {
      return crumb.textContent?.trim() || 'Unknown Course';
    }
  }

  return document.title.replace(/:\s*.*$/, '').trim() || 'Unknown Course';
}
