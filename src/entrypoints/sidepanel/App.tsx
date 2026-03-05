import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  FileX,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
  Settings as SettingsIcon,
} from 'lucide-react';
import type { MoodleFile, MoodleDetectionResult, QueueProgress } from '@/lib/moodle/types';
import { formatFileSize } from '@/lib/utils';
import { getSettings } from '@/lib/storage';
import DownloadHistory from '@/components/DownloadHistory';
import Settings from '@/components/Settings';
import { applyTheme } from '@/lib/theme';

type Tab = 'files' | 'history' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [detection, setDetection] = useState<MoodleDetectionResult | null>(null);
  const [files, setFiles] = useState<MoodleFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<QueueProgress | null>(null);
  const [loading, setLoading] = useState(true);

  // Apply saved theme on mount
  useEffect(() => {
    getSettings().then((s) => applyTheme(s.theme));
  }, []);

  // Check detection on mount
  useEffect(() => {
    browser.runtime
      .sendMessage({ type: 'get-detection' })
      .then((result: MoodleDetectionResult | null) => setDetection(result))
      .catch(() => setDetection(null))
      .finally(() => setLoading(false));
  }, []);

  // Listen for download progress
  useEffect(() => {
    const listener = (message: { type: string; payload: unknown }) => {
      if (message.type === 'download-progress') {
        const prog = message.payload as QueueProgress;
        setProgress(prog);
        if (prog.completedFiles + prog.failedFiles >= prog.totalFiles) {
          setDownloading(false);
        }
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const result = (await browser.runtime.sendMessage({
        type: 'scan-page',
      })) as MoodleFile[];
      setFiles(result ?? []);
      // Select all by default
      setSelectedIds(new Set((result ?? []).map((f) => f.id)));
    } catch (err) {
      console.error('[MoodleGrab] Scan failed:', err);
      setScanError(err instanceof Error ? err.message : 'Scan failed unexpectedly.');
      setFiles([]);
    } finally {
      setScanning(false);
      setHasScanned(true);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    const selected = files.filter((f) => selectedIds.has(f.id));
    if (selected.length === 0) return;

    setDownloading(true);
    setProgress(null);

    const settings = await getSettings();
    browser.runtime.sendMessage({
      type: 'download-files',
      payload: {
        files: selected,
        options: {
          concurrency: settings.concurrency,
          asZip: settings.defaultAsZip,
          zipNamePattern: settings.zipNamePattern,
          maxRetries: settings.maxRetries,
        },
      },
    });
  }, [files, selectedIds]);

  const handleCancel = useCallback(() => {
    browser.runtime.sendMessage({ type: 'cancel-downloads' });
    setDownloading(false);
  }, []);

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  const isMoodle = detection?.isMoodle === true;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'files', label: 'Files', icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'history', label: 'History', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2 px-4 py-3">
          <h1 className="text-lg font-semibold">MoodleGrab</h1>
          {isMoodle && (
            <span className="ml-auto text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Moodle{detection.version ? ` v${detection.version}` : ''}
            </span>
          )}
        </div>

        {/* Tab navigation */}
        <nav className="flex px-4 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* === Files Tab === */}
        {activeTab === 'files' && (
          <>
            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            )}

            {/* Not Moodle */}
            {!loading && !isMoodle && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <XCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Not a Moodle page</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Navigate to a Moodle course page to scan for files.
                </p>
              </div>
            )}

            {/* Scan error */}
            {!loading && isMoodle && !scanning && scanError && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Scan failed</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs break-words">
                  {scanError}
                </p>
                <button
                  onClick={handleScan}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Scan
                </button>
              </div>
            )}

            {/* Scanned but no files found */}
            {!loading && isMoodle && !scanning && !scanError && hasScanned && files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileX className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No downloadable files found on this page
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Try navigating to a course page with resources.
                </p>
                <button
                  onClick={handleScan}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Scan Again
                </button>
              </div>
            )}

            {/* Moodle detected — scan button (not yet scanned) */}
            {!loading && isMoodle && !scanning && !scanError && !hasScanned && files.length === 0 && (
              <button
                onClick={handleScan}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Search className="h-4 w-4" />
                Scan for Files
              </button>
            )}

            {/* Scanning */}
            {scanning && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning page for files...
              </div>
            )}

            {/* File list */}
            {files.length > 0 && (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === files.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                    {selectedIds.size} of {files.length} selected
                  </label>
                  <button
                    onClick={handleScan}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Re-scan page"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Files */}
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {files.map((file) => (
                    <label
                      key={file.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(file.id)}
                        onChange={() => toggleFile(file.id)}
                        className="rounded shrink-0"
                      />
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {file.extension.toUpperCase()}
                          {file.size ? ` · ${formatFileSize(file.size)}` : ''}
                          {file.sectionName ? ` · ${file.sectionName}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Download progress */}
                {downloading && progress && (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {progress.completedFiles}/{progress.totalFiles} files
                      </span>
                      <button
                        onClick={handleCancel}
                        className="text-red-500 hover:text-red-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${progress.totalFiles > 0 ? (progress.completedFiles / progress.totalFiles) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Download button */}
                {!downloading && (
                  <button
                    onClick={handleDownload}
                    disabled={selectedIds.size === 0}
                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-4 w-4" />
                    Download {selectedIds.size} file{selectedIds.size !== 1 ? 's' : ''}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* === History Tab === */}
        {activeTab === 'history' && <DownloadHistory />}

        {/* === Settings Tab === */}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
