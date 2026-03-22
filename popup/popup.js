// Get the container for duplicate tabs and settings elements
const duplicateList = document.getElementById('duplicateList');
const showDotToggle = document.getElementById('showDotToggle');
const dotColorPicker = document.getElementById('dotColor');
const colorOptions = document.querySelectorAll('.color-option');
const colorButton = document.getElementById('colorButton');
const colorMenu = colorButton.parentElement;
const strictMatchToggle = document.getElementById('strictMatchToggle');

// Load settings from storage
async function loadSettings() {
  const settings = await chrome.storage.local.get(['showDot', 'dotColor', 'strictMatch']);
  showDotToggle.checked = settings.showDot !== false; // Default to true
  const color = settings.dotColor || '#FF0000';
  dotColorPicker.value = color;
  colorButton.style.background = color;
  strictMatchToggle.checked = settings.strictMatch !== false; // Default to true
  
  // Update color palette selection
  colorOptions.forEach(option => {
    if (option.dataset.color === color) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });
}

// Save settings and notify all tabs
async function updateSettings(color) {
  const settings = {
    showDot: showDotToggle.checked,
    dotColor: color || dotColorPicker.value,
    strictMatch: strictMatchToggle.checked
  };
  
  // Update color picker and selection
  dotColorPicker.value = settings.dotColor;
  colorButton.style.background = settings.dotColor;
  colorOptions.forEach(option => {
    option.classList.toggle('selected', option.dataset.color === settings.dotColor);
  });
  
  await chrome.storage.local.set(settings);
  
  // Notify background script of settings change
  await chrome.runtime.sendMessage({
    type: 'SETTINGS_CHANGED',
    settings
  });

  // Refresh duplicate list to update favicons in popup
  updateDuplicatesList();
}

// Handle color menu toggle
colorButton.addEventListener('click', (e) => {
  e.stopPropagation();
  colorMenu.classList.toggle('open');
});

// Close color menu when clicking outside
document.addEventListener('click', (e) => {
  if (!colorMenu.contains(e.target)) {
    colorMenu.classList.remove('open');
  }
});

// Add event listeners for settings changes
showDotToggle.addEventListener('change', () => updateSettings());
dotColorPicker.addEventListener('input', (e) => {
  updateSettings(e.target.value);
  colorOptions.forEach(option => option.classList.remove('selected'));
});
strictMatchToggle.addEventListener('change', () => updateSettings());

// Add click handlers for color options
colorOptions.forEach(option => {
  option.addEventListener('click', () => {
    const color = option.dataset.color;
    if (color) {
      updateSettings(color);
    }
  });
});

// Function to focus a specific tab
async function focusTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch (error) {
    console.error('Error focusing tab:', error);
  }
}

// Function to highlight differences in URLs
function highlightUrlDifferences(url) {
  try {
    const urlObj = new URL(url);
    const baseUrl = url.split('#')[0];
    const fragment = urlObj.hash;
    
    if (fragment) {
      return `${baseUrl}<span class="url-highlight">${fragment}</span>`;
    }
    
    return url;
  } catch {
    return url;
  }
}

// Function to normalize URL for display
function normalizeUrlForDisplay(url, useStrictMatch) {
  try {
    const urlObj = new URL(url);
    if (!useStrictMatch) {
      urlObj.hash = '';
    }
    return urlObj.href;
  } catch {
    return url;
  }
}

// Function to create a favicon element with dot indicator
function createFaviconWithDot(tabUrl, originalFavIconUrl) {
  const canvas = document.createElement('canvas');
  const size = 16; // Size for popup favicon
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.crossOrigin = 'Anonymous';

  return new Promise((resolve) => {
    img.onload = () => {
      // Draw original favicon
      ctx.drawImage(img, 0, 0, size, size);

      if (showDotToggle.checked) {
        // Add dot with selected color
        const dotSize = Math.max(4, size / 3);
        ctx.beginPath();
        ctx.arc(size - dotSize/2, dotSize/2, dotSize/2, 0, 2 * Math.PI);
        ctx.fillStyle = dotColorPicker.value;
        ctx.fill();
        
        // Add white border around dot
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      // Create a default favicon if original can't be loaded
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2 - 1, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (showDotToggle.checked) {
        // Add dot
        const dotSize = Math.max(4, size / 3);
        ctx.beginPath();
        ctx.arc(size - dotSize/2, dotSize/2, dotSize/2, 0, 2 * Math.PI);
        ctx.fillStyle = dotColorPicker.value;
        ctx.fill();
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      resolve(canvas.toDataURL('image/png'));
    };

    img.src = originalFavIconUrl || '../icons/icon16.png';
  });
}

// Function to create a tab item element
async function createTabItem(tab, onClose, activeTab) {
  const tabItem = document.createElement('div');
  tabItem.className = 'tab-item';
  // Add active class if this tab matches the active tab
  if (activeTab && tab.id === activeTab.id) {
    tabItem.classList.add('active');
  }

  // Create clickable container for favicon and title
  const clickableContent = document.createElement('div');
  clickableContent.className = 'clickable-content';
  clickableContent.onclick = () => focusTab(tab.id);

  // Create favicon image with dot if it's a duplicate
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = await createFaviconWithDot(tab.url, tab.favIconUrl);
  favicon.onerror = () => favicon.src = '../icons/icon16.png';
  clickableContent.appendChild(favicon);

  // Create title element
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title;
  clickableContent.appendChild(title);

  // Add clickable content to tab item
  tabItem.appendChild(clickableContent);

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'close-button';
  closeButton.textContent = '✕';
  closeButton.onclick = () => onClose(tab.id);
  tabItem.appendChild(closeButton);

  return tabItem;
}

// Function to create a group of duplicate tabs
async function createDuplicateGroup(group, activeTab) {
  const groupElement = document.createElement('div');
  groupElement.className = 'duplicate-group';

  // Add URL header
  const urlHeader = document.createElement('div');
  urlHeader.className = 'group-url';
  
  if (strictMatchToggle.checked) {
    // Strict match ON — all tabs in a group share the same URL, just show it once
    urlHeader.textContent = group.tabs[0].url;
  } else {
    // Strict match OFF — tabs with different fragments are grouped together,
    // show each unique URL with the fragment part highlighted
    const uniqueUrls = [...new Set(group.tabs.map(tab => tab.url))];
    if (uniqueUrls.length === 1) {
      // All tabs have the same URL (no fragments involved), show it once
      urlHeader.textContent = uniqueUrls[0];
    } else {
      const urlItems = uniqueUrls.map(url => {
        const highlightedUrl = highlightUrlDifferences(url);
        return `<div class="url-item">${highlightedUrl}</div>`;
      });
      urlHeader.innerHTML = urlItems.join('');
    }
  }
  
  groupElement.appendChild(urlHeader);

  // Add each tab in the group
  for (const tab of group.tabs) {
    const tabItem = await createTabItem(tab, async (tabId) => {
      try {
        // Send message to close tab
        await chrome.runtime.sendMessage({ 
          type: 'CLOSE_TAB', 
          tabId 
        });
        // Remove the tab item from UI
        tabItem.remove();
        // If this was the last duplicate in the group, remove the group
        if (!groupElement.querySelector('.tab-item')) {
          groupElement.remove();
        }
        // If no more duplicate groups, show "no duplicates" message
        if (!duplicateList.querySelector('.duplicate-group')) {
          duplicateList.innerHTML = '<div class="no-duplicates">No duplicate tabs found</div>';
        }
      } catch (error) {
        console.error('Error closing tab:', error);
      }
    }, activeTab);
    groupElement.appendChild(tabItem);
  }

  return groupElement;
}

// Get active tab information
async function getActiveTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return activeTab;
}

// Function to update the popup with duplicate tabs
async function updateDuplicatesList() {
  try {
    // Get duplicate groups and active tab
    const [duplicateGroups, activeTab] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_DUPLICATES' }),
      getActiveTab()
    ]);
    
    // Clear current content
    duplicateList.innerHTML = '';
    
    if (duplicateGroups.length === 0) {
      duplicateList.innerHTML = '<div class="no-duplicates">No duplicate tabs found</div>';
      return;
    }
    
    // Add each duplicate group
    for (const group of duplicateGroups) {
      const groupElement = await createDuplicateGroup(group, activeTab);
      duplicateList.appendChild(groupElement);
    }
  } catch (error) {
    console.error('Error updating duplicates list:', error);
    duplicateList.innerHTML = '<div class="no-duplicates">Error loading duplicate tabs</div>';
  }
}

// Initialize popup
loadSettings();
updateDuplicatesList();
