/**
 * Parts Finder UI Component
 * Displays parts needed for error codes with buy links
 */

class PartsFinderUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    // Get language from localStorage (same key as script.js uses)
    this.currentLang = localStorage.getItem('forumLanguage') || 'en';
  }

  /**
   * Load and display parts for an error code
   */
  async loadParts(errorCode, vin = null) {
    try {
      // Update language from localStorage before each load
      this.currentLang = localStorage.getItem('forumLanguage') || 'en';
      
      this.showLoading();
      
      let url = `/api/parts?code=${errorCode}&lang=${this.currentLang}`;
      if (vin) url += `&vin=${vin}`;
      
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        this.showError('Parts service unavailable');
        return;
      }
      const data = await response.json();

      if (!response.ok) {
        this.showError(data.error || 'Failed to load parts');
        return;
      }

      const hasParts =
        (data.parts?.primary?.length || 0) +
        (data.parts?.secondary?.length || 0) +
        (data.parts?.optional?.length || 0);
      if (!hasParts) {
        this.container.innerHTML = '';
        return;
      }

      this.renderParts(data);
    } catch (error) {
      console.error('Parts Finder Error:', error);
      this.showError('Failed to load parts information');
    }
  }

  /**
   * Render parts UI
   */
  renderParts(data) {
    const { parts, estimated_cost } = data;
    
    let html = `
      <div class="parts-finder-container">
        <div class="parts-header">
          <h3><i class="fas fa-tools"></i> ${this.t('needed_parts')}</h3>
          <div class="estimated-cost">
            <span>${this.t('estimated_cost')}:</span>
            <strong>$${estimated_cost.min.toFixed(2)} - $${estimated_cost.max.toFixed(2)}</strong>
          </div>
        </div>
    `;
    
    // Primary parts (must have)
    if (parts.primary && parts.primary.length > 0) {
      html += `
        <div class="parts-section primary-parts">
          <h4><i class="fas fa-exclamation-circle"></i> ${this.t('required_parts')}</h4>
          ${parts.primary.map(part => this.renderPart(part)).join('')}
        </div>
      `;
    }
    
    // Secondary parts (recommended)
    if (parts.secondary && parts.secondary.length > 0) {
      html += `
        <div class="parts-section secondary-parts">
          <h4><i class="fas fa-info-circle"></i> ${this.t('recommended_parts')}</h4>
          ${parts.secondary.map(part => this.renderPart(part)).join('')}
        </div>
      `;
    }
    
    // Optional parts
    if (parts.optional && parts.optional.length > 0) {
      html += `
        <div class="parts-section optional-parts">
          <h4><i class="fas fa-plus-circle"></i> ${this.t('optional_parts')}</h4>
          ${parts.optional.map(part => this.renderPart(part)).join('')}
        </div>
      `;
    }
    
    html += `</div>`;
    this.container.innerHTML = html;
    
    // Add click tracking
    this.trackClicks();
  }

  /**
   * Render individual part card
   */
  renderPart(part) {
    const partName = part[`part_name_${this.currentLang}`] || part.part_name_en;
    const oemBadge = part.is_original 
      ? '<span class="badge badge-oem"><i class="fas fa-certificate"></i> OEM</span>'
      : '<span class="badge badge-aftermarket"><i class="fas fa-cog"></i> Aftermarket</span>';
    
    const rating = part.avg_rating 
      ? `<div class="part-rating">${this.renderStars(part.avg_rating)} (${part.review_count})</div>`
      : '';
    
    const compatibility = part.compatibility && part.compatibility.length > 0
      ? `<div class="compatibility-info">
           <i class="fas fa-check-circle"></i> ${part.compatibility_notes || this.t('check_compatibility')}
         </div>`
      : '';
    
    const difficulty = part.installation_difficulty
      ? `<div class="difficulty-badge difficulty-${part.installation_difficulty}">
           <i class="fas fa-wrench"></i> ${this.t('difficulty_' + part.installation_difficulty)}
         </div>`
      : '';
    
    return `
      <div class="part-card" data-part-id="${part.id}">
        <div class="part-header">
          <div class="part-title">
            <h5>${partName}</h5>
            ${oemBadge}
          </div>
          ${rating}
        </div>
        
        <div class="part-details">
          <div class="part-info">
            <div class="info-row">
              <span class="label"><i class="fas fa-hashtag"></i> OEM:</span>
              <span class="value"><code>${part.oem_number}</code></span>
            </div>
            ${part.manufacturer ? `
              <div class="info-row">
                <span class="label"><i class="fas fa-industry"></i> ${this.t('manufacturer')}:</span>
                <span class="value">${part.manufacturer}</span>
              </div>
            ` : ''}
            <div class="info-row">
              <span class="label"><i class="fas fa-dollar-sign"></i> ${this.t('price')}:</span>
              <span class="value price">$${part.price_min} - $${part.price_max}</span>
            </div>
            ${part.estimated_labor_hours ? `
              <div class="info-row">
                <span class="label"><i class="fas fa-clock"></i> ${this.t('labor')}:</span>
                <span class="value">${part.estimated_labor_hours}h</span>
              </div>
            ` : ''}
          </div>
          
          ${difficulty}
          ${compatibility}
          
          ${part.notes ? `
            <div class="part-notes">
              <i class="fas fa-info-circle"></i> ${part.notes}
            </div>
          ` : ''}
        </div>
        
        <div class="buy-links">
          <div class="buy-links-header">${this.t('where_to_buy')}:</div>
          <div class="marketplace-links">
            ${this.renderBuyLinks(part.buy_links)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render buy links for marketplaces
   */
  renderBuyLinks(links) {
    if (!links || links.length === 0) {
      return `<p class="no-links">${this.t('no_links_available')}</p>`;
    }
    
    const marketplaceIcons = {
      'realoem': 'fas fa-car',
      'ebay': 'fab fa-ebay',
      'amazon': 'fab fa-amazon',
      'aliexpress': 'fas fa-shopping-cart',
      'autodoc': 'fas fa-tools'
    };
    
    // Sort by price
    const sortedLinks = [...links].sort((a, b) => a.current_price - b.current_price);
    
    return sortedLinks.map(link => {
      const icon = marketplaceIcons[link.marketplace] || 'fas fa-shopping-bag';
      const inStock = link.in_stock ? '' : '<span class="out-of-stock">(Out of Stock)</span>';
      const shipping = link.shipping_cost > 0 
        ? `<span class="shipping">+$${link.shipping_cost.toFixed(2)} shipping</span>`
        : '<span class="free-shipping">Free shipping</span>';
      
      return `
        <a href="${link.affiliate_url}" 
           target="_blank" 
           rel="noopener noreferrer nofollow"
           class="marketplace-link ${!link.in_stock ? 'disabled' : ''}"
           data-link-id="${link.id}"
           data-marketplace="${link.marketplace}">
          <div class="marketplace-info">
            <i class="${icon}"></i>
            <span class="marketplace-name">${link.marketplace.toUpperCase()}</span>
          </div>
          <div class="price-info">
            <span class="price">$${link.current_price.toFixed(2)}</span>
            ${shipping}
          </div>
          ${inStock}
        </a>
      `;
    }).join('');
  }

  /**
   * Render star rating
   */
  renderStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star"></i>';
    if (halfStar) stars += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star"></i>';
    
    return `<span class="stars">${stars} ${rating.toFixed(1)}</span>`;
  }

  /**
   * Track affiliate link clicks
   */
  trackClicks() {
    const links = this.container.querySelectorAll('.marketplace-link');
    links.forEach(link => {
      link.addEventListener('click', async (e) => {
        const linkId = link.dataset.linkId;
        const marketplace = link.dataset.marketplace;
        
        // Track click
        try {
          await fetch('/api/parts/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link_id: linkId, marketplace })
          });
        } catch (error) {
          console.error('Failed to track click:', error);
        }
      });
    });
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.container.innerHTML = `
      <div class="parts-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>${this.t('loading_parts')}</p>
      </div>
    `;
  }

  /**
   * Show error message
   */
  showError(message) {
    this.container.innerHTML = `
      <div class="parts-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Translation helper
   */
  t(key) {
    const translations = {
      en: {
        needed_parts: 'Needed Parts',
        estimated_cost: 'Estimated Cost',
        required_parts: 'Required Parts',
        recommended_parts: 'Recommended Parts',
        optional_parts: 'Optional Parts',
        manufacturer: 'Manufacturer',
        price: 'Price',
        labor: 'Labor Time',
        where_to_buy: 'Where to Buy',
        no_links_available: 'No purchase links available',
        loading_parts: 'Loading parts information...',
        check_compatibility: 'Check compatibility',
        difficulty_easy: 'Easy',
        difficulty_medium: 'Medium',
        difficulty_hard: 'Hard',
        difficulty_professional: 'Professional Required'
      },
      ru: {
        needed_parts: 'Необходимые запчасти',
        estimated_cost: 'Примерная стоимость',
        required_parts: 'Обязательные запчасти',
        recommended_parts: 'Рекомендуемые запчасти',
        optional_parts: 'Дополнительные запчасти',
        manufacturer: 'Производитель',
        price: 'Цена',
        labor: 'Время работы',
        where_to_buy: 'Где купить',
        no_links_available: 'Ссылки недоступны',
        loading_parts: 'Загрузка информации о запчастях...',
        check_compatibility: 'Проверьте совместимость',
        difficulty_easy: 'Легко',
        difficulty_medium: 'Средне',
        difficulty_hard: 'Сложно',
        difficulty_professional: 'Требуется специалист'
      },
      ka: {
        needed_parts: 'საჭირო ნაწილები',
        estimated_cost: 'სავარაუდო ღირებულება',
        required_parts: 'სავალდებულო ნაწილები',
        recommended_parts: 'რეკომენდებული ნაწილები',
        optional_parts: 'დამატებითი ნაწილები',
        manufacturer: 'მწარმოებელი',
        price: 'ფასი',
        labor: 'სამუშაოს დრო',
        where_to_buy: 'სად ვიყიდოთ',
        no_links_available: 'ბმულები არ არის ხელმისაწვდომი',
        loading_parts: 'იტვირთება ინფორმაცია...',
        check_compatibility: 'შეამოწმეთ თავსებადობა',
        difficulty_easy: 'მარტივი',
        difficulty_medium: 'საშუალო',
        difficulty_hard: 'რთული',
        difficulty_professional: 'საჭიროა სპეციალისტი'
      }
    };
    
    return translations[this.currentLang]?.[key] || translations.en[key] || key;
  }
}

// Make it globally available
window.PartsFinderUI = PartsFinderUI;
