// Store original favicon URL and modified favicon cache
let originalFaviconUrl = null;
let modifiedFaviconCache = new Map();
let currentSettings = {
  showDot: true,
  dotColor: '#FF0000'
};
let isDuplicateTab = false;
let faviconObserver = null;

// Function to get current favicon URL
function getCurrentFaviconUrl() {
  const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  return favicon ? favicon.href : new URL('/favicon.ico', location.href).href;
}

// Fetch a favicon as a data URL via the background script (avoids canvas taint
// for cross-origin favicons). Falls back to direct fetch for data: / blob: URLs.
async function loadFaviconAsDataUrl(url) {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url; // already usable as-is
  }
  try {
    const response = await chrome.runtime.sendMessage({ type: 'FETCH_FAVICON', url });
    return response?.dataUrl || null;
  } catch {
    return null;
  }
}

// Function to modify favicon
async function modifyFavicon(isDuplicate) {
  try {
    // If dot is disabled or not a duplicate, restore original favicon
    if (!currentSettings.showDot || !isDuplicate) {
      if (originalFaviconUrl) {
        updateFavicon(originalFaviconUrl);
      }
      return;
    }

    // Save original favicon URL if not already saved
    if (!originalFaviconUrl) {
      originalFaviconUrl = getCurrentFaviconUrl();
    }

    // Capture color now — used for both the cache key and drawing,
    // so they stay consistent even if settings change during the async fetch
    const dotColor = currentSettings.dotColor;
    const cacheKey = `${originalFaviconUrl}-${dotColor}`;

    // Check if we already have a modified version cached
    if (modifiedFaviconCache.has(cacheKey)) {
      updateFavicon(modifiedFaviconCache.get(cacheKey));
      return;
    }

    // Load the favicon as a data URL (via background script to avoid canvas taint
    // for cross-origin favicons, since the background script has <all_urls> permission)
    const imgSrc = await loadFaviconAsDataUrl(originalFaviconUrl);
    if (!imgSrc) return; // couldn't load — leave favicon unchanged

    // Re-check state after the async fetch — settings or duplicate status may have changed
    if (!currentSettings.showDot || !isDuplicateTab) return;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgSrc;
    });

    // Draw original favicon with dot overlay
    const canvas = document.createElement('canvas');
    const size = Math.max(img.width, img.height, 32);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0, size, size);

    const dotSize = Math.max(8, size / 3);
    ctx.beginPath();
    ctx.arc(size - dotSize/2, dotSize/2, dotSize/2, 0, 2 * Math.PI);
    ctx.fillStyle = dotColor;
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    const modifiedFavicon = canvas.toDataURL('image/png');
    modifiedFaviconCache.set(cacheKey, modifiedFavicon);
    updateFavicon(modifiedFavicon);
  } catch (error) {
    console.error('Error modifying favicon:', error);
  }
}

// Function to update favicon in the document
function updateFavicon(url) {
  let link = document.querySelector('link[rel="icon"]') ||
             document.querySelector('link[rel="shortcut icon"]');
  
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  
  link.type = 'image/x-icon';
  link.href = url;
}

// Watch for the page changing its own favicon and re-apply the dot
function observeFaviconChanges() {
  if (faviconObserver) return;

  faviconObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Handle newly added <link rel="icon"> elements
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'LINK' && /icon/i.test(node.rel || '') && !node.href.startsWith('data:')) {
          if (node.href === originalFaviconUrl) return; // our own restoration, ignore
          originalFaviconUrl = node.href;
          modifiedFaviconCache.clear();
          if (isDuplicateTab) modifyFavicon(true);
          return;
        }
      }
      // Handle href attribute changes on existing <link rel="icon"> elements
      if (
        mutation.type === 'attributes' &&
        mutation.target.nodeName === 'LINK' &&
        /icon/i.test(mutation.target.rel || '') &&
        !mutation.target.href.startsWith('data:')
      ) {
        if (mutation.target.href === originalFaviconUrl) return; // our own restoration, ignore
        originalFaviconUrl = mutation.target.href;
        modifiedFaviconCache.clear();
        if (isDuplicateTab) modifyFavicon(true);
        return;
      }
    }
  });

  faviconObserver.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href']
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'DUPLICATE_STATUS') {
    // Update settings if provided
    if (message.settings) {
      const settingsChanged = message.settings.showDot !== currentSettings.showDot ||
                             message.settings.dotColor !== currentSettings.dotColor;

      currentSettings = message.settings;

      // Clear cache if settings changed
      if (settingsChanged) {
        modifiedFaviconCache.clear();
      }
    }

    isDuplicateTab = message.isDuplicate;
    if (isDuplicateTab) observeFaviconChanges();
    modifyFavicon(isDuplicateTab);
  }
});
