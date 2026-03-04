import { useState, useEffect } from 'react';
import { Download, PanelRight, CheckCircle, XCircle } from 'lucide-react';
import type { MoodleDetectionResult } from '@/lib/moodle/types';

export default function App() {
  const [detection, setDetection] = useState<MoodleDetectionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    browser.runtime
      .sendMessage({ type: 'get-detection' })
      .then((result: MoodleDetectionResult | null) => {
        setDetection(result);
      })
      .catch(() => {
        setDetection(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleOpenSidePanel = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // @ts-expect-error -- sidePanel API types not yet in WXT
      await browser.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  };

  const isMoodle = detection?.isMoodle === true;

  return (
    <div className="w-72 p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <Download className="h-5 w-5 text-blue-600" />
        <h1 className="text-base font-semibold">MoodleGrab</h1>
      </div>

      {/* Detection status */}
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
        {loading ? (
          <span className="text-xs text-gray-400">Checking...</span>
        ) : isMoodle ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-xs text-green-700 dark:text-green-400">
              Moodle detected{detection.version ? ` (v${detection.version})` : ''}
            </span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Not a Moodle page
            </span>
          </>
        )}
      </div>

      <button
        onClick={handleOpenSidePanel}
        disabled={!isMoodle}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PanelRight className="h-4 w-4" />
        Open Side Panel
      </button>

      {!isMoodle && !loading && (
        <p className="mt-2 text-[10px] text-gray-400 text-center">
          Navigate to a Moodle course page to use MoodleGrab
        </p>
      )}
    </div>
  );
}
