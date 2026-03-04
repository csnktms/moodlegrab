# MoodleGrab — Privacy Policy

**Effective date:** March 4, 2026

## Overview

MoodleGrab is a browser extension that helps students bulk-download files from Moodle LMS course pages. This privacy policy explains what data MoodleGrab collects, how it is used, and how it is stored.

**The short version: MoodleGrab collects no personal data whatsoever.**

## Data Collection

MoodleGrab does **not** collect, transmit, or store any personal data. Specifically:

- No personal information is collected
- No usage analytics or telemetry
- No tracking pixels, cookies, or fingerprinting
- No user accounts or sign-ups
- No data is sent to any server, API, or third-party service

## Local Storage

MoodleGrab stores the following data locally on your device using Chrome's `chrome.storage.local` API:

- **User preferences**: Theme setting, concurrent download limit, default file filters, and other configuration options
- **Download history**: Records of past downloads including course name, file count, total size, and date
- **Sync state**: File URLs and timestamps used to detect new files since your last download

This data:
- Never leaves your browser
- Is never transmitted to any external server
- Is never shared with any third party
- Can be cleared at any time through the extension's settings
- Is automatically removed if you uninstall the extension

## Network Requests

MoodleGrab only makes network requests to **your own Moodle site** — the site you are actively browsing. These requests are used to:
- Scan course pages for downloadable files
- Download files you have selected

No requests are made to any other domain, server, or service. MoodleGrab has no backend, no analytics endpoint, and no update server beyond Chrome's standard extension update mechanism.

## Permissions Justification

MoodleGrab requests only the minimum browser permissions required to function:

| Permission | Purpose |
|-----------|---------|
| **activeTab** | Allows MoodleGrab to access the currently active tab when you click the extension icon. Used to read the Moodle course page and scan for downloadable files. Only activates on the tab you're viewing — no background access to other tabs. |
| **scripting** | Allows MoodleGrab to inject a content script into Moodle pages. The content script parses the page DOM to extract file links, course structure, and resource metadata. Only runs on Moodle sites you visit. |
| **storage** | Allows MoodleGrab to save your preferences, download history, and sync state locally using `chrome.storage.local`. No data is synced to the cloud or transmitted externally. |
| **sidePanel** | Allows MoodleGrab to display its main interface in Chrome's side panel. The side panel provides a file browser, download queue, and settings — giving you more space than a small popup. |
| **downloads** | Allows MoodleGrab to save downloaded files (individually or as a ZIP archive) to your computer's Downloads folder using Chrome's built-in download manager. |

## Third-Party Services

MoodleGrab uses **no** third-party services. There are no analytics providers, advertising networks, crash reporters, or external APIs.

## Children's Privacy

MoodleGrab does not collect any data from any user, including children under 13.

## Changes to This Policy

If this privacy policy is updated, the changes will be noted with a new effective date at the top of this document. Since MoodleGrab collects no data, meaningful changes to this policy are unlikely.

## Contact

If you have questions about this privacy policy, please contact:

**Developer**: Tamas Csonka
**Email**: csnktms@gmail.com
**GitHub**: [https://github.com/csnktms/moodlegrab](https://github.com/csnktms/moodlegrab)

---

*MoodleGrab is open-source software licensed under the MIT License.*
