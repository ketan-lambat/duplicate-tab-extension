// Map to store tab information: URL -> Set of tab IDs
const tabsMap = new Map();

// Get current settings
async function getSettings() {
  const settings = await chrome.storage.local.get(['showDot', 'dotColor', 'strictMatch']);
  return {
    showDot: settings.showDot !== false, // Default to true
    dotColor: settings.dotColor || '#FF0000',
    strictMatch: settings.strictMatch !== false // Default to true
  };
}

// Update the extension badge with duplicate count
function updateBadge() {
  const duplicateCount = Array.from(tabsMap.values())
    .filter(tabs => tabs.size > 1)
    .length;
  
  chrome.action.setBadgeText({ 
    text: duplicateCount > 0 ? duplicateCount.toString() : ''
  });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

// Function to normalize URL
function normalizeUrl(url, useStrictMatch = true) {
  try {
    const urlObj = new URL(url);
    // When strict match is false, remove fragment
    // When strict match is true, keep URL exactly as is
    return useStrictMatch ? url : urlObj.href.split('#')[0];
  } catch {
    return url;
  }
}

// Update tabs map when tabs change
async function updateTabsMap() {
  const [tabs, settings] = await Promise.all([
    chrome.tabs.query({}),
    getSettings()
  ]);
  
  tabsMap.clear();
  
  for (const tab of tabs) {
    if (!tab.url) continue;
    
    const normalizedUrl = normalizeUrl(tab.url, settings.strictMatch);
    
    if (!tabsMap.has(normalizedUrl)) {
      tabsMap.set(normalizedUrl, new Set());
    }
    tabsMap.get(normalizedUrl).add(tab.id);
  }
  
  updateBadge();
  notifyDuplicateTabs();
}

// Notify content scripts about duplicate status and settings
async function notifyDuplicateTabs() {
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({});
  
  for (const tab of tabs) {
    if (!tab.url) continue;
    
    const normalizedUrl = normalizeUrl(tab.url, settings.strictMatch);
    const isDuplicate = tabsMap.get(normalizedUrl)?.size > 1;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'DUPLICATE_STATUS',
        isDuplicate,
        settings
      });
    } catch (error) {
      // Tab might not be ready to receive messages
      console.error(`Error sending message to tab ${tab.id}:`, error);
    }
  }
}

// Get all duplicate tab groups
async function getDuplicateGroups() {
  const settings = await getSettings();
  const duplicates = [];
  
  for (const [url, tabIds] of tabsMap) {
    if (tabIds.size > 1) {
      const tabs = await Promise.all(
        Array.from(tabIds).map(id => chrome.tabs.get(id))
      );
      duplicates.push({
        url,
        tabs: tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          url: tab.url // Include original URL for display
        }))
      });
    }
  }
  
  return duplicates;
}

// Close a specific tab
async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  updateTabsMap();
}

// Event listeners
chrome.tabs.onCreated.addListener(updateTabsMap);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  updateTabsMap();
});
chrome.tabs.onRemoved.addListener(updateTabsMap);

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_DUPLICATES') {
    getDuplicateGroups().then(sendResponse);
    return true;  // Will respond asynchronously
  } else if (message.type === 'CLOSE_TAB') {
    closeTab(message.tabId).then(() => sendResponse({ success: true }));
    return true;
  } else if (message.type === 'SETTINGS_CHANGED') {
    // Rebuild the map with the new strict match setting, then notify tabs
    updateTabsMap();
  } else if (message.type === 'FETCH_FAVICON') {
    // Fetch favicon from background to avoid canvas taint for cross-origin favicons
    fetch(message.url)
      .then(r => r.blob())
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(() => sendResponse({ error: true }));
    return true;
  }
});

// Initialize
chrome.storage.local.get(['showDot', 'dotColor', 'strictMatch'], (settings) => {
  // Set default settings if not present
  if (!settings.hasOwnProperty('showDot')) {
    chrome.storage.local.set({ showDot: true });
  }
  if (!settings.hasOwnProperty('dotColor')) {
    chrome.storage.local.set({ dotColor: '#FF0000' });
  }
  if (!settings.hasOwnProperty('strictMatch')) {
    chrome.storage.local.set({ strictMatch: true });
  }
});

// Initial setup
updateTabsMap();
