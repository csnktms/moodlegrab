import { describe, it, expect, beforeEach } from 'vitest';
import { crawl, extractCrawlableLinks, normalizeUrl } from '../../src/lib/moodle/crawler';
import { resetIdCounter } from '../../src/lib/moodle/parser';

beforeEach(() => {
  resetIdCounter();
});

describe('normalizeUrl', () => {
  it('removes hash fragments', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('sorts query parameters', () => {
    expect(normalizeUrl('https://example.com/page?b=2&a=1')).toBe(
      'https://example.com/page?a=1&b=2',
    );
  });

  it('returns original for invalid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('extractCrawlableLinks', () => {
  it('extracts folder view links', () => {
    const html = `<html><body>
      <a href="https://moodle.com/mod/folder/view.php?id=5">Folder</a>
      <a href="https://moodle.com/pluginfile.php/1/file.pdf">File</a>
      <a href="https://other.com/mod/folder/view.php?id=6">External</a>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const links = extractCrawlableLinks(doc, 'https://moodle.com/course/view.php?id=1');
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('/mod/folder/view.php');
  });

  it('extracts course and page links', () => {
    const html = `<html><body>
      <a href="https://moodle.com/course/view.php?id=2">Another course</a>
      <a href="https://moodle.com/mod/page/view.php?id=3">Page</a>
      <a href="https://moodle.com/course/resources.php?id=2">Resources</a>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const links = extractCrawlableLinks(doc, 'https://moodle.com/course/view.php?id=1');
    expect(links).toHaveLength(3);
  });

  it('skips external links', () => {
    const html = `<html><body>
      <a href="https://external.com/mod/folder/view.php?id=1">External</a>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const links = extractCrawlableLinks(doc, 'https://moodle.com/');
    expect(links).toHaveLength(0);
  });
});

describe('crawl', () => {
  it('crawls a single page and extracts files', async () => {
    const html = `<html><body>
      <a href="https://moodle.com/pluginfile.php/1/file.pdf">File</a>
      <a href="https://moodle.com/pluginfile.php/2/other.docx">Other</a>
    </body></html>`;

    const fetchPage = async () => {
      return new DOMParser().parseFromString(html, 'text/html');
    };

    const files = await crawl('https://moodle.com/course/view.php?id=1', fetchPage);
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe('file.pdf');
    expect(files[1].name).toBe('other.docx');
  });

  it('follows folder links to discover more files', async () => {
    const pages: Record<string, string> = {
      'https://moodle.com/course/view.php?id=1': `<html><body>
        <a href="https://moodle.com/pluginfile.php/1/main.pdf">Main</a>
        <a href="https://moodle.com/mod/folder/view.php?id=5">Folder</a>
      </body></html>`,
      'https://moodle.com/mod/folder/view.php?id=5': `<html><body>
        <a href="https://moodle.com/pluginfile.php/2/sub.docx">Sub</a>
      </body></html>`,
    };

    const fetchPage = async (url: string) => {
      const normalized = normalizeUrl(url);
      for (const [key, html] of Object.entries(pages)) {
        if (normalizeUrl(key) === normalized) {
          return new DOMParser().parseFromString(html, 'text/html');
        }
      }
      throw new Error('404');
    };

    const files = await crawl('https://moodle.com/course/view.php?id=1', fetchPage);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.name)).toContain('main.pdf');
    expect(files.map((f) => f.name)).toContain('sub.docx');
  });

  it('respects maxDepth', async () => {
    const pages: Record<string, string> = {
      'https://moodle.com/course/view.php?id=1': `<html><body>
        <a href="https://moodle.com/mod/folder/view.php?id=2">Folder</a>
      </body></html>`,
      'https://moodle.com/mod/folder/view.php?id=2': `<html><body>
        <a href="https://moodle.com/mod/folder/view.php?id=3">Sub-folder</a>
        <a href="https://moodle.com/pluginfile.php/1/a.pdf">A</a>
      </body></html>`,
      'https://moodle.com/mod/folder/view.php?id=3': `<html><body>
        <a href="https://moodle.com/pluginfile.php/2/deep.pdf">Deep</a>
      </body></html>`,
    };

    const fetchPage = async (url: string) => {
      const normalized = normalizeUrl(url);
      for (const [key, html] of Object.entries(pages)) {
        if (normalizeUrl(key) === normalized) {
          return new DOMParser().parseFromString(html, 'text/html');
        }
      }
      throw new Error('404');
    };

    // maxDepth=1 means: visit start (depth 0) + one level of links (depth 1)
    const files = await crawl('https://moodle.com/course/view.php?id=1', fetchPage, {
      maxDepth: 1,
    });
    expect(files.map((f) => f.name)).toContain('a.pdf');
    expect(files.map((f) => f.name)).not.toContain('deep.pdf');
  });

  it('respects maxPages', async () => {
    const fetchPage = async () => {
      return new DOMParser().parseFromString(
        `<html><body>
          <a href="https://moodle.com/pluginfile.php/${Math.random()}/file.pdf">File</a>
          <a href="https://moodle.com/mod/folder/view.php?id=${Math.random()}">Next</a>
        </body></html>`,
        'text/html',
      );
    };

    const files = await crawl('https://moodle.com/course/view.php?id=1', fetchPage, {
      maxPages: 2,
    });
    // Should have visited at most 2 pages
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.length).toBeLessThanOrEqual(2);
  });

  it('deduplicates files across pages', async () => {
    const sharedFile = 'https://moodle.com/pluginfile.php/1/shared.pdf';
    const pages: Record<string, string> = {
      'https://moodle.com/course/view.php?id=1': `<html><body>
        <a href="${sharedFile}">Shared</a>
        <a href="https://moodle.com/mod/folder/view.php?id=2">Folder</a>
      </body></html>`,
      'https://moodle.com/mod/folder/view.php?id=2': `<html><body>
        <a href="${sharedFile}">Shared Again</a>
      </body></html>`,
    };

    const fetchPage = async (url: string) => {
      const normalized = normalizeUrl(url);
      for (const [key, html] of Object.entries(pages)) {
        if (normalizeUrl(key) === normalized) {
          return new DOMParser().parseFromString(html, 'text/html');
        }
      }
      throw new Error('404');
    };

    const files = await crawl('https://moodle.com/course/view.php?id=1', fetchPage);
    expect(files).toHaveLength(1);
  });
});
