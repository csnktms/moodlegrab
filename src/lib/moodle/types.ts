/** Moodle page types the extension can detect and work with */
export type MoodlePageType =
  | 'course-view' // /course/view.php
  | 'course-resources' // /course/resources.php
  | 'mod-folder' // /mod/folder/view.php
  | 'mod-resource' // /mod/resource/view.php
  | 'mod-assign' // /mod/assign/view.php
  | 'mod-page' // /mod/page/view.php
  | 'pluginfile' // /pluginfile.php/
  | 'unknown';

/** Result of detecting a Moodle page */
export interface MoodleDetectionResult {
  isMoodle: boolean;
  version?: string;
  siteUrl?: string;
  courseId?: string;
  pageType: MoodlePageType;
}

/** A single file discovered on a Moodle page */
export interface MoodleFile {
  id: string;
  name: string;
  url: string;
  /** MIME type if known */
  mimeType?: string;
  /** File extension (e.g. "pdf") */
  extension: string;
  /** Size in bytes, if known */
  size?: number;
  /** Last modified timestamp, if known */
  lastModified?: number;
  /** Section this file belongs to */
  sectionName?: string;
  /** Activity/module name this file belongs to */
  activityName?: string;
  /** Course name */
  courseName?: string;
}

/** A section within a Moodle course */
export interface MoodleSection {
  id: string;
  name: string;
  /** Position in the course */
  index: number;
  files: MoodleFile[];
}

/** A Moodle course with its sections and files */
export interface MoodleCourse {
  id: string;
  name: string;
  url: string;
  sections: MoodleSection[];
}

/** File type categories for filtering */
export type FileCategory = 'documents' | 'images' | 'videos' | 'audio' | 'archives' | 'other';

/** Map of file extensions to categories */
export const FILE_CATEGORY_MAP: Record<string, FileCategory> = {
  // Documents
  pdf: 'documents',
  doc: 'documents',
  docx: 'documents',
  ppt: 'documents',
  pptx: 'documents',
  xls: 'documents',
  xlsx: 'documents',
  odt: 'documents',
  odp: 'documents',
  ods: 'documents',
  txt: 'documents',
  rtf: 'documents',
  tex: 'documents',
  csv: 'documents',
  // Images
  png: 'images',
  jpg: 'images',
  jpeg: 'images',
  gif: 'images',
  svg: 'images',
  webp: 'images',
  bmp: 'images',
  // Videos
  mp4: 'videos',
  mkv: 'videos',
  avi: 'videos',
  mov: 'videos',
  webm: 'videos',
  // Audio
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  m4a: 'audio',
  // Archives
  zip: 'archives',
  rar: 'archives',
  '7z': 'archives',
  tar: 'archives',
  gz: 'archives',
};

/** Get file category from extension */
export function getFileCategory(extension: string): FileCategory {
  return FILE_CATEGORY_MAP[extension.toLowerCase()] ?? 'other';
}

/** Options for downloading files */
export interface DownloadOptions {
  /** Max concurrent downloads (1-6) */
  concurrency: number;
  /** Whether to package into a ZIP */
  asZip: boolean;
  /** ZIP file name pattern */
  zipNamePattern: string;
  /** Max auto-retry attempts */
  maxRetries: number;
}

/** Default download options */
export const DEFAULT_DOWNLOAD_OPTIONS: DownloadOptions = {
  concurrency: 3,
  asZip: true,
  zipNamePattern: '{courseName}_{date}',
  maxRetries: 3,
};

/** Status of a single file download */
export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';

/** Progress info for a single file download */
export interface FileDownloadProgress {
  fileId: string;
  status: DownloadStatus;
  /** Bytes downloaded so far */
  bytesDownloaded: number;
  /** Total bytes (if known) */
  totalBytes?: number;
  /** Error message if failed */
  error?: string;
  /** Number of retry attempts used */
  retryCount: number;
}

/** Overall download queue progress */
export interface QueueProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  downloadedBytes: number;
  /** Bytes per second */
  speed: number;
  files: FileDownloadProgress[];
}

/** User settings stored in chrome.storage */
export interface UserSettings {
  concurrency: number;
  defaultAsZip: boolean;
  zipNamePattern: string;
  theme: 'light' | 'dark' | 'system';
  autoScanOnLoad: boolean;
  maxRetries: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  concurrency: 3,
  defaultAsZip: true,
  zipNamePattern: '{courseName}_{date}',
  theme: 'system',
  autoScanOnLoad: false,
  maxRetries: 3,
};

/** A record of a past download */
export interface DownloadHistoryEntry {
  id: string;
  courseName: string;
  fileCount: number;
  totalSize: number;
  timestamp: number;
  fileUrls: string[];
}
