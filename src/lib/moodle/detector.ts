import type { MoodleDetectionResult, MoodlePageType } from './types';

/**
 * Detect the Moodle page type from a URL pathname.
 */
export function detectPageType(pathname: string): MoodlePageType {
  if (pathname.includes('/course/view.php')) return 'course-view';
  if (pathname.includes('/course/resources.php')) return 'course-resources';
  if (pathname.includes('/mod/folder/view.php')) return 'mod-folder';
  if (pathname.includes('/mod/resource/view.php')) return 'mod-resource';
  if (pathname.includes('/mod/assign/view.php')) return 'mod-assign';
  if (pathname.includes('/mod/page/view.php')) return 'mod-page';
  if (pathname.includes('/pluginfile.php')) return 'pluginfile';
  return 'unknown';
}

/**
 * Extract a query parameter value from a URL string.
 */
export function getQueryParam(url: string, param: string): string | null {
  try {
    return new URL(url).searchParams.get(param);
  } catch {
    return null;
  }
}

/**
 * Detect whether the current page is a Moodle site by inspecting the DOM.
 * Must be called from a content script context.
 */
export function detectMoodle(doc: Document, url: string): MoodleDetectionResult {
  const negative: MoodleDetectionResult = { isMoodle: false, pageType: 'unknown' };

  // Strategy 1: Look for M.cfg object in inline scripts
  const mCfg = extractMCfg(doc);
  if (mCfg) {
    return {
      isMoodle: true,
      version: mCfg.version,
      siteUrl: mCfg.wwwroot,
      courseId: getQueryParam(url, 'id') ?? undefined,
      pageType: detectPageType(new URL(url).pathname),
    };
  }

  // Strategy 2: Check for Moodle-specific meta tags or body classes
  if (hasMoodleSignatures(doc)) {
    return {
      isMoodle: true,
      courseId: getQueryParam(url, 'id') ?? undefined,
      pageType: detectPageType(new URL(url).pathname),
    };
  }

  return negative;
}

interface MCfgData {
  version?: string;
  wwwroot?: string;
}

/**
 * Try to extract Moodle's M.cfg from inline scripts on the page.
 */
export function extractMCfg(doc: Document): MCfgData | null {
  const scripts = doc.querySelectorAll('script:not([src])');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    // M.cfg is typically set as: M.cfg = { ... };
    // or via: var defined = M.cfg = { ... };
    const match = text.match(/M\.cfg\s*=\s*(\{[^}]+\})/);
    if (match) {
      try {
        // The object may use single quotes or unquoted keys, so we do a
        // lenient extraction of the values we care about.
        const version = extractJsStringProperty(match[1], 'version');
        const wwwroot = extractJsStringProperty(match[1], 'wwwroot');
        return { version: version ?? undefined, wwwroot: wwwroot ?? undefined };
      } catch {
        // Malformed — still counts as Moodle detected
        return {};
      }
    }
  }
  return null;
}

/**
 * Extract a string property value from a JS object literal string.
 * Handles both quoted and unquoted keys, single and double quotes for values.
 */
export function extractJsStringProperty(objStr: string, key: string): string | null {
  // Match: key: "value" or key: 'value' or "key": "value"
  const re = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`);
  const m = objStr.match(re);
  return m?.[1] ?? null;
}

/**
 * Check for Moodle-specific DOM signatures (body classes, meta tags, etc.)
 */
export function hasMoodleSignatures(doc: Document): boolean {
  const body = doc.body;
  if (!body) return false;

  // Moodle adds specific classes to <body>
  const bodyClasses = body.className;
  if (/\bpath-course\b/.test(bodyClasses)) return true;
  if (/\bpath-mod\b/.test(bodyClasses)) return true;
  if (/\bpagelayout-course\b/.test(bodyClasses)) return true;
  if (/\buses-moodle\b/.test(bodyClasses)) return true;

  // Moodle 4.x adds data-theme attribute
  if (body.hasAttribute('data-theme') && bodyClasses.includes('moodle')) return true;

  // Check for Moodle-specific element IDs
  if (doc.getElementById('page-wrapper') && doc.getElementById('region-main')) return true;

  // Check for Moodle footer version string
  const footer = doc.querySelector('.logininfo, .sitelink, [data-region="footer"]');
  if (footer?.textContent?.toLowerCase().includes('moodle')) return true;

  return false;
}
