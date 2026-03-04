import { useState, useEffect, useCallback } from 'react';
import { Package, Trash2, Clock, Inbox, AlertTriangle, RotateCcw } from 'lucide-react';
import type { DownloadHistoryEntry } from '@/lib/moodle/types';
import { getHistory, clearHistory } from '@/lib/storage';
import { formatFileSize } from '@/lib/utils';

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function DownloadHistory() {
  const [history, setHistory] = useState<DownloadHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    setLoading(true);
    setError(null);
    getHistory()
      .then(setHistory)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load history'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    await clearHistory();
    setHistory([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Clock className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Could not load history</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs break-words">
          {error}
        </p>
        <button
          onClick={loadHistory}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No downloads yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Your download history will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{history.length} download{history.length !== 1 ? 's' : ''}</p>
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Clear history
        </button>
      </div>

      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-3 py-2.5"
          >
            <Package className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{entry.courseName}</p>
              <p className="text-[10px] text-gray-400">
                {entry.fileCount} file{entry.fileCount !== 1 ? 's' : ''}
                {' · '}
                {formatFileSize(entry.totalSize)}
                {' · '}
                {formatRelativeTime(entry.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
