# MoodleGrab

> Download all your Moodle course files in one click

A Chrome extension that lets university students bulk-download resources from Moodle LMS — lecture slides, tutorials, assignments, and more — organized by course section into a single ZIP file.

## Features

- **Auto-detects Moodle** — recognizes Moodle pages and scans for downloadable files
- **File browser** — tree view of all course resources organized by section
- **Bulk download** — select files and download as a structured ZIP
- **Smart URL resolution** — follows Moodle's redirect chains to get real file URLs and proper filenames
- **Concurrent downloads** — configurable parallel downloads with progress tracking
- **Side panel UI** — stays open while you browse, more space than a popup
- **File type filters** — filter by documents, images, videos, etc.

## Install (Development)

```bash
git clone <repo-url>
cd moodlegrab
npm install
npm run dev
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` folder

## Usage

1. Navigate to any Moodle course page (course view or resources page)
2. Click the MoodleGrab icon — the side panel opens
3. Click **Scan Page** to discover files
4. Select files (or select all) and click **Download**
5. Files are downloaded as a ZIP organized by section

## Build

```bash
npm run build        # Production build for Chrome
npm run build:firefox  # Production build for Firefox
```

## Test

```bash
npm test             # Run unit tests
npm run lint         # Lint code
```

## Tech Stack

- [WXT](https://wxt.dev) — Chrome extension framework (Manifest V3)
- React 19 — UI
- Tailwind CSS 4 — Styling
- Zustand — State management
- fflate — ZIP creation
- Vitest — Testing

## Permissions

| Permission | Why |
|-----------|-----|
| `activeTab` | Access current Moodle tab to scan for files |
| `scripting` | Inject content script to parse Moodle pages |
| `storage` | Save settings and download history |
| `sidePanel` | Primary UI surface |
| `downloads` | Save files to disk |

No broad host permissions — keeps the extension lightweight and review-friendly.

## License

MIT
