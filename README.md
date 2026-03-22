# Duplicate Tab Manager

A browser extension for Microsoft Edge (and Chromium-based browsers) that detects duplicate tabs and helps you clean them up.

## Store Links
Edge Store: https://microsoftedge.microsoft.com/addons/detail/duplicate-tab-manager/gokgpbonigedidemnaildcnleigfpeep


## Look and Feel
<img width="320" height="200" alt="Tab Extension dialog ss" src="https://github.com/user-attachments/assets/981294cc-d223-4734-97f8-10124e243415" />
<img width="320" height="200" alt="Tab extension green dot ss" src="https://github.com/user-attachments/assets/325b6325-7e0e-4c25-9151-40c24ca9f901" />


## Features

- **Badge counter** — the extension icon shows how many duplicate groups are open
- **Favicon dot** — a colored dot appears on the favicon of every duplicate tab so you can spot them without opening the popup
- **Popup list** — click the icon to see all duplicate groups, jump to any tab, or close extras with one click
- **Highlights the current tab** — the popup marks whichever tab is currently active so you always know which one to keep
- **Strict / relaxed URL matching** — strict mode (default) treats `example.com/page#section1` and `example.com/page#section2` as separate tabs; turn it off to treat them as duplicates of the same page
- **Customizable dot color** — choose from presets or pick any color with the color picker
- **Keyboard shortcut** — open the popup with `Alt+Shift+A` (customizable)

## Privacy

All processing happens locally in your browser. No data is collected, transmitted, or stored externally. The only network requests made are favicon image fetches to render the dot overlay — the same requests the browser makes anyway.

---

## Installing locally (developer mode)

These steps work in **Microsoft Edge** and any other Chromium-based browser (Chrome, Brave, Arc, etc.).

**1. Download the extension files**

Download the `duplicate-tab-extension.zip` file and unzip it.

**2. Open the extensions page**

- **Edge:** navigate to `edge://extensions`
- **Chrome:** navigate to `chrome://extensions`

**3. Enable Developer mode**

Toggle the **Developer mode** switch in the top-right corner of the extensions page.

**4. Load the extension**

Click **Load unpacked**, then select the root folder of this project (the folder that contains `manifest.json`).

The extension will appear in your toolbar. If you don't see the icon, click the puzzle-piece menu and pin it.

**5. Change the keyboard shortcut (optional)**

The default shortcut is `Alt+Shift+A`. To change it:

- **Edge:** go to `edge://extensions/shortcuts`
- **Chrome:** go to `chrome://extensions/shortcuts`

Find **Duplicate Tab Manager** and click the input field next to it to record a new shortcut. Any `Ctrl/Cmd+Shift+[key]` or `Alt+Shift+[key]` combo that isn't reserved by the browser will work.

---

## File structure

```
duplicate-tab-extension/
├── manifest.json       # Extension manifest (MV3)
├── background.js       # Service worker — tracks tabs, detects duplicates
├── content.js          # Injected into every page — handles favicon dot overlay
├── popup/
│   ├── popup.html      # Popup UI markup and styles
│   └── popup.js        # Popup logic — renders duplicate groups, settings
└── icons/
    ├── icon.svg
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Permissions used

| Permission | Why it's needed |
|---|---|
| `tabs` | Query open tabs and compare URLs to detect duplicates; close tabs on request |
| `scripting` | Inject `content.js` into pages to apply the favicon dot indicator |
| `storage` | Save user preferences (dot visibility, dot color, strict match) locally on the device |
| `host_permissions: <all_urls>` | Run the content script on all pages; fetch favicon images cross-origin to render the dot overlay without canvas security errors |
