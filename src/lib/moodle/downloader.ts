import type { MoodleFile, DownloadOptions, FileDownloadProgress, QueueProgress } from './types';

export interface DownloadResult {
  file: MoodleFile;
  data: Uint8Array;
}

export interface DownloaderCallbacks {
  onFileProgress?: (progress: FileDownloadProgress) => void;
  onQueueProgress?: (progress: QueueProgress) => void;
  onFileComplete?: (result: DownloadResult) => void;
  onFileError?: (fileId: string, error: string) => void;
}

/**
 * Download multiple files concurrently with progress tracking.
 *
 * @param files - Files to download
 * @param options - Download options (concurrency, retries, etc.)
 * @param callbacks - Progress callbacks
 * @param fetchFn - Fetch function (injected for testability, defaults to global fetch)
 * @param signal - AbortSignal for cancellation
 * @returns Array of successful download results
 */
export async function downloadFiles(
  files: MoodleFile[],
  options: DownloadOptions,
  callbacks: DownloaderCallbacks = {},
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  const progressMap = new Map<string, FileDownloadProgress>();
  const startTime = Date.now();

  // Initialize progress for all files
  for (const file of files) {
    progressMap.set(file.id, {
      fileId: file.id,
      status: 'pending',
      bytesDownloaded: 0,
      totalBytes: file.size,
      retryCount: 0,
    });
  }

  const emitQueueProgress = () => {
    const fileProgresses = Array.from(progressMap.values());
    const completed = fileProgresses.filter((p) => p.status === 'completed').length;
    const failed = fileProgresses.filter((p) => p.status === 'failed').length;
    const downloaded = fileProgresses.reduce((sum, p) => sum + p.bytesDownloaded, 0);
    const total = fileProgresses.reduce((sum, p) => sum + (p.totalBytes ?? 0), 0);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0 ? downloaded / elapsed : 0;

    callbacks.onQueueProgress?.({
      totalFiles: files.length,
      completedFiles: completed,
      failedFiles: failed,
      totalBytes: total,
      downloadedBytes: downloaded,
      speed,
      files: fileProgresses,
    });
  };

  // Process files with concurrency limit
  const queue = [...files];
  const active: Promise<void>[] = [];

  const processNext = async (): Promise<void> => {
    while (queue.length > 0) {
      if (signal?.aborted) return;

      const file = queue.shift()!;
      const progress = progressMap.get(file.id)!;

      progress.status = 'downloading';
      callbacks.onFileProgress?.(progress);
      emitQueueProgress();

      const result = await downloadWithRetry(file, options.maxRetries, progress, callbacks, fetchFn, signal);
      if (result) {
        results.push(result);
      }
      emitQueueProgress();
    }
  };

  // Start N workers
  for (let i = 0; i < Math.min(options.concurrency, files.length); i++) {
    active.push(processNext());
  }

  await Promise.all(active);
  return results;
}

/**
 * Download a single file with retry logic.
 */
async function downloadWithRetry(
  file: MoodleFile,
  maxRetries: number,
  progress: FileDownloadProgress,
  callbacks: DownloaderCallbacks,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<DownloadResult | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      progress.status = 'cancelled';
      callbacks.onFileProgress?.(progress);
      return null;
    }

    try {
      const response = await fetchFn(file.url, { signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        progress.totalBytes = parseInt(contentLength, 10);
      }

      const data = await readResponseWithProgress(response, progress, callbacks);

      progress.status = 'completed';
      progress.bytesDownloaded = data.byteLength;
      callbacks.onFileProgress?.(progress);

      const result: DownloadResult = { file, data };
      callbacks.onFileComplete?.(result);
      return result;
    } catch (err) {
      if (signal?.aborted) {
        progress.status = 'cancelled';
        callbacks.onFileProgress?.(progress);
        return null;
      }

      progress.retryCount = attempt + 1;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (attempt >= maxRetries) {
        progress.status = 'failed';
        progress.error = errorMsg;
        callbacks.onFileProgress?.(progress);
        callbacks.onFileError?.(file.id, errorMsg);
        return null;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);

      // Reset progress for retry
      progress.bytesDownloaded = 0;
      progress.status = 'downloading';
      callbacks.onFileProgress?.(progress);
    }
  }

  return null;
}

/**
 * Read a response body while tracking progress.
 */
async function readResponseWithProgress(
  response: Response,
  progress: FileDownloadProgress,
  callbacks: DownloaderCallbacks,
): Promise<Uint8Array> {
  // If no body or no reader, fall back to arrayBuffer
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.byteLength;
    progress.bytesDownloaded = received;
    callbacks.onFileProgress?.({ ...progress });
  }

  // Combine chunks
  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
