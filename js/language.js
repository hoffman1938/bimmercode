// Configuration
const translationConfig = {
    apiUrl: 'https://api.mymemory.translated.net/get', // MyMemory Translation API 
    batchSize: 20, // Number of texts to translate in one batch (requests are made individually)
    cacheEnabled: true, // Enable local caching of translations
    cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours cache duration
    requestDelay: 100, // Delay between requests to avoid hitting rate limits
    maxRetries: 2, // Maximum number of retries on failure
    maxRequestLength: 500, // Maximum text length for a single request
    debug: false // Set to false to keep console clean
  };
  
  // State management
  let currentLanguage = 'en';
  let isTranslating = false;
  let translationCache = {};
  
  // Silent logger functions - only log if debug is enabled
  const logger = {
    log: function(message, ...args) {
      if (translationConfig.debug) {
        console.log(message, ...args);
      }
    },
    error: function(message, ...args) {
      if (translationConfig.debug) {
        console.error(message, ...args);
      }
    },
    warn: function(message, ...args) {
      if (translationConfig.debug) {
        console.warn(message, ...args);
      }
    }
  };
  
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function() {
    // Clear the console on page load
    console.clear();
    // Load cached translations
    if (translationConfig.cacheEnabled) {
      const cached = localStorage.getItem('translationCache');
      if (cached) {
        try {
          translationCache = JSON.parse(cached);
          // Clean expired cache items
          const now = Date.now();
          for (const key in translationCache) {
            if (translationCache[key].expires < now) {
              delete translationCache[key];
            }
          }
        } catch (e) {
          logger.error('Failed to parse translation cache');
          translationCache = {};
        }
      }
    }
  
    // Set initial language - the forum is in Russian by default
    const savedLang = localStorage.getItem('forumLanguage');
    currentLanguage = savedLang || 'ru'; // Always default to Russian if no saved preference
    
    // Update UI
    updateLanguageButton(currentLanguage);
    document.documentElement.lang = currentLanguage;
    
    // Set up language toggle
    const langToggle = document.getElementById('language-toggle');
    if (langToggle) {
      langToggle.addEventListener('click', switchLanguage);
    }
    
    // Protect BMW codes
    protectBMWCodes();
  });
  
  // Main translation function
  async function translatePage(targetLang) {
    if (isTranslating || currentLanguage === targetLang) return;
    isTranslating = true;
    
    // Show loading indicator
    showTranslationLoader(targetLang);
  
    try {
      // Get all text elements
      const textElements = getTextElements();
      
      // Group texts for batch translation
      const textsToTranslate = [];
      const textNodes = [];
      
      textElements.forEach(({node, text}) => {
        // Skip empty text or very short text (like symbols)
        if (!text.trim() || text.length < 2) return;
        
        // Check cache first
        const cacheKey = `${currentLanguage}_${targetLang}_${text}`;
        if (translationConfig.cacheEnabled && 
            translationCache[cacheKey] && 
            translationCache[cacheKey].translation) {
          node.nodeValue = node.nodeValue.replace(text, translationCache[cacheKey].translation);
        } else {
          textsToTranslate.push(text);
          textNodes.push({node, text, cacheKey});
        }
      });
  
      // Translate in batches
      for (let i = 0; i < textsToTranslate.length; i += translationConfig.batchSize) {
        const batch = textsToTranslate.slice(i, i + translationConfig.batchSize);
        
        const translations = await Promise.all(
          batch.map(text => 
            translateSingleTextWithRetry(text, currentLanguage, targetLang, translationConfig.maxRetries)
          )
        );
        
        // Apply translations
        translations.forEach((translated, index) => {
          const nodeIndex = i + index;
          if (nodeIndex < textNodes.length) {
            const {node, text, cacheKey} = textNodes[nodeIndex];
            
            if (translated && translated !== text) {
              // Replace the text in the node
              node.nodeValue = node.nodeValue.replace(text, translated);
              
              // Cache the translation
              if (translationConfig.cacheEnabled) {
                const now = Date.now();
                translationCache[cacheKey] = {
                  translation: translated,
                  expires: now + translationConfig.cacheExpiry
                };
              }
            }
          }
        });
        
        // Update progress in the UI
        updateTranslationProgress(i + batch.length, textsToTranslate.length);
        
        // Small delay between batches to avoid rate limiting
        if (i + translationConfig.batchSize < textsToTranslate.length) {
          await new Promise(resolve => setTimeout(resolve, translationConfig.requestDelay));
        }
      }
  
      // Update state
      currentLanguage = targetLang;
      localStorage.setItem('forumLanguage', targetLang);
      updateLanguageButton(targetLang);
      document.documentElement.lang = targetLang;
      
      // Save cache
      if (translationConfig.cacheEnabled) {
        localStorage.setItem('translationCache', JSON.stringify(translationCache));
      }
      
      showTranslationSuccess(targetLang);
    } catch (error) {
      logger.error('Translation failed:', error);
      showTranslationError();
    } finally {
      isTranslating = false;
      
      // Clear the console completely after translation is finished
      setTimeout(() => {
        console.clear();
      }, 500);
    }
  }
  
  // Get all text elements that need translation
  function getTextElements() {
    const textElements = [];
    
    // Create a TreeWalker to efficiently traverse the DOM
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip empty nodes, scripts, styles, and nodes marked as notranslate
          const text = node.nodeValue.trim();
          if (!text || 
              node.parentNode.tagName === 'SCRIPT' || 
              node.parentNode.tagName === 'STYLE' ||
              node.parentNode.classList.contains('notranslate')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Also check if any parent has notranslate class
          let parent = node.parentNode;
          while (parent) {
            if (parent.classList && parent.classList.contains('notranslate')) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentNode;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
  
    let node;
    while (node = walker.nextNode()) {
      const text = node.nodeValue.trim();
      if (text) {
        textElements.push({node, text});
      }
    }
  
    return textElements;
  }
  
  // Translate single text with retry mechanism
  async function translateSingleTextWithRetry(text, sourceLang, targetLang, retriesLeft) {
    try {
      // Skip overly long text - split it up for better results
      if (text.length > translationConfig.maxRequestLength) {
        // Split long text by sentences or periods
        const parts = text.split(/(?<=[.!?])\s+/);
        const translatedParts = [];
        
        for (const part of parts) {
          // For each part, try to translate
          const translatedPart = await translateSingleText(part, sourceLang, targetLang);
          translatedParts.push(translatedPart);
          
          // Slight delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return translatedParts.join(' ');
      } else {
        return await translateSingleText(text, sourceLang, targetLang);
      }
    } catch (error) {
      logger.error(`Translation attempt failed for "${text.substring(0, 30)}..."`);
      
      if (retriesLeft > 0) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return translateSingleTextWithRetry(text, sourceLang, targetLang, retriesLeft - 1);
      } else {
        logger.error('All translation attempts failed');
        // Return original text as fallback
        return text;
      }
    }
  }
  
  // Translate single text
  async function translateSingleText(text, sourceLang, targetLang) {
    // Skip translation if languages are the same
    if (sourceLang === targetLang) return text;
    
    // Skip translation for very short text
    if (text.length < 2) return text;
    
    try {
      // Construct the API URL with parameters
      const url = `${translationConfig.apiUrl}?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
  
      const data = await response.json();
      
      // Check for successful translation
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      } else if (data.responseStatus === 429) {
        throw new Error('Rate limit exceeded');
      } else {
        logger.warn('Unexpected API response');
        return text; // Return original text as fallback
      }
    } catch (error) {
      logger.error('Translation failed');
      throw error; // Let the retry mechanism handle it
    }
  }
  
  // UI Functions
  function showTranslationLoader(targetLang) {
    let loader = document.getElementById('translation-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'translation-loader';
      loader.style.position = 'fixed';
      loader.style.bottom = '20px';
      loader.style.right = '20px';
      loader.style.backgroundColor = '#1a6fb0';
      loader.style.color = 'white';
      loader.style.padding = '10px';
      loader.style.borderRadius = '5px';
      loader.style.zIndex = '9999';
      document.body.appendChild(loader);
    }
    loader.style.display = 'block';
    loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Translating to ${targetLang.toUpperCase()}...`;
  }
  
  function updateTranslationProgress(current, total) {
    const loader = document.getElementById('translation-loader');
    if (loader) {
      const percent = Math.round((current / total) * 100);
      loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Translating... ${percent}% (${current}/${total})`;
    }
  }
  
  function showTranslationSuccess(targetLang) {
    const loader = document.getElementById('translation-loader');
    if (loader) {
      loader.innerHTML = `<i class="fas fa-check"></i> Translated to ${targetLang.toUpperCase()}`;
      setTimeout(() => loader.style.display = 'none', 2000);
    }
  }
  
  function showTranslationError() {
    const loader = document.getElementById('translation-loader');
    if (loader) {
      loader.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Translation failed. Please try again later.`;
      setTimeout(() => loader.style.display = 'none', 3000);
    }
  }
  
  function updateLanguageButton(lang) {
    const display = document.getElementById('language-display');
    if (display) {
      // Show the OPPOSITE language that user can switch to
      display.textContent = (lang === 'ru' ? 'EN' : 'RU');
    }
  }
  
  // Language toggle
  function switchLanguage() {
    const newLang = currentLanguage === 'en' ? 'ru' : 'en';
    translatePage(newLang);
  }
  
  // Protect BMW codes
  function protectBMWCodes() {
    const modelCodeRegex = /\b(E\d{2}|F\d{2}|G\d{2}|X[1-7]|M\d{1,2}|Z[1-4]|i[1-8]|B\d{2}|N\d{2})\b/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    
    let node;
    while (node = walker.nextNode()) {
      if (modelCodeRegex.test(node.nodeValue)) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        
        modelCodeRegex.lastIndex = 0;
        while (match = modelCodeRegex.exec(node.nodeValue)) {
          if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(
              node.nodeValue.substring(lastIndex, match.index)
            ));
          }
          
          const span = document.createElement('span');
          span.className = 'notranslate bmw-code';
          span.textContent = match[0];
          fragment.appendChild(span);
          
          lastIndex = modelCodeRegex.lastIndex;
        }
        
        if (lastIndex < node.nodeValue.length) {
          fragment.appendChild(document.createTextNode(
            node.nodeValue.substring(lastIndex)
          ));
        }
        
        if (node.parentNode) {
          node.parentNode.replaceChild(fragment, node);
        }
      }
    }
  }