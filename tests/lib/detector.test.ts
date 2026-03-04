import { describe, it, expect } from 'vitest';
import {
  detectPageType,
  detectMoodle,
  extractMCfg,
  extractJsStringProperty,
  hasMoodleSignatures,
} from '../../src/lib/moodle/detector';

describe('detectPageType', () => {
  it('detects course view', () => {
    expect(detectPageType('/course/view.php?id=2')).toBe('course-view');
  });

  it('detects course resources', () => {
    expect(detectPageType('/course/resources.php?id=2')).toBe('course-resources');
  });

  it('detects mod folder', () => {
    expect(detectPageType('/mod/folder/view.php?id=5')).toBe('mod-folder');
  });

  it('detects mod resource', () => {
    expect(detectPageType('/mod/resource/view.php?id=10')).toBe('mod-resource');
  });

  it('detects mod assign', () => {
    expect(detectPageType('/mod/assign/view.php?id=3')).toBe('mod-assign');
  });

  it('detects mod page', () => {
    expect(detectPageType('/mod/page/view.php?id=7')).toBe('mod-page');
  });

  it('detects pluginfile', () => {
    expect(detectPageType('/pluginfile.php/123/mod_resource/content/0/file.pdf')).toBe('pluginfile');
  });

  it('returns unknown for unrecognized paths', () => {
    expect(detectPageType('/admin/index.php')).toBe('unknown');
    expect(detectPageType('/')).toBe('unknown');
  });
});

describe('extractJsStringProperty', () => {
  it('extracts double-quoted value', () => {
    expect(extractJsStringProperty('{ version: "3.11.2" }', 'version')).toBe('3.11.2');
  });

  it('extracts single-quoted value', () => {
    expect(extractJsStringProperty("{ wwwroot: 'https://moodle.example.com' }", 'wwwroot')).toBe(
      'https://moodle.example.com',
    );
  });

  it('extracts with quoted key', () => {
    expect(extractJsStringProperty('{ "version": "4.1.0" }', 'version')).toBe('4.1.0');
  });

  it('returns null for missing property', () => {
    expect(extractJsStringProperty('{ version: "3.11" }', 'missing')).toBeNull();
  });
});

describe('extractMCfg', () => {
  it('extracts M.cfg from inline script', () => {
    const doc = new DOMParser().parseFromString(
      `<html><head>
        <script>M.cfg = { version: "3.11.2", wwwroot: "https://moodle.example.com" };</script>
      </head><body></body></html>`,
      'text/html',
    );
    const result = extractMCfg(doc);
    expect(result).not.toBeNull();
    expect(result!.version).toBe('3.11.2');
    expect(result!.wwwroot).toBe('https://moodle.example.com');
  });

  it('returns null when no M.cfg found', () => {
    const doc = new DOMParser().parseFromString(
      '<html><head></head><body></body></html>',
      'text/html',
    );
    expect(extractMCfg(doc)).toBeNull();
  });
});

describe('hasMoodleSignatures', () => {
  it('detects path-course body class', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body class="path-course pagelayout-course"></body></html>',
      'text/html',
    );
    expect(hasMoodleSignatures(doc)).toBe(true);
  });

  it('detects page-wrapper + region-main IDs', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><div id="page-wrapper"><div id="region-main"></div></div></body></html>',
      'text/html',
    );
    expect(hasMoodleSignatures(doc)).toBe(true);
  });

  it('returns false for non-Moodle page', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><div>Hello world</div></body></html>',
      'text/html',
    );
    expect(hasMoodleSignatures(doc)).toBe(false);
  });
});

describe('detectMoodle', () => {
  it('detects Moodle via M.cfg', () => {
    const doc = new DOMParser().parseFromString(
      `<html><head>
        <script>M.cfg = { version: "4.1.0", wwwroot: "https://learn.uni.edu" };</script>
      </head><body></body></html>`,
      'text/html',
    );
    const result = detectMoodle(doc, 'https://learn.uni.edu/course/view.php?id=42');
    expect(result.isMoodle).toBe(true);
    expect(result.version).toBe('4.1.0');
    expect(result.courseId).toBe('42');
    expect(result.pageType).toBe('course-view');
  });

  it('detects Moodle via DOM signatures', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body class="path-course"><div id="page-wrapper"><div id="region-main"></div></div></body></html>',
      'text/html',
    );
    const result = detectMoodle(doc, 'https://moodle.example.com/course/view.php?id=5');
    expect(result.isMoodle).toBe(true);
    expect(result.courseId).toBe('5');
  });

  it('returns negative for non-Moodle site', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body>Not moodle</body></html>',
      'text/html',
    );
    const result = detectMoodle(doc, 'https://example.com/page');
    expect(result.isMoodle).toBe(false);
  });
});
