import type { MoodleFile, MoodleSection } from './types';

let fileIdCounter = 0;

/** Reset the ID counter (useful for tests) */
export function resetIdCounter(): void {
  fileIdCounter = 0;
}

/** Generate a unique file ID */
function nextId(): string {
  return `file-${++fileIdCounter}`;
}

/**
 * Extract the file extension from a URL or filename.
 */
export function extractExtension(urlOrName: string): string {
  // Strip query string and hash
  const clean = urlOrName.split('?')[0].split('#')[0];
  const lastSlash = clean.lastIndexOf('/');
  const filename = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return filename.slice(dotIndex + 1).toLowerCase();
}

/**
 * Extract the filename from a URL.
 */
export function extractFilename(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  const lastSlash = clean.lastIndexOf('/');
  const name = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  return decodeURIComponent(name) || 'unknown';
}

/**
 * Try to guess a file extension from a display name (e.g. "Lecture Notes.pdf" → "pdf").
 */
export function guessExtensionFromName(name: string): string {
  const match = name.match(/\.(\w{1,5})$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Check if a URL is a Moodle resource/file link.
 */
export function isResourceUrl(url: string): boolean {
  if (!url) return false;
  // Exclude navigational Moodle pages (folder/page views are not direct file links)
  if (
    url.includes('/mod/folder/view.php') ||
    url.includes('/mod/page/view.php') ||
    url.includes('/course/view.php') ||
    url.includes('/course/resources.php')
  ) {
    return false;
  }
  return (
    url.includes('/pluginfile.php/') ||
    url.includes('/mod/resource/view.php') ||
    url.includes('/mod_folder/content/') ||
    /\.(pdf|docx?|pptx?|xlsx?|odt|odp|ods|txt|rtf|tex|csv|png|jpe?g|gif|svg|webp|bmp|mp[34]|mkv|avi|mov|webm|wav|ogg|flac|m4a|zip|rar|7z|tar|gz)(\?|$)/i.test(
      url,
    )
  );
}

/**
 * Parse a Moodle course page and extract all file resources.
 * Must be called with the course page's document.
 */
export function parseCourseFiles(doc: Document, courseName?: string): MoodleSection[] {
  const sections: MoodleSection[] = [];

  // Moodle wraps each topic/week in a <li> with class "section"
  const sectionElements = doc.querySelectorAll(
    'li.section, [data-region="section"], .course-section',
  );

  if (sectionElements.length > 0) {
    sectionElements.forEach((el, index) => {
      const section = parseSectionElement(el, index, courseName);
      if (section.files.length > 0) {
        sections.push(section);
      }
    });
  } else {
    // Fallback: scan the whole page for resource links
    const files = extractFilesFromContainer(doc.body, courseName);
    if (files.length > 0) {
      sections.push({
        id: 'section-0',
        name: 'Resources',
        index: 0,
        files,
      });
    }
  }

  return sections;
}

/**
 * Parse a single section element and extract its files.
 */
function parseSectionElement(
  el: Element,
  index: number,
  courseName?: string,
): MoodleSection {
  // Section name from header
  const headerEl = el.querySelector(
    '.sectionname, .section-title, [data-region="section-title"], h3',
  );
  const name = headerEl?.textContent?.trim() || `Section ${index + 1}`;

  const sectionId = el.getAttribute('id') || `section-${index}`;
  const files = extractFilesFromContainer(el, courseName, name);

  return { id: sectionId, name, index, files };
}

/**
 * Extract MoodleFile entries from all links in a container element.
 */
export function extractFilesFromContainer(
  container: Element | Document,
  courseName?: string,
  sectionName?: string,
): MoodleFile[] {
  const files: MoodleFile[] = [];
  const seen = new Set<string>();

  const links = container.querySelectorAll('a[href]');
  for (const link of links) {
    const href = (link as HTMLAnchorElement).href;
    if (!href || seen.has(href)) continue;
    if (!isResourceUrl(href)) continue;

    seen.add(href);

    // Try to get a nice activity name from the link context
    const activityEl = link.closest('.activity, .activityinstance, [data-activityname]');
    const activityName =
      activityEl?.querySelector('.instancename, .activityname')?.textContent?.trim() ??
      undefined;

    // For wrapper URLs like /mod/resource/view.php, use link text as filename
    const isWrapperUrl =
      href.includes('/mod/resource/view.php') || href.includes('/mod/assign/view.php');
    const linkText = link.textContent?.trim();
    const urlFilename = extractFilename(href);
    const name = isWrapperUrl && linkText ? linkText : urlFilename;
    const extension = extractExtension(href) || guessExtensionFromName(name);

    files.push({
      id: nextId(),
      name,
      url: href,
      extension,
      courseName,
      sectionName,
      activityName,
    });
  }

  return files;
}

/**
 * Parse the "All resources" page (/course/resources.php).
 */
export function parseResourcesPage(doc: Document, courseName?: string): MoodleFile[] {
  const files: MoodleFile[] = [];
  const seen = new Set<string>();

  // The resources page typically has a table with links
  const links = doc.querySelectorAll('table a[href], .generaltable a[href], .resourceworkaround a[href]');
  for (const link of links) {
    const href = (link as HTMLAnchorElement).href;
    if (!href || seen.has(href)) continue;
    if (!isResourceUrl(href)) continue;

    seen.add(href);

    // For wrapper URLs, use link text as the filename
    const isWrapperUrl =
      href.includes('/mod/resource/view.php') || href.includes('/mod/assign/view.php');
    const linkText = link.textContent?.trim();
    const urlFilename = extractFilename(href);
    const name = isWrapperUrl && linkText ? linkText : urlFilename;
    const extension = extractExtension(href) || guessExtensionFromName(name);

    // Try to get section from the table row
    const row = link.closest('tr');
    const sectionCell = row?.querySelector('td:first-child, .c0');
    const sectionName = sectionCell?.textContent?.trim() || undefined;

    files.push({
      id: nextId(),
      name,
      url: href,
      extension,
      courseName,
      sectionName,
    });
  }

  // Fallback to full page scan if table yielded nothing
  if (files.length === 0) {
    return extractFilesFromContainer(doc.body, courseName);
  }

  return files;
}

/**
 * Map common MIME types to file extensions.
 * Used as a fallback when the URL doesn't contain an extension.
 */
export function mimeToExtension(mimeType: string): string {
  const mime = mimeType.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/gzip': 'gz',
    'application/x-tar': 'tar',
    'application/rtf': 'rtf',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/html': 'html',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'application/ogg': 'ogg',
  };
  return map[mime] || '';
}

/**
 * Parse a folder view page (/mod/folder/view.php).
 */
export function parseFolderPage(doc: Document, courseName?: string): MoodleFile[] {
  const container = doc.querySelector('.foldertree, .filemanager, #folder_tree0, .box.generalbox');
  if (!container) {
    return extractFilesFromContainer(doc.body, courseName);
  }
  return extractFilesFromContainer(container, courseName);
}
