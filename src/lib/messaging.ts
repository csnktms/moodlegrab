import type { MoodleFile, MoodleDetectionResult, DownloadOptions, QueueProgress } from './moodle/types';

/** Minimal type for chrome.runtime.MessageSender */
interface MessageSender {
  tab?: { id?: number; url?: string };
  frameId?: number;
  id?: string;
  url?: string;
}

/**
 * Type-safe message definitions for communication between
 * content script, background service worker, and UI (popup/sidepanel).
 */
export interface MessageMap {
  /** Content script → Background: page scan results */
  'scan-page': {
    payload: void;
    response: MoodleFile[];
  };
  /** UI → Background: start downloading files */
  'download-files': {
    payload: { files: MoodleFile[]; options: DownloadOptions };
    response: void;
  };
  /** Background → UI: download progress update */
  'download-progress': {
    payload: QueueProgress;
    response: void;
  };
  /** Content script → Background: Moodle detected on page */
  'moodle-detected': {
    payload: MoodleDetectionResult;
    response: void;
  };
  /** UI → Background: cancel all downloads */
  'cancel-downloads': {
    payload: void;
    response: void;
  };
  /** UI → Background: get detection result for active tab */
  'get-detection': {
    payload: void;
    response: MoodleDetectionResult | null;
  };
}

export type MessageType = keyof MessageMap;

export interface Message<T extends MessageType = MessageType> {
  type: T;
  payload: MessageMap[T]['payload'];
}

/**
 * Send a message to the background service worker and get a typed response.
 */
export async function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageMap[T]['payload'],
): Promise<MessageMap[T]['response']> {
  return browser.runtime.sendMessage({ type, payload });
}

/**
 * Send a message to a specific tab's content script.
 */
export async function sendTabMessage<T extends MessageType>(
  tabId: number,
  type: T,
  payload: MessageMap[T]['payload'],
): Promise<MessageMap[T]['response']> {
  return browser.tabs.sendMessage(tabId, { type, payload });
}

/**
 * Register a message handler with type safety.
 * Returns a cleanup function to remove the listener.
 */
export function onMessage<T extends MessageType>(
  type: T,
  handler: (
    payload: MessageMap[T]['payload'],
    sender: MessageSender,
  ) => Promise<MessageMap[T]['response']> | MessageMap[T]['response'],
): () => void {
  const listener = (
    message: Message,
    sender: MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type !== type) return false;

    const result = handler(message.payload as MessageMap[T]['payload'], sender);
    if (result instanceof Promise) {
      result.then(sendResponse);
      return true; // Keep channel open for async response
    }
    sendResponse(result);
    return false;
  };

  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
