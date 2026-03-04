import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractExtension,
  extractFilename,
  isResourceUrl,
  parseCourseFiles,
  parseResourcesPage,
  parseFolderPage,
  extractFilesFromContainer,
  resetIdCounter,
} from '../../src/lib/moodle/parser';

beforeEach(() => {
  resetIdCounter();
});

describe('extractExtension', () => {
  it('extracts simple extension', () => {
    expect(extractExtension('file.pdf')).toBe('pdf');
  });

  it('extracts from URL with query string', () => {
    expect(extractExtension('https://example.com/file.docx?token=abc')).toBe('docx');
  });

  it('extracts from pluginfile URL', () => {
    expect(
      extractExtension(
        'https://moodle.com/pluginfile.php/123/mod_resource/content/0/lecture.pptx',
      ),
    ).toBe('pptx');
  });

  it('returns empty for no extension', () => {
    expect(extractExtension('https://example.com/noext')).toBe('');
  });

  it('handles hash fragments', () => {
    expect(extractExtension('file.pdf#page=2')).toBe('pdf');
  });
});

describe('extractFilename', () => {
  it('extracts filename from URL', () => {
    expect(extractFilename('https://example.com/path/to/file.pdf')).toBe('file.pdf');
  });

  it('decodes URL-encoded names', () => {
    expect(extractFilename('https://example.com/my%20file.pdf')).toBe('my file.pdf');
  });

  it('strips query string', () => {
    expect(extractFilename('https://example.com/file.pdf?v=1')).toBe('file.pdf');
  });
});

describe('isResourceUrl', () => {
  it('matches pluginfile URLs', () => {
    expect(isResourceUrl('https://moodle.com/pluginfile.php/1/mod/content/file.pdf')).toBe(true);
  });

  it('matches mod/resource URLs', () => {
    expect(isResourceUrl('https://moodle.com/mod/resource/view.php?id=1')).toBe(true);
  });

  it('matches file extension URLs', () => {
    expect(isResourceUrl('https://example.com/notes.pdf')).toBe(true);
    expect(isResourceUrl('https://example.com/slides.pptx')).toBe(true);
    expect(isResourceUrl('https://example.com/data.xlsx')).toBe(true);
  });

  it('rejects non-resource URLs', () => {
    expect(isResourceUrl('https://example.com/page.html')).toBe(false);
    expect(isResourceUrl('https://example.com/')).toBe(false);
  });

  it('rejects empty', () => {
    expect(isResourceUrl('')).toBe(false);
  });
});

describe('parseCourseFiles', () => {
  it('parses sections with resource links', () => {
    const html = `<html><body>
      <li class="section" id="section-0">
        <h3 class="sectionname">Week 1</h3>
        <div class="activity">
          <a href="https://moodle.com/pluginfile.php/1/mod/content/0/lecture1.pdf">
            <span class="instancename">Lecture 1</span>
          </a>
        </div>
        <div class="activity">
          <a href="https://moodle.com/pluginfile.php/2/mod/content/0/notes.docx">
            <span class="instancename">Notes</span>
          </a>
        </div>
      </li>
      <li class="section" id="section-1">
        <h3 class="sectionname">Week 2</h3>
        <div class="activity">
          <a href="https://moodle.com/pluginfile.php/3/mod/content/0/lecture2.pdf">
            <span class="instancename">Lecture 2</span>
          </a>
        </div>
      </li>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const sections = parseCourseFiles(doc, 'Test Course');
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe('Week 1');
    expect(sections[0].files).toHaveLength(2);
    expect(sections[0].files[0].name).toBe('lecture1.pdf');
    expect(sections[0].files[0].extension).toBe('pdf');
    expect(sections[0].files[0].courseName).toBe('Test Course');
    expect(sections[1].name).toBe('Week 2');
    expect(sections[1].files).toHaveLength(1);
  });

  it('falls back to full-page scan when no sections found', () => {
    const html = `<html><body>
      <a href="https://moodle.com/pluginfile.php/1/file.pdf">File</a>
      <a href="https://moodle.com/pluginfile.php/2/other.docx">Other</a>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const sections = parseCourseFiles(doc);
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('Resources');
    expect(sections[0].files).toHaveLength(2);
  });

  it('deduplicates same URL in a section', () => {
    const html = `<html><body>
      <li class="section">
        <h3 class="sectionname">Topic</h3>
        <a href="https://moodle.com/pluginfile.php/1/file.pdf">File</a>
        <a href="https://moodle.com/pluginfile.php/1/file.pdf">Same File</a>
      </li>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const sections = parseCourseFiles(doc);
    expect(sections[0].files).toHaveLength(1);
  });

  it('skips sections with no resource files', () => {
    const html = `<html><body>
      <li class="section">
        <h3 class="sectionname">Empty Section</h3>
        <a href="https://moodle.com/page.html">Not a resource</a>
      </li>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const sections = parseCourseFiles(doc);
    expect(sections).toHaveLength(0);
  });
});

describe('parseResourcesPage', () => {
  it('extracts from resource table', () => {
    const html = `<html><body>
      <table class="generaltable">
        <tr><td><a href="https://moodle.com/pluginfile.php/1/file.pdf">PDF</a></td></tr>
        <tr><td><a href="https://moodle.com/pluginfile.php/2/slides.pptx">Slides</a></td></tr>
      </table>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const files = parseResourcesPage(doc, 'Course');
    expect(files).toHaveLength(2);
    expect(files[0].extension).toBe('pdf');
    expect(files[1].extension).toBe('pptx');
  });
});

describe('parseFolderPage', () => {
  it('extracts from foldertree container', () => {
    const html = `<html><body>
      <div class="foldertree">
        <a href="https://moodle.com/pluginfile.php/1/a.pdf">A</a>
        <a href="https://moodle.com/pluginfile.php/2/b.docx">B</a>
      </div>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const files = parseFolderPage(doc, 'Course');
    expect(files).toHaveLength(2);
  });

  it('falls back to body when no folder container found', () => {
    const html = `<html><body>
      <a href="https://moodle.com/pluginfile.php/1/a.pdf">A</a>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const files = parseFolderPage(doc);
    expect(files).toHaveLength(1);
  });
});

describe('extractFilesFromContainer', () => {
  it('extracts activity names from context', () => {
    const html = `<html><body>
      <div class="activity">
        <a href="https://moodle.com/pluginfile.php/1/file.pdf">
          <span class="instancename">Assignment 1</span>
        </a>
      </div>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const files = extractFilesFromContainer(doc.body);
    expect(files[0].activityName).toBe('Assignment 1');
  });
});
