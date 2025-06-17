// Popup script for EcoTrack Universal Scanner

document.addEventListener('DOMContentLoaded', () => {
  const scanButton = document.getElementById('scan-button');
  const rescanButton = document.getElementById('rescan-button');
  const trackButton = document.getElementById('track-button');
  
  // Auto-start scanning when popup opens
  autoStartScan();
  
  // Add click handler to scan button (for manual retry)
  scanButton.addEventListener('click', () => {
    scanCurrentPage();
  });
  
  // Add click handler to rescan button
  rescanButton.addEventListener('click', () => {
    resetToScanView();
    setTimeout(() => autoStartScan(), 100); // Small delay for UI reset
  });
  
  // Add click handler to track button
  trackButton.addEventListener('click', () => {
    trackCurrentProduct();
  });
  
  // Debug: Add test buttons for development
  if (window.location.hostname === 'localhost' || chrome.runtime.getManifest().version.includes('dev')) {
    setTimeout(() => {
      // Test Lifecycle API button
      const testButton = document.createElement('button');
      testButton.textContent = 'Test Lifecycle API';
      testButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; padding: 5px; font-size: 10px; background: #purple; color: white; border: none; border-radius: 3px;';
      testButton.addEventListener('click', () => {
        console.log('Testing lifecycle summary with dummy product ID...');
        fetchLifecycleSummary('test-product-id');
      });
      document.body.appendChild(testButton);
      
      // Test Cookies button
      const cookieButton = document.createElement('button');
      cookieButton.textContent = 'Check Cookies';
      cookieButton.style.cssText = 'position: fixed; top: 40px; right: 10px; z-index: 9999; padding: 5px; font-size: 10px; background: #orange; color: white; border: none; border-radius: 3px;';
      cookieButton.addEventListener('click', async () => {
        console.log('Checking authentication cookies...');
        const message = await chrome.runtime.sendMessage({ action: 'debugCookies' });
        console.log('Cookie debug result:', message);
      });
      document.body.appendChild(cookieButton);
      
      // Test Auth API button
      const authButton = document.createElement('button');
      authButton.textContent = 'Test Auth API';
      authButton.style.cssText = 'position: fixed; top: 70px; right: 10px; z-index: 9999; padding: 5px; font-size: 10px; background: #green; color: white; border: none; border-radius: 3px;';
      authButton.addEventListener('click', async () => {
        console.log('Testing auth API endpoint...');
        try {
          const response = await fetch('http://localhost:3080/api/debug/cookies', {
            method: 'GET',
            credentials: 'include'
          });
          const result = await response.json();
          console.log('Auth API result:', result);
        } catch (error) {
          console.error('Auth API error:', error);
        }
      });
      document.body.appendChild(authButton);
    }, 1000);
  }
});

async function autoStartScan() {
  try {
    // Check if we're on a valid page first
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showScanButton('No active tab found');
      return;
    }
    
    // Check if we're on a valid page (not chrome:// or extension pages)
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url === 'newtab') {
      showScanButton('Cannot scan browser pages. Navigate to a product page to analyze.');
      return;
    }
    
    // Start automatic scanning
    scanCurrentPage();
    
  } catch (error) {
    console.error('Auto-scan error:', error);
    showScanButton('Ready to scan. Click to analyze this page.');
  }
}

function showScanButton(helpText) {
  // Show scan section with custom help text
  document.getElementById('scan-section').style.display = 'block';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  
  // Update help text
  const helpElement = document.querySelector('.help-text');
  if (helpElement && helpText) {
    helpElement.textContent = helpText;
  }
}

async function scanCurrentPage() {
  try {
    // Show loading state
    showLoading();
    
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    // Check if we're on a valid page (not chrome:// or extension pages)
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot scan browser internal pages. Please navigate to a product page.');
    }
    
    // Inject content script and extract content
    const content = await extractPageContent(tab.id);
    
    if (!content || !content.text) {
      throw new Error('Could not extract content from this page. Make sure you\'re on a product page.');
    }
    
    // Send content to background script for API analysis
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeProduct',
      content: content
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Analysis failed');
    }
    
    // Display results
    displayResults(response.result);
    
    // Debug: Log the analysis result structure
    console.log('Analysis result structure:', response.result);
    console.log('Catalog data:', response.result.catalogData);
    
    // Fetch recommendations after displaying results
    fetchRecommendations(content, response.result);
    
    // Fetch lifecycle summary if we have a product ID
    if (response.result.catalogData?.productId) {
      console.log('Product ID found, fetching lifecycle summary:', response.result.catalogData.productId);
      fetchLifecycleSummary(response.result.catalogData.productId);
    } else {
      console.log('No product ID found in analysis result - cannot fetch lifecycle summary');
      showSummaryEmpty('Product analysis required for lifecycle insights');
    }
    
  } catch (error) {
    console.error('Scan error:', error);
    showError(error.message);
  }
}

async function extractPageContent(tabId) {
  return new Promise((resolve, reject) => {
    console.log('Attempting to extract content from tab:', tabId);
    
    // Send message to content script
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script not found, requesting injection...');
        
        // Content script might not be injected yet, ask background script to inject it
        chrome.runtime.sendMessage({
          action: 'injectContentScript',
          tabId: tabId
        }, (injectionResponse) => {
          console.log('Injection response:', injectionResponse);
          
          if (injectionResponse && injectionResponse.success) {
            // Try again after injection
            setTimeout(() => {
              console.log('Retrying content extraction after injection...');
              chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                  console.error('Failed after injection:', chrome.runtime.lastError);
                  reject(new Error('Failed to extract content from page after injection. The page might not be compatible.'));
                  return;
                }
                
                if (response.success) {
                  console.log('Content extraction successful:', response.content);
                  resolve(response.content);
                } else {
                  reject(new Error(response.error || 'Content extraction failed'));
                }
              });
            }, 800);
          } else {
            const errorMsg = injectionResponse?.error || 'Failed to inject content script';
            console.error('Injection failed:', errorMsg);
            reject(new Error(errorMsg));
          }
        });
      } else if (response && response.success) {
        console.log('Content extraction successful (script already present):', response.content);
        resolve(response.content);
      } else {
        reject(new Error(response?.error || 'Content extraction failed'));
      }
    });
  });
}

function showLoading() {
  document.getElementById('scan-section').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
}

function showError(message) {
  document.getElementById('scan-section').style.display = 'block';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('error-message').textContent = message;
  document.getElementById('error').style.display = 'block';
}

function displayResults(result) {
  // Hide other sections
  document.getElementById('scan-section').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  
  // Populate results
  document.getElementById('product-name').textContent = result.productName || 'Unknown Product';
  
  // Update scan info with catalog data
  const scanInfo = document.querySelector('.scan-info');
  if (result.catalogData) {
    const { scanCount, confidence, isExisting } = result.catalogData;
    const cacheStatus = result.fromCache ? ' (from catalog)' : '';
    const confidencePercent = Math.round((confidence || 1) * 100);
    
    if (isExisting) {
      scanInfo.textContent = `Analyzed ${scanCount} times globally • ${confidencePercent}% confidence${cacheStatus}`;
    } else {
      scanInfo.textContent = `First scan • Added to global catalog${cacheStatus}`;
    }
  } else {
    scanInfo.textContent = 'Scanned just now';
  }
  
  // Set score
  const score = Math.round(result.ecoScore || 0);
  document.getElementById('score-circle').textContent = score;
  
  // Set score color and text
  const scoreCircle = document.getElementById('score-circle');
  const scoreText = document.getElementById('score-text');
  const scoreFill = document.getElementById('score-fill');
  
  scoreCircle.className = 'score-circle';
  let scoreColor = '#EF4444'; // Default poor color
  
  if (score >= 80) {
    scoreCircle.classList.add('score-excellent');
    scoreText.textContent = 'Excellent';
    scoreColor = '#10B981';
  } else if (score >= 60) {
    scoreCircle.classList.add('score-good');
    scoreText.textContent = 'Good';
    scoreColor = '#3B82F6';
  } else if (score >= 40) {
    scoreCircle.classList.add('score-fair');
    scoreText.textContent = 'Fair';
    scoreColor = '#F59E0B';
  } else {
    scoreCircle.classList.add('score-poor');
    scoreText.textContent = 'Poor';
    scoreColor = '#EF4444';
  }
  
  // Animate score bar
  scoreFill.style.backgroundColor = scoreColor;
  setTimeout(() => {
    scoreFill.style.width = `${score}%`;
  }, 100);
  
  // Populate insights
  const insightsList = document.getElementById('insights-list');
  insightsList.innerHTML = '';
  
  if (result.insights && result.insights.length > 0) {
    result.insights.forEach(insight => {
      const insightItem = document.createElement('div');
      insightItem.className = 'insight-item';
      insightItem.innerHTML = `
        <div class="insight-bullet"></div>
        <span>${insight}</span>
      `;
      insightsList.appendChild(insightItem);
    });
  } else {
    const noInsights = document.createElement('div');
    noInsights.className = 'insight-item';
    noInsights.innerHTML = `
      <div class="insight-bullet"></div>
      <span>No specific insights available for this product.</span>
    `;
    insightsList.appendChild(noInsights);
  }
  
  // Show results
  document.getElementById('results').style.display = 'block';
}

function resetToScanView() {
  // Reset to initial scan view
  document.getElementById('results').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  document.getElementById('scan-section').style.display = 'block';
  
  // Reset score bar
  document.getElementById('score-fill').style.width = '0%';
  
  // Hide recommendations
  document.getElementById('recommendations').style.display = 'none';
}

// Fetch recommendations for the current product
async function fetchRecommendations(content, analysisResult) {
  try {
    // Show loading state for recommendations
    showRecommendationsLoading();
    
    // Get product ID from catalog data if available
    const currentProductId = analysisResult.catalogData?.productId;
    const currentEcoScore = analysisResult.ecoScore || 0;
    
    // Only fetch recommendations if current score is below 80 (room for improvement)
    if (currentEcoScore >= 80) {
      showRecommendationsEmpty('This product already has an excellent eco-score!');
      return;
    }
    
    // Send request to recommendations API
    const response = await chrome.runtime.sendMessage({
      action: 'getRecommendations',
      content: content,
      currentProductId: currentProductId,
      minEcoScore: Math.max(currentEcoScore + 10, 60) // At least 10 points better
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get recommendations');
    }
    
    // Display recommendations
    displayRecommendations(response.result);
    
  } catch (error) {
    console.error('Recommendations error:', error);
    showRecommendationsEmpty('Unable to load recommendations at this time');
  }
}

// Show loading state for recommendations
function showRecommendationsLoading() {
  const recommendationsSection = document.getElementById('recommendations');
  const recommendationsList = document.getElementById('recommendations-list');
  
  recommendationsList.innerHTML = `
    <div class="recommendations-loading">
      <div class="spinner"></div>
      Finding better alternatives...
    </div>
  `;
  
  recommendationsSection.style.display = 'block';
}

// Show empty state for recommendations
function showRecommendationsEmpty(message) {
  const recommendationsSection = document.getElementById('recommendations');
  const recommendationsList = document.getElementById('recommendations-list');
  
  recommendationsList.innerHTML = `
    <div class="recommendations-empty">
      <div class="recommendations-empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#9ca3af">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
      <p class="recommendations-empty-text">${message}</p>
    </div>
  `;
  
  recommendationsSection.style.display = 'block';
}

// Display recommendations
function displayRecommendations(result) {
  const recommendationsSection = document.getElementById('recommendations');
  const recommendationsList = document.getElementById('recommendations-list');
  
  if (!result.recommendations || result.recommendations.length === 0) {
    showRecommendationsEmpty(result.message || 'No better alternatives found');
    return;
  }
  
  // Clear loading state
  recommendationsList.innerHTML = '';
  
  // Add each recommendation
  result.recommendations.forEach(rec => {
    const recommendationItem = document.createElement('div');
    recommendationItem.className = 'recommendation-item';
    
    // Determine score class
    let scoreClass = 'rec-score-fair';
    if (rec.ecoScore >= 80) scoreClass = 'rec-score-excellent';
    else if (rec.ecoScore >= 65) scoreClass = 'rec-score-good';
    
    // Create tags from materials and certifications
    const tags = [];
    if (rec.certifications && rec.certifications.length > 0) {
      tags.push(...rec.certifications.slice(0, 2));
    }
    if (rec.materials && rec.materials.length > 0) {
      tags.push(...rec.materials.slice(0, 2));
    }
    
    recommendationItem.innerHTML = `
      <div class="recommendation-header">
        <div class="recommendation-score ${scoreClass}">
          ${rec.ecoScore}
        </div>
        <div class="recommendation-info">
          <div class="recommendation-name">${rec.name}</div>
          <div class="recommendation-improvement">
            +${rec.improvementScore} points better
          </div>
        </div>
      </div>
      <div class="recommendation-details">
        ${rec.insights.join('. ') || rec.reasoning || 'More sustainable alternative'}
      </div>
      ${tags.length > 0 ? `
        <div class="recommendation-tags">
          ${tags.map(tag => `<span class="recommendation-tag">${tag}</span>`).join('')}
        </div>
      ` : ''}
      ${rec.sourceUrl ? `
        <div class="recommendation-actions">
          <button class="recommendation-link" data-url="${rec.sourceUrl}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
            </svg>
            View Product
          </button>
          ${rec.allSources && rec.allSources.length > 1 ? `
            <button class="recommendation-more-sources" data-sources='${JSON.stringify(rec.allSources)}'>
              ${rec.allSources.length} sources
            </button>
          ` : ''}
        </div>
      ` : ''}
    `;
    
    // Add click handlers for the recommendation item
    if (rec.sourceUrl) {
      const linkButton = recommendationItem.querySelector('.recommendation-link');
      if (linkButton) {
        linkButton.addEventListener('click', (e) => {
          e.stopPropagation();
          openProductLink(rec.sourceUrl);
        });
      }
      
      const moreSourcesButton = recommendationItem.querySelector('.recommendation-more-sources');
      if (moreSourcesButton) {
        moreSourcesButton.addEventListener('click', (e) => {
          e.stopPropagation();
          showMoreSources(rec.allSources);
        });
      }
      
      // Make the whole item clickable as well
      recommendationItem.style.cursor = 'pointer';
      recommendationItem.addEventListener('click', () => {
        openProductLink(rec.sourceUrl);
      });
    }
    
    recommendationsList.appendChild(recommendationItem);
  });
  
  // Update subtitle with count
  const subtitle = document.querySelector('.recommendations-subtitle');
  if (subtitle) {
    subtitle.textContent = `${result.recommendations.length} better alternatives found`;
  }
  
  // Show the section
  recommendationsSection.style.display = 'block';
}

// Open product link in new tab
function openProductLink(url) {
  if (!url) return;
  
  chrome.tabs.create({ 
    url: url,
    active: false // Open in background tab so popup stays open
  });
}

// Show multiple sources dialog
function showMoreSources(sources) {
  if (!sources || sources.length <= 1) return;
  
  // Create a simple modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 320px;
    margin: 20px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'Choose a source';
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  `;
  
  const sourcesList = document.createElement('div');
  sources.forEach((source, index) => {
    const sourceItem = document.createElement('button');
    sourceItem.style.cssText = `
      width: 100%;
      text-align: left;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      margin-bottom: 8px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
      transition: all 0.15s ease;
    `;
    
    // Format URL for display
    const domain = new URL(source).hostname.replace('www.', '');
    sourceItem.innerHTML = `
      <div style="font-weight: 500; margin-bottom: 2px;">${domain}</div>
      <div style="font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${source}
      </div>
    `;
    
    sourceItem.addEventListener('click', () => {
      openProductLink(source);
      document.body.removeChild(overlay);
    });
    
    sourceItem.addEventListener('mouseenter', () => {
      sourceItem.style.background = '#f9fafb';
      sourceItem.style.borderColor = '#d1d5db';
    });
    
    sourceItem.addEventListener('mouseleave', () => {
      sourceItem.style.background = 'white';
      sourceItem.style.borderColor = '#e5e7eb';
    });
    
    sourcesList.appendChild(sourceItem);
  });
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Cancel';
  closeButton.style.cssText = `
    width: 100%;
    padding: 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #374151;
    font-size: 14px;
    cursor: pointer;
    margin-top: 8px;
  `;
  
  closeButton.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  modal.appendChild(title);
  modal.appendChild(sourcesList);
  modal.appendChild(closeButton);
  overlay.appendChild(modal);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  document.body.appendChild(overlay);
}

// Fetch lifecycle summary for the current product
async function fetchLifecycleSummary(productId) {
  try {
    console.log('Fetching lifecycle summary for product:', productId);
    
    // Show loading state for summary
    showSummaryLoading();
    
    // Send request to lifecycle summary API
    console.log('Sending message to background script for lifecycle summary...');
    const response = await chrome.runtime.sendMessage({
      action: 'getLifecycleSummary',
      productId: productId
    });
    
    console.log('Lifecycle summary response:', response);
    
    if (!response) {
      throw new Error('No response received from background script');
    }
    
    if (!response.success) {
      console.error('Lifecycle summary API error:', response.error);
      throw new Error(response.error || 'Failed to get lifecycle summary');
    }
    
    // Display summary
    console.log('Displaying lifecycle summary result:', response.result);
    displayLifecycleSummary(response.result);
    
  } catch (error) {
    console.error('Lifecycle summary error details:', error);
    const errorMessage = error.message.includes('404') ? 
      'Product not tracked yet. Track this product to see AI insights.' :
      error.message.includes('401') || error.message.includes('Unauthorized') ?
      'Please log in to view lifecycle insights.' :
      `Unable to load lifecycle summary: ${error.message}`;
    showSummaryEmpty(errorMessage);
  }
}

// Show loading state for summary
function showSummaryLoading() {
  const summarySection = document.getElementById('ai-summary');
  const summaryContent = document.getElementById('summary-content');
  
  summaryContent.innerHTML = `
    <div class="summary-loading">
      <div class="spinner"></div>
      Loading AI insights...
    </div>
  `;
  
  summarySection.style.display = 'block';
}

// Show empty state for summary
function showSummaryEmpty(message) {
  const summarySection = document.getElementById('ai-summary');
  const summaryContent = document.getElementById('summary-content');
  
  summaryContent.innerHTML = `
    <div class="summary-empty">
      <div class="summary-empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#a855f7">
          <path d="M9,1V3H15V1H17V3H21A2,2 0 0,1 23,5V19A2,2 0 0,1 21,21H3A2,2 0 0,1 1,19V5A2,2 0 0,1 3,3H7V1H9M3,7V19H21V7H3M7,10H9V12H7V10M15,10H17V12H15V10M11,14H13V16H11V14Z"/>
        </svg>
      </div>
      <p class="summary-empty-text">${message}</p>
    </div>
  `;
  
  summarySection.style.display = 'block';
}

// Display lifecycle summary
function displayLifecycleSummary(result) {
  console.log('Displaying lifecycle summary with result:', result);
  
  const summarySection = document.getElementById('ai-summary');
  const summaryContent = document.getElementById('summary-content');
  
  if (!summarySection || !summaryContent) {
    console.error('Summary UI elements not found');
    return;
  }
  
  if (!result.isTracked) {
    console.log('Product not tracked, showing empty state');
    showSummaryEmpty('Track this product to see AI lifecycle insights');
    return;
  }
  
  const summary = result.summary;
  console.log('Summary data:', summary);
  
  if (!summary || !summary.latest || !summary.all || summary.all.length === 0) {
    summaryContent.innerHTML = `
      <div class="summary-empty">
        <div class="summary-empty-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#a855f7">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
          </svg>
        </div>
        <p class="summary-empty-text">Add more lifecycle events to generate AI summaries</p>
        <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
          ${summary.statistics.totalSteps}/50 events needed
        </p>
      </div>
    `;
    summarySection.style.display = 'block';
    return;
  }
  
  const latestSummary = summary.latest;
  const stats = summary.statistics;
  
  // Clear loading state
  summaryContent.innerHTML = '';
  
  // Create summary card
  const summaryCard = document.createElement('div');
  summaryCard.className = 'summary-card';
  
  // Summary stats
  summaryCard.innerHTML = `
    <div class="summary-stats">
      <div class="summary-stat">
        <div class="summary-stat-value">${summary.all.length}</div>
        <div class="summary-stat-label">AI Summaries</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-value">${stats.totalStepsProcessed}</div>
        <div class="summary-stat-label">Steps Analyzed</div>
      </div>
      ${stats.pendingStepsCount > 0 ? `
        <div class="summary-stat">
          <div class="summary-stat-value">${stats.pendingStepsCount}</div>
          <div class="summary-stat-label">Pending</div>
        </div>
      ` : ''}
      ${stats.ecoScoreTrend !== 0 ? `
        <div class="summary-stat">
          <div class="summary-stat-value ${stats.ecoScoreTrend > 0 ? 'style="color: #059669;"' : 'style="color: #dc2626;"'}">
            ${stats.ecoScoreTrend > 0 ? '+' : ''}${stats.ecoScoreTrend}
          </div>
          <div class="summary-stat-label">Eco Change</div>
        </div>
      ` : ''}
    </div>
    
    <div class="summary-text">
      ${latestSummary.summary.substring(0, 200)}${latestSummary.summary.length > 200 ? '...' : ''}
    </div>
    
    ${latestSummary.keyEvents && latestSummary.keyEvents.length > 0 ? `
      <div class="summary-events">
        <div class="summary-events-title">Key Recent Events</div>
        ${latestSummary.keyEvents.slice(0, 3).map(event => `
          <div class="summary-event">${event}</div>
        `).join('')}
      </div>
    ` : ''}
    
    <div class="summary-actions">
      <button class="view-full-summary" onclick="openFullSummary('${result.product.id}')">
        View Full Timeline
      </button>
      ${stats.pendingStepsCount >= 50 ? `
        <button class="generate-summary" onclick="generateSummary('${result.product.id}')">
          Generate Summary
        </button>
      ` : ''}
    </div>
  `;
  
  summaryContent.appendChild(summaryCard);
  summarySection.style.display = 'block';
}

// Open full summary in new tab
function openFullSummary(productId) {
  if (!productId) return;
  
  chrome.tabs.create({ 
    url: `http://localhost:3080/dashboard/products`,
    active: false // Open in background tab so popup stays open
  });
}

// Generate new summary
async function generateSummary(productId) {
  try {
    console.log('Generating summary for product:', productId);
    
    // Show loading state
    showSummaryLoading();
    
    // Call generate summary API
    const response = await chrome.runtime.sendMessage({
      action: 'generateSummary',
      productId: productId
    });
    
    if (response.success) {
      // Refresh the summary display
      setTimeout(() => {
        fetchLifecycleSummary(productId);
      }, 1000);
    } else {
      showSummaryEmpty('Failed to generate summary');
    }
    
  } catch (error) {
    console.error('Generate summary error:', error);
    showSummaryEmpty('Unable to generate summary');
  }
}

// Track the current product
async function trackCurrentProduct() {
  try {
    const trackButton = document.getElementById('track-button');
    
    // Disable button and show loading state
    trackButton.disabled = true;
    trackButton.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px; border-width: 1px;"></div>
      Tracking...
    `;
    
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    // Check if we're on a valid page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot track products on browser internal pages');
    }
    
    // Extract content from the page
    const content = await extractPageContent(tab.id);
    
    if (!content || !content.text) {
      throw new Error('Could not extract content from this page');
    }
    
    // Send to background script for tracking
    const response = await chrome.runtime.sendMessage({
      action: 'trackProduct',
      content: content
    });
    
    if (!response.success) {
      // Check if it's an authentication error
      if (response.error && (response.error.includes('Authentication required') || response.error.includes('Unauthorized') || response.error.includes('401'))) {
        trackButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5C15.4,11.5 16,12.4 16,13V16C16,17.4 15.4,18 14.8,18H9.2C8.6,18 8,17.4 8,16V13C8,12.4 8.6,11.5 9.2,11.5V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,10V11.5H13.5V10C13.5,8.7 12.8,8.2 12,8.2Z"/>
          </svg>
          Login Required
        `;
        
        setTimeout(() => {
          // Open login page
          chrome.tabs.create({ 
            url: 'http://localhost:3080/login',
            active: true
          });
          
          // Reset button
          trackButton.disabled = false;
          trackButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
            </svg>
            Track This Product
          `;
        }, 2000);
        return;
      }
      
      throw new Error(response.error || 'Failed to track product');
    }
    
    // Show success state
    trackButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
      </svg>
      Product Tracked!
    `;
    
    // Reset button after 2 seconds
    setTimeout(() => {
      trackButton.disabled = false;
      trackButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
        </svg>
        Track This Product
      `;
    }, 2000);
    
  } catch (error) {
    console.error('Track product error:', error);
    
    const trackButton = document.getElementById('track-button');
    
    // Show error state
    trackButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
      </svg>
      Failed to Track
    `;
    
    // Reset button after 3 seconds
    setTimeout(() => {
      trackButton.disabled = false;
      trackButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
        </svg>
        Track This Product
      `;
    }, 3000);
  }
}