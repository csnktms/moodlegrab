# MoodleGrab — Chrome Extension Build Plan

## Context

Build **MoodleGrab** from scratch — a Chrome extension that lets students bulk-download resources from Moodle LMS. Target: Chrome Web Store publication. This is a greenfield project in an empty folder.

## Project Identity

- **Name**: MoodleGrab
- **Tagline**: "Download all your Moodle course files in one click"
- **Target audience**: University/college students
- **License**: MIT
- **Chrome Web Store**: Yes

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Extension framework | **WXT** (wxt.dev) | Modern Manifest V3 framework, HMR, cross-browser support, TypeScript-first |
| UI framework | **React 19** | User preference |
| Styling | **Tailwind CSS 4** | Utility-first, tree-shakes to tiny CSS |
| UI components | **Tailwind CSS only** | Custom components with Tailwind utilities, no component library |
| State management | **Zustand** | Tiny, simple, works great in extensions |
| ZIP creation | **fflate** | Faster and smaller than JSZip |
| Icons | **Lucide React** | Clean, consistent icon set |
| Build | **WXT built-in (Vite)** | Fast builds, HMR in dev |
| Testing | **Vitest + Testing Library** | Fast, Vite-native |
| Linting | **ESLint 9 + Prettier** | Flat config |
| Package manager | **npm** | Standard, no extra install needed |

---

## Architecture Overview

```
moodlegrab/
├── public/
│   └── icon/                    # Extension icons (16, 32, 48, 128)
├── src/
│   ├── entrypoints/
│   │   ├── popup/               # Popup entry (React)
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── index.html
│   │   │   └── style.css
│   │   ├── sidepanel/           # Side Panel entry (React) — main UI
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── index.html
│   │   │   └── style.css
│   │   ├── background.ts       # Service worker
│   │   └── content.ts          # Content script (injected into Moodle pages)
│   ├── components/
│   │   ├── ui/                  # Reusable base components (Tailwind)
│   │   ├── FileTree.tsx         # Tree view of course files
│   │   ├── DownloadQueue.tsx    # Active downloads with progress
│   │   ├── CourseList.tsx       # List of detected courses
│   │   ├── FilterBar.tsx       # File type filters
│   │   ├── DownloadHistory.tsx  # Past downloads
│   │   └── Settings.tsx        # User preferences
│   ├── lib/
│   │   ├── moodle/
│   │   │   ├── detector.ts     # Detect Moodle pages & version
│   │   │   ├── parser.ts       # Parse course pages, extract resources
│   │   │   ├── crawler.ts      # BFS crawl folders/sections
│   │   │   ├── downloader.ts   # Concurrent file downloader
│   │   │   └── types.ts        # Moodle-specific types
│   │   ├── zip.ts              # ZIP creation with fflate
│   │   ├── storage.ts          # chrome.storage wrapper (settings, history)
│   │   ├── messaging.ts        # Type-safe chrome messaging
│   │   └── utils.ts            # Filename sanitization, size formatting, etc.
│   ├── stores/
│   │   ├── downloadStore.ts    # Download queue & progress state
│   │   ├── fileStore.ts        # Discovered files state
│   │   └── settingsStore.ts    # User preferences state
│   └── types/
│       └── index.ts            # Shared types
├── tests/
│   ├── lib/
│   │   ├── parser.test.ts
│   │   ├── crawler.test.ts
│   │   └── downloader.test.ts
│   └── components/
│       └── FileTree.test.tsx
├── wxt.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .eslintrc.js
├── .prettierrc
└── README.md
```

---

## Features — Detailed Spec

### 1. Moodle Page Detection (content script)
- Auto-detect when user is on a Moodle site (look for Moodle-specific DOM elements, meta tags, `M.cfg` JS object)
- Detect Moodle version from `M.cfg.version` or page footer
- Support page types:
  - `/course/view.php` — course main page
  - `/course/resources.php` — all resources list
  - `/mod/folder/view.php` — folder view
  - `/mod/resource/view.php` — single resource
  - `/pluginfile.php/` — direct file links
  - `/mod/assign/view.php` — assignment attachments
  - `/mod/page/view.php` — page resources
- Badge on extension icon shows file count when Moodle detected

### 2. Side Panel UI (primary interface)
- Opens via extension icon click or keyboard shortcut
- **Why side panel**: More space than popup, stays open while browsing, better UX
- The popup acts as a minimal launcher that opens the side panel

### 3. File Browser / Tree View
- Tree structure: Course → Section → Activity → Files
- Checkboxes at every level (select all, select section, select individual files)
- Show file metadata: name, type icon, size, date modified (if available)
- Color-coded file type indicators (PDF=red, DOCX=blue, PPTX=orange, etc.)
- Search/filter within the tree
- Expand/collapse all

### 4. File Type Filters
- Quick filter buttons: Documents, Images, Videos, Audio, Archives, Other
- Custom filter by extension (e.g., "only .pdf and .pptx")
- Size filter (e.g., "skip files > 100MB")
- Filters persist across sessions

### 5. Concurrent Downloads with Queue
- Download selected files in parallel (configurable: 1-6 concurrent, default 3)
- Per-file progress bars
- Overall progress bar with ETA
- Pause/resume individual files or entire queue
- Retry failed downloads (auto-retry up to 3 times with exponential backoff)
- Cancel downloads
- Download speed indicator

### 6. Smart ZIP Packaging
- Organize files in ZIP by: Course Name / Section Name / filename
- Handle duplicate filenames (append counter: `file (1).pdf`, `file (2).pdf`)
- Option to download as individual files instead of ZIP
- Configurable ZIP naming: `CourseName_YYYY-MM-DD.zip`
- Stream files into ZIP (memory efficient, don't hold all files in RAM)

### 7. Download History
- Track all past downloads with timestamps
- Show: course name, file count, total size, date
- Re-download previous bundles
- Clear history option
- Stored in `chrome.storage.local`

### 8. Incremental Sync / "What's New"
- Remember last scan per course (store file hashes/URLs + timestamps)
- Highlight new files since last download
- "Download new only" button
- Badge notification when new files detected on revisit

### 9. Settings / Preferences
- Concurrent download limit (1-6)
- Default file type filters
- ZIP vs individual files
- Filename sanitization rules
- Dark/light/system theme
- Download folder naming pattern
- Auto-scan on page load (on/off)

### 10. Dark Mode
- System preference detection (`prefers-color-scheme`)
- Manual toggle in settings
- Tailwind `dark:` classes throughout

### 11. Cross-Browser (stretch goal, architecture supports it)
- WXT handles Chrome + Firefox builds from same codebase
- Firefox uses `browser_action` instead of `action`
- Keep browser-specific code minimal

---

## Implementation Phases

### Phase 1: Project Setup & Scaffolding
1. Initialize project with `npx wxt@latest init . --template react`
2. Install dependencies: tailwind, zustand, fflate, lucide-react
3. Configure Tailwind CSS 4
4. Set up ESLint 9 flat config + Prettier
5. Set up basic folder structure
6. Configure `wxt.config.ts` with proper permissions and manifest fields
7. Create extension icons (simple placeholder — colored "M" with download arrow)

### Phase 2: Core Moodle Logic (no UI yet)
1. `detector.ts` — Moodle page detection logic
2. `parser.ts` — Extract resource links from course pages
3. `crawler.ts` — BFS traversal of folders/sections with depth limit
4. `types.ts` — All Moodle types (MoodleFile, MoodleCourse, MoodleSection, etc.)
5. `downloader.ts` — Concurrent downloader with progress callbacks
6. `zip.ts` — ZIP creation with fflate streaming
7. `messaging.ts` — Type-safe messaging between content script, background, and UI
8. `storage.ts` — chrome.storage wrapper for settings and history
9. Write unit tests for parser, crawler, and downloader

### Phase 3: Background & Content Scripts
1. `background.ts` — Service worker: handle messages, manage downloads, badge updates
2. `content.ts` — Content script: detect Moodle, scan page, communicate with background
3. Wire up messaging between all parts

### Phase 4: Side Panel UI
1. Basic layout with header, navigation tabs
2. `CourseList.tsx` — Show detected courses
3. `FileTree.tsx` — Tree view with checkboxes, file icons, sizes
4. `FilterBar.tsx` — File type filter buttons + search
5. `DownloadQueue.tsx` — Active downloads with progress bars
6. `DownloadHistory.tsx` — Past downloads list
7. `Settings.tsx` — All preferences

### Phase 5: Popup (minimal launcher)
1. Simple popup that shows Moodle detection status
2. "Open Side Panel" button
3. Quick download button for simple use case

### Phase 6: Polish & Advanced Features
1. Incremental sync / "what's new" detection
2. Keyboard shortcuts
3. Error boundary + error states in UI
4. Empty states with helpful illustrations
5. Onboarding — first-time tooltip/guide
6. Performance optimization (virtualized tree for large courses)

### Phase 7: Store Preparation
1. Write Chrome Web Store listing description
2. Create promotional images (screenshots)
3. Privacy policy (the extension collects zero data)
4. Final testing across Moodle 3.x and 4.x sites

---

## Key Technical Decisions

### WXT Entrypoints
```ts
// wxt.config.ts
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MoodleGrab',
    description: 'Download all your Moodle course files in one click',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel', 'downloads'],
    action: {}, // Required for side panel
    side_panel: {
      default_path: 'sidepanel.html'
    }
  }
});
```

### Messaging Protocol
```ts
// Type-safe messages between extension parts
type Messages = {
  'scan-page': { payload: void; response: MoodleFile[] };
  'download-files': { payload: { files: MoodleFile[]; options: DownloadOptions }; response: void };
  'download-progress': { payload: DownloadProgress; response: void };
  'moodle-detected': { payload: { version: string; courseId: string }; response: void };
};
```

### Download Queue Architecture
- Background service worker owns the download queue (survives popup/sidepanel close)
- UI subscribes to progress updates via messaging
- Files downloaded via `fetch()` in content script (has Moodle session cookies)
- Blobs passed to background for ZIP assembly
- Final ZIP triggered via `chrome.downloads.download()`

### State Flow
```
Content Script (Moodle page)
    ↓ scans page, extracts file list
Background Service Worker
    ↓ manages download queue, ZIP assembly
Side Panel UI (React)
    ↓ displays tree, progress, controls
```

---

## Manifest Permissions Justification (for Chrome Web Store review)

| Permission | Why |
|-----------|-----|
| `activeTab` | Access current Moodle tab to scan for files |
| `scripting` | Inject content script to parse Moodle pages |
| `storage` | Save settings, download history, sync state |
| `sidePanel` | Primary UI surface |
| `downloads` | Trigger file downloads to user's disk |

No `<all_urls>`, no `host_permissions` with wildcards — keeps review smooth.

---

## Commands to Get Started

```bash
# In the empty moodlegrab/ folder:
npx wxt@latest init . --template react
npm install
npm install zustand fflate lucide-react
npm install -D tailwindcss @tailwindcss/vite
npm run dev  # starts dev mode with HMR
```

---

## Testing Strategy

- **Unit tests**: Parser, crawler, downloader, ZIP logic (Vitest)
- **Component tests**: FileTree, DownloadQueue (Vitest + Testing Library)
- **Manual E2E**: Test against Moodle demo site (https://school.moodledemo.net/)
- **Run**: `npm test`
- **CI**: GitHub Actions — lint + test on push/PR

---

## Verification

After each phase, verify by:
1. `npm dev` — extension loads in Chrome without errors
2. Navigate to Moodle demo site, verify detection works
3. Check console for errors
4. Test download flow end-to-end
5. `npm test` — all tests pass
6. `npm build` — production build succeeds

