/**
 * 北方領土ニュースまとめ - Application
 * News aggregation site for Northern Territories
 */

(function () {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    dataPath: 'data/articles.json',
    dateLocale: 'ja-JP',
    animationDelay: 50, // ms between each article animation
    searchDebounceMs: 300, // debounce delay for search input
    articlesPerPage: 20, // number of articles to load at a time
  };

  // ============================================
  // State
  // ============================================
  const state = {
    articles: [],
    filteredArticles: [],
    displayedCount: 0, // number of articles currently displayed
    currentQuery: '',
    isLoading: false,
  };

  // ============================================
  // DOM Elements
  // ============================================
  const elements = {
    articleList: document.getElementById('articleList'),
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    articleCount: document.getElementById('articleCount'),
    lastUpdated: document.getElementById('lastUpdated'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    loadMoreTrigger: null, // will be created dynamically
  };

  // Intersection Observer for infinite scroll
  let loadMoreObserver = null;

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Format date to Japanese locale string
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date (yyyy年mm月dd日 hh時ii分)
   */
  function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}年${month}月${day}日 ${hours}時${minutes}分`;
  }

  /**
   * Format last updated timestamp
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted timestamp
   */
  function formatLastUpdated(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString(CONFIG.dateLocale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Search articles by keyword in title
   * @param {Array} articles - Article array
   * @param {string} query - Search query
   * @returns {Array} Matching articles
   */
  function searchArticles(articles, query) {
    if (!query.trim()) return articles;
    const q = query.toLowerCase();
    return articles.filter((article) =>
      article.title.toLowerCase().includes(q)
    );
  }

  /**
   * Create a debounced function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ============================================
  // Rendering Functions
  // ============================================

  /**
   * Create article card HTML
   * @param {Object} article - Article data
   * @param {number} index - Article index for animation delay
   * @returns {string} HTML string
   */
  function createArticleCard(article, index) {
    const formattedDate = formatDate(article.publishedAt);
    const animationDelay = (index % CONFIG.articlesPerPage) * CONFIG.animationDelay;

    // Truncate source name for tag display
    const shortSource = article.source.length > 12
      ? article.source.substring(0, 12)
      : article.source;

    return `
      <li class="article-item" style="animation-delay: ${animationDelay}ms">
        <a href="${escapeHtml(article.url)}"
           class="article-card"
           target="_blank"
           rel="noopener noreferrer">
          <div class="article-card__content">
            <div class="article-card__header">
              <h2 class="article-card__title">${escapeHtml(article.title)}</h2>
            </div>
            <div class="article-card__meta">
              <span class="article-card__source">${escapeHtml(shortSource)}</span>
              <time class="article-card__date" datetime="${article.publishedAt}">${formattedDate}</time>
            </div>
          </div>
        </a>
      </li>
    `;
  }

  /**
   * Escape HTML special characters
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Create load more trigger element
   * @returns {HTMLElement} Trigger element
   */
  function createLoadMoreTrigger() {
    const trigger = document.createElement('li');
    trigger.className = 'load-more-trigger';
    trigger.innerHTML = `
      <div class="load-more-spinner">
        <div class="loading__spinner"></div>
      </div>
    `;
    return trigger;
  }

  /**
   * Render initial articles (first batch)
   */
  function renderArticles() {
    const { filteredArticles } = state;

    // Update article count
    elements.articleCount.textContent = filteredArticles.length;

    // Reset displayed count
    state.displayedCount = 0;

    // Clear list
    elements.articleList.innerHTML = '';

    // Show/hide empty state
    if (filteredArticles.length === 0) {
      elements.emptyState.hidden = false;
      removeLoadMoreTrigger();
      return;
    }

    elements.emptyState.hidden = true;

    // Load first batch
    loadMoreArticles();
  }

  /**
   * Load more articles (append to list)
   */
  function loadMoreArticles() {
    if (state.isLoading) return;

    const { filteredArticles, displayedCount } = state;
    const remaining = filteredArticles.length - displayedCount;

    if (remaining <= 0) {
      removeLoadMoreTrigger();
      return;
    }

    state.isLoading = true;

    // Get next batch
    const nextBatch = filteredArticles.slice(
      displayedCount,
      displayedCount + CONFIG.articlesPerPage
    );

    // Render articles
    const html = nextBatch
      .map((article, index) => createArticleCard(article, displayedCount + index))
      .join('');

    // Remove trigger temporarily
    removeLoadMoreTrigger();

    // Append articles
    elements.articleList.insertAdjacentHTML('beforeend', html);

    // Update count
    state.displayedCount += nextBatch.length;

    // Add trigger back if more articles remain
    if (state.displayedCount < filteredArticles.length) {
      addLoadMoreTrigger();
    }

    state.isLoading = false;
  }

  /**
   * Add load more trigger element
   */
  function addLoadMoreTrigger() {
    if (!elements.loadMoreTrigger) {
      elements.loadMoreTrigger = createLoadMoreTrigger();
    }
    elements.articleList.appendChild(elements.loadMoreTrigger);

    // Observe trigger
    if (loadMoreObserver) {
      loadMoreObserver.observe(elements.loadMoreTrigger);
    }
  }

  /**
   * Remove load more trigger element
   */
  function removeLoadMoreTrigger() {
    if (elements.loadMoreTrigger && elements.loadMoreTrigger.parentNode) {
      if (loadMoreObserver) {
        loadMoreObserver.unobserve(elements.loadMoreTrigger);
      }
      elements.loadMoreTrigger.remove();
    }
  }

  /**
   * Update last updated timestamp
   * @param {string} timestamp - ISO date string
   */
  function renderLastUpdated(timestamp) {
    elements.lastUpdated.textContent = formatLastUpdated(timestamp);
  }

  // ============================================
  // State Management
  // ============================================

  /**
   * Apply current search
   */
  function applySearch() {
    state.filteredArticles = searchArticles(state.articles, state.currentQuery);
    renderArticles();
  }

  /**
   * Handle search input
   * @param {Event} event - Input event
   */
  function handleSearchInput(event) {
    state.currentQuery = event.target.value;
    // Show/hide clear button
    elements.searchClear.hidden = !state.currentQuery;
    applySearch();
  }

  /**
   * Handle search clear button click
   */
  function handleSearchClear() {
    state.currentQuery = '';
    elements.searchInput.value = '';
    elements.searchClear.hidden = true;
    elements.searchInput.focus();
    applySearch();
  }

  // ============================================
  // Intersection Observer Setup
  // ============================================

  /**
   * Setup intersection observer for infinite scroll
   */
  function setupIntersectionObserver() {
    const options = {
      root: null, // viewport
      rootMargin: '200px', // load before reaching the bottom
      threshold: 0,
    };

    loadMoreObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !state.isLoading) {
          loadMoreArticles();
        }
      });
    }, options);
  }

  // ============================================
  // Data Fetching
  // ============================================

  /**
   * Fetch articles from JSON file
   * @returns {Promise<Object>} Articles data
   */
  async function fetchArticles() {
    try {
      const response = await fetch(CONFIG.dataPath);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      throw error;
    }
  }

  /**
   * Show loading state
   */
  function showLoading() {
    elements.loading.hidden = false;
    elements.articleList.innerHTML = '';
    elements.emptyState.hidden = true;
  }

  /**
   * Hide loading state
   */
  function hideLoading() {
    elements.loading.hidden = true;
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  function showError(message) {
    elements.articleList.innerHTML = `
      <li class="article-item" style="animation-delay: 0ms">
        <div class="article-card" style="border-color: var(--color-vermillion); background: #fef5f5;">
          <div class="article-card__title" style="color: var(--color-vermillion);">
            データの読み込みに失敗しました
          </div>
          <div class="article-card__meta">${escapeHtml(message)}</div>
        </div>
      </li>
    `;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize the application
   */
  async function init() {
    // Show loading state
    showLoading();

    // Setup intersection observer
    setupIntersectionObserver();

    // Create debounced search handler
    const debouncedSearch = debounce(handleSearchInput, CONFIG.searchDebounceMs);

    // Attach event listeners
    elements.searchInput.addEventListener('input', debouncedSearch);
    elements.searchClear.addEventListener('click', handleSearchClear);

    try {
      // Fetch data
      const data = await fetchArticles();

      // Update state (articles are already sorted by date in the JSON)
      state.articles = data.articles || [];

      // Render UI
      renderLastUpdated(data.lastUpdated);

      // Apply initial search (shows all)
      applySearch();
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoading();
    }
  }

  // ============================================
  // Start Application
  // ============================================

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
