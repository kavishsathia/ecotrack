// EcoTrack Universal Scanner - Content Script
// Extracts text content from any product page

console.log('EcoTrack Universal Scanner loaded');

// Function to extract all relevant text from the page
function extractPageContent() {
  const content = {
    url: window.location.href,
    title: document.title,
    text: '',
    images: [],
    metadata: {}
  };

  // Extract main content areas
  const contentSelectors = [
    'h1', 'h2', 'h3',           // Headings (likely product names)
    '[data-testid*="title"]',   // Common test IDs for titles
    '[data-testid*="name"]',
    '[class*="title"]',         // Title-related classes
    '[class*="name"]',
    '[class*="product"]',       // Product-related classes
    '[class*="description"]',   // Description areas
    '[class*="detail"]',        // Detail sections
    '[class*="spec"]',          // Specifications
    '[class*="feature"]',       // Features
    '[class*="material"]',      // Materials
    '[class*="ingredient"]',    // Ingredients
    'p', 'span', 'div',         // General text containers
    '[class*="price"]',         // Price information
    '[class*="brand"]',         // Brand information
  ];

  // Extract text from each selector
  const extractedTexts = new Set();
  
  contentSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && text.length > 2 && text.length < 1000) {
        extractedTexts.add(text);
      }
    });
  });

  // Join all unique texts
  content.text = Array.from(extractedTexts).join(' | ');

  // Extract comprehensive image metadata for AI selection
  const images = document.querySelectorAll('img');
  content.images = [];
  images.forEach((img, index) => {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (src && !src.startsWith('data:') && src.includes('http')) {
      const rect = img.getBoundingClientRect();
      const altText = img.alt?.trim() || '';
      const title = img.title?.trim() || '';
      const className = img.className || '';
      
      // Get parent element info for context
      const parent = img.parentElement;
      const parentClass = parent?.className || '';
      const parentId = parent?.id || '';
      
      content.images.push({
        url: src,
        alt: altText,
        title: title,
        className: className,
        parentClassName: parentClass,
        parentId: parentId,
        width: img.naturalWidth || rect.width,
        height: img.naturalHeight || rect.height,
        position: {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          visible: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
        },
        index: index
      });
    }
  });

  // Extract meta tags that might contain product info
  const metaTags = document.querySelectorAll('meta[property], meta[name]');
  metaTags.forEach(meta => {
    const property = meta.getAttribute('property') || meta.getAttribute('name');
    const contentAttr = meta.getAttribute('content');
    
    if (property && contentAttr) {
      // Look for product-related meta tags
      if (property.includes('product') || 
          property.includes('title') || 
          property.includes('description') ||
          property.includes('og:') ||
          property.includes('twitter:')) {
        content.metadata[property] = contentAttr;
      }
    }
  });

  // Extract JSON-LD structured data (common for e-commerce)
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      if (data['@type'] === 'Product' || data.name || data.description) {
        content.metadata.structuredData = data;
      }
    } catch (e) {
      // Ignore invalid JSON
    }
  });

  return content;
}

// Function to clean and prepare content for API
function prepareContentForAPI(content) {
  // Limit text length to avoid API limits
  const maxTextLength = 5000;
  let text = content.text;
  
  if (text.length > maxTextLength) {
    // Prioritize text that likely contains product info
    const sentences = text.split('|').map(s => s.trim());
    const prioritySentences = [];
    const normalSentences = [];
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      if (lowerSentence.includes('product') ||
          lowerSentence.includes('material') ||
          lowerSentence.includes('organic') ||
          lowerSentence.includes('eco') ||
          lowerSentence.includes('sustainable') ||
          lowerSentence.includes('recycled') ||
          lowerSentence.includes('natural') ||
          lowerSentence.includes('cotton') ||
          lowerSentence.includes('bamboo') ||
          lowerSentence.includes('plastic')) {
        prioritySentences.push(sentence);
      } else {
        normalSentences.push(sentence);
      }
    });
    
    // Combine priority sentences first, then normal ones until we hit the limit
    let combinedText = prioritySentences.join(' | ');
    const remainingLength = maxTextLength - combinedText.length;
    
    if (remainingLength > 0) {
      const additionalText = normalSentences.join(' | ').substring(0, remainingLength);
      combinedText += ' | ' + additionalText;
    }
    
    text = combinedText;
  }

  return {
    url: content.url,
    title: content.title,
    text: text,
    images: content.images.slice(0, 10), // Limit images for API
    metadata: content.metadata
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    try {
      console.log('Extracting page content...');
      const rawContent = extractPageContent();
      const cleanContent = prepareContentForAPI(rawContent);
      
      console.log('Extracted content:', cleanContent);
      sendResponse({ success: true, content: cleanContent });
    } catch (error) {
      console.error('Error extracting content:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true; // Keep message channel open for async response
});