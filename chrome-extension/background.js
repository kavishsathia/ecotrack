// Background script for EcoTrack Universal Scanner

console.log('EcoTrack Universal Scanner background script loaded');

// API configuration
const API_BASE_URL = 'http://localhost:3080'; // Update for production

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('EcoTrack Universal Scanner installed');
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    apiUrl: API_BASE_URL
  });
  
  // Create context menu
  chrome.contextMenus.create({
    id: 'track-product',
    title: 'Track this product',
    contexts: ['page', 'selection']
  });
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeProduct') {
    analyzeProductWithAPI(request.content)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => {
        console.error('Analysis error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'injectContentScript') {
    injectContentScript(request.tabId)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Injection error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'trackProduct') {
    trackProductWithAPI(request.content)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => {
        console.error('Track product error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getRecommendations') {
    getRecommendationsWithAPI(request.content, request.currentProductId, request.minEcoScore)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => {
        console.error('Recommendations error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getLifecycleSummary') {
    console.log('Background script received getLifecycleSummary request for product:', request.productId);
    getLifecycleSummaryWithAPI(request.productId)
      .then(result => {
        console.log('Background script lifecycle summary success:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Background script lifecycle summary error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'generateSummary') {
    generateSummaryWithAPI(request.productId)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => {
        console.error('Generate summary error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'debugCookies') {
    debugCookies()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => {
        console.error('Debug cookies error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'track-product') {
    await handleTrackProduct(tab);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'track-product') {
    await handleTrackProduct(tab);
  }
});

// Handle track product action
async function handleTrackProduct(tab) {
  try {
    console.log('Tracking product on tab:', tab.id);
    
    // Check if we're on a valid page
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url === 'newtab') {
      console.log('Cannot track products on browser pages');
      return;
    }
    
    // Extract content from the page
    const content = await extractPageContentForTracking(tab.id);
    
    if (!content || !content.text) {
      console.log('Could not extract content for tracking');
      return;
    }
    
    // Track the product
    const result = await trackProductWithAPI(content);
    console.log('Product tracked successfully:', result);
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Product Tracked',
      message: `"${result.productName}" has been added to your tracking list`
    });
    
  } catch (error) {
    console.error('Error tracking product:', error);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Tracking Failed',
      message: 'Could not track this product. Please try again.'
    });
  }
}

// Function to analyze product content using the API
async function analyzeProductWithAPI(content) {
  try {
    console.log('Sending content to API for analysis...');
    
    const response = await fetch(`${API_BASE_URL}/api/products/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({
        content: content,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('API analysis result:', result);
    
    return result;
  } catch (error) {
    console.error('Error calling API:', error);
    throw error;
  }
}

// Function to inject content script if needed
async function injectContentScript(tabId) {
  try {
    console.log('Injecting content script into tab:', tabId);
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
    console.log('Content script injection successful:', results);
    return results;
  } catch (error) {
    console.error('Error injecting content script:', error);
    
    // Check if it's a permissions error or other specific error
    if (error.message.includes('Cannot access') || error.message.includes('chrome://')) {
      throw new Error('Cannot scan this page. Please navigate to a regular website or product page.');
    }
    
    throw new Error(`Failed to inject content script: ${error.message}`);
  }
}

// Function to extract page content for tracking
async function extractPageContentForTracking(tabId) {
  try {
    // First try to inject content script if needed
    await injectContentScript(tabId);
    
    // Then extract content
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.success) {
          resolve(response.content);
        } else {
          reject(new Error(response?.error || 'Content extraction failed'));
        }
      });
    });
  } catch (error) {
    console.error('Error extracting content for tracking:', error);
    throw error;
  }
}

// Function to track product using the API
async function trackProductWithAPI(content) {
  try {
    console.log('Background: Sending product to API for tracking...');
    console.log('Background: API Base URL:', API_BASE_URL);
    
    // Get session cookies from the browser
    const cookies = await chrome.cookies.getAll({
      url: API_BASE_URL
    });
    
    console.log('Background: Found cookies for tracking:', cookies.length);
    console.log('Background: Cookie details:', cookies.map(c => ({ 
      name: c.name, 
      value: c.value.substring(0, 20) + '...', 
      httpOnly: c.httpOnly,
      secure: c.secure 
    })));
    
    // Extract userId from cookies
    let userId = null;
    const userIdCookie = cookies.find(c => c.name === 'user_id');
    const userSessionCookie = cookies.find(c => c.name === 'user_session');
    
    if (userIdCookie) {
      userId = userIdCookie.value;
      console.log('Background: Found userId from user_id cookie:', userId);
    } else if (userSessionCookie) {
      try {
        const sessionData = JSON.parse(userSessionCookie.value);
        if (sessionData.userId) {
          userId = sessionData.userId;
          console.log('Background: Found userId from user_session cookie:', userId);
        }
      } catch (e) {
        // If not JSON, treat as direct userId
        if (userSessionCookie.value && userSessionCookie.value.length > 10) {
          userId = userSessionCookie.value;
          console.log('Background: Using user_session value as userId:', userId);
        }
      }
    }
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    console.log('Background: Using credentials: include for automatic cookie handling');
    console.log('Background: Extracted userId for tracking:', userId);
    
    console.log('Background: Making tracking request to:', `${API_BASE_URL}/api/products/track`);
    
    const response = await fetch(`${API_BASE_URL}/api/products/track`, {
      method: 'POST',
      headers: headers,
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({
        content: content,
        userId: userId, // Include extracted userId
        timestamp: Date.now()
      })
    });

    console.log('Background: Tracking API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Background: Tracking API error response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Background: Tracking API success result:', result);
    
    return result;
  } catch (error) {
    console.error('Error calling tracking API:', error);
    throw error;
  }
}

// Function to get recommendations using the API
async function getRecommendationsWithAPI(content, currentProductId, minEcoScore) {
  try {
    console.log('Sending content to API for recommendations...');
    
    const response = await fetch(`${API_BASE_URL}/api/products/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({
        content: content,
        currentProductId: currentProductId,
        minEcoScore: minEcoScore || 60,
        limit: 5,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('API recommendations result:', result);
    
    return result;
  } catch (error) {
    console.error('Error calling recommendations API:', error);
    throw error;
  }
}

// Function to get lifecycle summary using the API
async function getLifecycleSummaryWithAPI(productId) {
  try {
    console.log('Background: Fetching lifecycle summary for product:', productId);
    console.log('Background: API Base URL:', API_BASE_URL);
    
    // Get session cookies from the browser
    const cookies = await chrome.cookies.getAll({
      url: API_BASE_URL
    });
    
    console.log('Background: Found cookies:', cookies.length);
    console.log('Background: Cookie details:', cookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })));
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    console.log('Background: Using credentials: include for automatic cookie handling');
    
    const apiUrl = `${API_BASE_URL}/api/products/${productId}/lifecycle/summary`;
    console.log('Background: Making request to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: headers,
      credentials: 'include', // Include cookies for authentication
    });

    console.log('Background: API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Background: API error response:', errorText);
      
      if (response.status === 404) {
        return { isTracked: false, message: 'Product not tracked or access denied' };
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Background: API lifecycle summary result:', result);
    
    return { ...result, isTracked: true };
  } catch (error) {
    console.error('Background: Error calling lifecycle summary API:', error);
    throw error;
  }
}

// Function to generate summary using the API
async function generateSummaryWithAPI(productId) {
  try {
    console.log('Generating summary for product:', productId);
    
    // Get session cookies from the browser
    const cookies = await chrome.cookies.getAll({
      url: API_BASE_URL
    });
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    console.log('Background: Using credentials: include for automatic cookie handling');
    
    const response = await fetch(`${API_BASE_URL}/api/lifecycle/generate-summary`, {
      method: 'POST',
      headers: headers,
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({
        productId: productId,
        forceRegenerate: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('API generate summary result:', result);
    
    return result;
  } catch (error) {
    console.error('Error calling generate summary API:', error);
    throw error;
  }
}

// Function to debug cookie issues
async function debugCookies() {
  try {
    console.log('=== COOKIE DEBUG START ===');
    
    // Get all cookies for the API domain
    const cookies = await chrome.cookies.getAll({
      url: API_BASE_URL
    });
    
    console.log('Total cookies found:', cookies.length);
    
    const cookieInfo = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value.substring(0, 50) + (cookie.value.length > 50 ? '...' : ''),
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: cookie.expirationDate
    }));
    
    console.log('Cookie details:', cookieInfo);
    
    // Check specifically for auth cookies
    const userIdCookie = cookies.find(c => c.name === 'user_id');
    const userSessionCookie = cookies.find(c => c.name === 'user_session');
    
    console.log('Auth cookies status:');
    console.log('- user_id cookie:', userIdCookie ? 'FOUND' : 'MISSING');
    console.log('- user_session cookie:', userSessionCookie ? 'FOUND' : 'MISSING');
    
    if (userIdCookie) {
      console.log('user_id details:', {
        value: userIdCookie.value,
        domain: userIdCookie.domain,
        httpOnly: userIdCookie.httpOnly
      });
    }
    
    console.log('=== COOKIE DEBUG END ===');
    
    return {
      totalCookies: cookies.length,
      hasUserId: !!userIdCookie,
      hasUserSession: !!userSessionCookie,
      userIdValue: userIdCookie?.value,
      cookieDetails: cookieInfo
    };
  } catch (error) {
    console.error('Error debugging cookies:', error);
    throw error;
  }
}