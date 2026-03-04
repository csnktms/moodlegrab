import { describe, it, expect, vi } from 'vitest';
import { downloadFiles } from '../../src/lib/moodle/downloader';
import type { MoodleFile, DownloadOptions } from '../../src/lib/moodle/types';

function makeFile(id: string, name: string): MoodleFile {
  return {
    id,
    name,
    url: `https://moodle.com/pluginfile.php/${id}/${name}`,
    extension: name.split('.').pop() ?? '',
  };
}

const defaultOptions: DownloadOptions = {
  concurrency: 2,
  asZip: false,
  zipNamePattern: '{courseName}_{date}',
  maxRetries: 1,
};

function mockFetch(data: Uint8Array = new Uint8Array([1, 2, 3])): typeof fetch {
  return async () =>
    new Response(data, {
      status: 200,
      headers: { 'content-length': String(data.byteLength) },
    });
}

describe('downloadFiles', () => {
  it('downloads all files and returns results', async () => {
    const files = [makeFile('1', 'a.pdf'), makeFile('2', 'b.docx')];
    const results = await downloadFiles(files, defaultOptions, {}, mockFetch());

    expect(results).toHaveLength(2);
    expect(results[0].file.name).toBe('a.pdf');
    expect(results[0].data).toBeInstanceOf(Uint8Array);
    expect(results[1].file.name).toBe('b.docx');
  });

  it('reports progress via callbacks', async () => {
    const onFileComplete = vi.fn();
    const onQueueProgress = vi.fn();

    const files = [makeFile('1', 'a.pdf')];
    await downloadFiles(files, defaultOptions, { onFileComplete, onQueueProgress }, mockFetch());

    expect(onFileComplete).toHaveBeenCalledTimes(1);
    expect(onQueueProgress).toHaveBeenCalled();
  });

  it('handles failed downloads', async () => {
    const failFetch: typeof fetch = async () => {
      throw new Error('Network error');
    };
    const onFileError = vi.fn();

    const files = [makeFile('1', 'fail.pdf')];
    const results = await downloadFiles(
      files,
      { ...defaultOptions, maxRetries: 0 },
      { onFileError },
      failFetch,
    );

    expect(results).toHaveLength(0);
    expect(onFileError).toHaveBeenCalledWith('1', 'Network error');
  });

  it('retries on failure', async () => {
    let callCount = 0;
    const retryFetch: typeof fetch = async () => {
      callCount++;
      if (callCount <= 1) throw new Error('Transient error');
      return new Response(new Uint8Array([42]), { status: 200 });
    };

    const files = [makeFile('1', 'retry.pdf')];
    const results = await downloadFiles(
      files,
      { ...defaultOptions, maxRetries: 2 },
      {},
      retryFetch,
    );

    expect(results).toHaveLength(1);
    expect(callCount).toBe(2);
  });

  it('respects HTTP error status', async () => {
    const errorFetch: typeof fetch = async () =>
      new Response('Not Found', { status: 404, statusText: 'Not Found' });
    const onFileError = vi.fn();

    const files = [makeFile('1', 'missing.pdf')];
    const results = await downloadFiles(
      files,
      { ...defaultOptions, maxRetries: 0 },
      { onFileError },
      errorFetch,
    );

    expect(results).toHaveLength(0);
    expect(onFileError).toHaveBeenCalled();
  });

  it('handles concurrent downloads', async () => {
    let maxConcurrent = 0;
    let current = 0;

    const concurrentFetch: typeof fetch = async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, 50));
      current--;
      return new Response(new Uint8Array([1]), { status: 200 });
    };

    const files = [makeFile('1', 'a.pdf'), makeFile('2', 'b.pdf'), makeFile('3', 'c.pdf')];
    await downloadFiles(files, { ...defaultOptions, concurrency: 2 }, {}, concurrentFetch);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('handles cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    const slowFetch: typeof fetch = async (_url, init) => {
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(
          () => resolve(new Response(new Uint8Array([1]), { status: 200 })),
          5000,
        );
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    };

    const files = [makeFile('1', 'slow.pdf')];

    // Cancel after a short delay
    setTimeout(() => controller.abort(), 10);

    const results = await downloadFiles(
      files,
      { ...defaultOptions, maxRetries: 0 },
      {},
      slowFetch,
      controller.signal,
    );

    expect(results).toHaveLength(0);
  });
});
