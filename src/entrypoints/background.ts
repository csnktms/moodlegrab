import { downloadFiles } from '@/lib/moodle/downloader';
import { createZipFromResults } from '@/lib/zip';
import { formatZipName } from '@/lib/zip';
import { getSettings } from '@/lib/storage';
import { addHistoryEntry } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import type { MoodleFile, MoodleDetectionResult, DownloadOptions, QueueProgress } from '@/lib/moodle/types';

/** Per-tab detection state */
const tabDetections = new Map<number, MoodleDetectionResult>();

/** Current download abort controller */
let downloadAbortController: AbortController | null = null;

export default defineBackground(() => {
  console.log('[MoodleGrab] Background service worker started.');

  // Open side panel when extension icon is clicked
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      // @ts-expect-error -- sidePanel API types not yet in WXT
      await browser.sidePanel.open({ tabId: tab.id });
    }
  });

  // Handle messages from content scripts and UI
  browser.runtime.onMessage.addListener(
    (
      message: { type: string; payload: unknown },
      sender: { tab?: { id?: number } },
      sendResponse: (response: unknown) => void,
    ) => {
      switch (message.type) {
        case 'moodle-detected':
          handleMoodleDetected(message.payload as MoodleDetectionResult, sender);
          break;

        case 'scan-page':
          handleScanPage(sender).then(sendResponse);
          return true; // Keep channel open for async

        case 'download-files':
          handleDownloadFiles(message.payload as { files: MoodleFile[]; options: DownloadOptions });
          break;

        case 'cancel-downloads':
          handleCancelDownloads();
          break;

        case 'get-detection':
          handleGetDetection(sender).then(sendResponse);
          return true;
      }
      return false;
    },
  );

  // Clean up tab state when tabs are closed
  browser.tabs.onRemoved.addListener((tabId) => {
    tabDetections.delete(tabId);
  });

  // Re-detect when tab navigates
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      tabDetections.delete(tabId);
      updateBadge(tabId, 0);
    }
  });
});

/**
 * Handle Moodle detection notification from content script.
 */
function handleMoodleDetected(
  detection: MoodleDetectionResult,
  sender: { tab?: { id?: number } },
) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  tabDetections.set(tabId, detection);
  console.log(`[MoodleGrab] Tab ${tabId}: Moodle ${detection.version ?? 'unknown'} detected`);

  // Show a green dot on the badge to indicate Moodle is detected
  browser.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
  browser.action.setBadgeText({ text: '✓', tabId });
}

/**
 * Handle scan-page request: forward to the content script of the active tab.
 */
async function handleScanPage(sender: { tab?: { id?: number } }): Promise<MoodleFile[]> {
  // If request comes from sidepanel/popup, find the active tab
  let tabId = sender.tab?.id;
  if (!tabId) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }
  if (!tabId) return [];

  try {
    const files = await browser.tabs.sendMessage(tabId, { type: 'scan-page' }) as MoodleFile[];
    updateBadge(tabId, files.length);
    return files;
  } catch (err) {
    console.warn('[MoodleGrab] Failed to scan page:', err);
    return [];
  }
}

/**
 * Handle get-detection: return the detection result for the active tab.
 */
async function handleGetDetection(
  sender: { tab?: { id?: number } },
): Promise<MoodleDetectionResult | null> {
  let tabId = sender.tab?.id;
  if (!tabId) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }
  if (!tabId) return null;
  return tabDetections.get(tabId) ?? null;
}

/**
 * Create a fetch function that tries direct fetch first, then falls back
 * to fetching through the content script (which has Moodle session cookies).
 */
function createFetchWithContentScriptFallback(tabId: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // First try direct fetch (works for S3 signed URLs, public pluginfile URLs)
    try {
      const response = await fetch(input, init);
      if (response.ok) return response;
      // If we got a non-OK response (e.g. 401/403), try content script
      console.log(`[MoodleGrab] Direct fetch returned ${response.status}, trying content script proxy`);
    } catch {
      console.log('[MoodleGrab] Direct fetch failed, trying content script proxy');
    }

    // Fallback: fetch through content script which has cookies
    const result = await browser.tabs.sendMessage(tabId, {
      type: 'fetch-file',
      payload: { url },
    }) as {
      data?: string;
      resolvedUrl?: string;
      contentType?: string;
      error?: string;
    };

    if (result.error || !result.data) {
      throw new Error(result.error || 'Content script fetch failed');
    }

    // Convert base64 back to Uint8Array
    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Create a Response-like object
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': result.contentType || 'application/octet-stream',
        'Content-Length': String(bytes.length),
      },
    });
  };
}

/**
 * Handle download-files request: download files and create ZIP.
 */
async function handleDownloadFiles(payload: {
  files: MoodleFile[];
  options: DownloadOptions;
}) {
  const { files, options } = payload;
  if (files.length === 0) return;

  // Find the active tab to use for content script fetch fallback
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;

  const settings = await getSettings();
  downloadAbortController = new AbortController();

  const callbacks = {
    onQueueProgress: (progress: QueueProgress) => {
      browser.runtime.sendMessage({
        type: 'download-progress',
        payload: progress,
      }).catch(() => {
        // Ignore if no listeners
      });
    },
  };

  // Use content-script-fallback fetch if we have a tab, otherwise plain fetch
  const fetchFn = tabId ? createFetchWithContentScriptFallback(tabId) : fetch;

  const results = await downloadFiles(
    files,
    options,
    callbacks,
    fetchFn,
    downloadAbortController.signal,
  );

  downloadAbortController = null;

  if (results.length === 0) return;

  const courseName = files[0].courseName || 'MoodleGrab';

  if (options.asZip) {
    const zipData = createZipFromResults(results, courseName);
    const zipName = formatZipName(settings.zipNamePattern, courseName);
    const dataUrl = uint8ArrayToDataUrl(zipData, 'application/zip');
    await browser.downloads.download({ url: dataUrl, filename: zipName, saveAs: true });
  } else {
    for (const result of results) {
      const dataUrl = uint8ArrayToDataUrl(result.data, 'application/octet-stream');
      await browser.downloads.download({
        url: dataUrl,
        filename: `${courseName}/${result.file.name}`,
      });
    }
  }

  await addHistoryEntry({
    id: generateId(),
    courseName,
    fileCount: results.length,
    totalSize: results.reduce((sum, r) => sum + r.data.byteLength, 0),
    timestamp: Date.now(),
    fileUrls: results.map((r) => r.file.url),
  });
}

/**
 * Cancel all in-progress downloads.
 */
function handleCancelDownloads() {
  if (downloadAbortController) {
    downloadAbortController.abort();
    downloadAbortController = null;
  }
}

/**
 * Update the badge text with file count.
 */
function updateBadge(tabId: number, count: number) {
  if (count > 0) {
    browser.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId });
    browser.action.setBadgeText({ text: String(count), tabId });
  } else {
    // Keep the checkmark if Moodle was detected
    if (tabDetections.has(tabId)) {
      browser.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
      browser.action.setBadgeText({ text: '✓', tabId });
    } else {
      browser.action.setBadgeText({ text: '', tabId });
    }
  }
}

/**
 * Convert a Uint8Array to a base64 data URL.
 * Used instead of URL.createObjectURL which isn't available in MV3 service workers.
 */
function uint8ArrayToDataUrl(data: Uint8Array, mimeType: string): string {
  let binary = '';
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
