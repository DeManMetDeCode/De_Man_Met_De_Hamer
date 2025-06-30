/**
 * Clean Object Pool System - JavaScript Only (Simplified Version)
 * UPDATED: Optimized to work seamlessly with external search functionality
 * FIXED: Removes duplicates by clearing original elements after loading
 * ENHANCED: More frequent gap filling calculations
 */

class CleanGridPool {
  constructor(options = {}) {
    this.config = {
      containerSelector: options.containerSelector || '#dynamicGrid',
      defaultShowCount: options.defaultShowCount || 100,
      fullWidthEveryRows: options.fullWidthEveryRows || 5,
      columnsCount: options.columnsCount || 6,
      debug: options.debug || false
    };

    this.pools = {
      projects: [],
      squares: [],
      custom: [],
      fullWidth: [],
      mixed: []
    };

    this.state = {
      currentShowCount: this.config.defaultShowCount,
      isInitialized: false
    };

    this.container = document.querySelector(this.config.containerSelector);

    this.init();
  }

  initializeCustomComponents() {
    this.initializeFullWidthComponents();
    this.initializeCrocodileComponents(); // Add this line
    
    document.dispatchEvent(new CustomEvent('gridRerendered', {
      detail: { gridInstance: this }
    }));
  }

  // Add this new method to handle crocodile initialization
  initializeCrocodileComponents() {
    const crocodileContainers = this.container.querySelectorAll('.crocodile-container');
    
    crocodileContainers.forEach((container) => {
      // Check if already initialized to prevent duplicates
      if (container.querySelector('.croc-wrapper')) {
        return;
      }
      
      // Trigger crocodile initialization if function exists
      if (typeof window.initializeCrocodiles === 'function') {
        window.initializeCrocodiles();
      } else {
        // If the function doesn't exist globally, dispatch an event
        document.dispatchEvent(new CustomEvent('initializeCrocodiles', {
          detail: { container: container }
        }));
      }
    });
  }

  init() {
    if (!this.container) {
      return;
    }

    this.loadFromDOM();
    this.createProperRowLayout();
    this.renderGrid();
    this.initializeCustomComponents();
    
    // Mark page as loaded immediately
    document.body.classList.add('page-loaded');
    
    // Listen for search events to ensure grid updates properly
    this.setupSearchIntegration();
    
    // Set initialization flag after everything is done
    this.state.isInitialized = true;
  }

  setupSearchIntegration() {
    // Listen for search events and refresh grid if needed
    document.addEventListener('projectSearch', (event) => {
      // Small delay to allow search to complete, then refresh custom components
      setTimeout(() => {
        this.refreshVisibleElements();
      }, 100);
    });
    
    // Listen for grid re-render requests
    document.addEventListener('gridRefreshRequested', () => {
      this.refreshVisibleElements();
    });
  }

  // New method that recalculates layout and re-renders
  refreshGrid() {
    if (!this.state.isInitialized) return;
    
    if (this.config.debug) {
      console.log('Refreshing grid with new gap calculations...');
    }
    
    // Recalculate the layout with fresh gap filling
    this.createProperRowLayout();
    this.renderGrid();
    
    // Re-initialize components
    setTimeout(() => {
      this.refreshVisibleElements();
    }, 50);
  }

  refreshVisibleElements() {
    // Re-initialize components for currently visible elements
    this.initializeCustomComponents();
  }

  loadFromDOM() {
    const projectCards = this.container.querySelectorAll('.project-card');
    const squares = this.container.querySelectorAll('.square, [data-type="square"]');
    const customItems = this.container.querySelectorAll('.break-glass-card, [data-type="custom"], [data-component="break-glass"]');
    const fullWidthItems = this.container.querySelectorAll('.full-width-component, [data-type="full-width"]');

    if (this.config.debug) {
      console.log('=== DOM Order Debug ===');
      console.log(`Found: ${projectCards.length} projects, ${squares.length} squares, ${customItems.length} custom, ${fullWidthItems.length} full-width`);
    }
    
    // Store original elements for removal
    const elementsToRemove = [];
    
    projectCards.forEach((element, index) => {
      const titleEl = element.querySelector('.project-title, h3, .title, .project-details h2, h2');
      const dateEl = element.querySelector('.date, .project-date');
      const title = titleEl ? titleEl.textContent.trim() : `Project ${index}`;
      const date = dateEl ? dateEl.textContent.trim() : 'No date';
      
      if (this.config.debug && index < 10) {
        console.log(`${index + 1}. ${title} - ${date}`);
      }
      
      this.pools.projects.push({
        element: element.cloneNode(true),
        type: 'project',
        spans: this.getItemSpans(element),
        data: { id: `project-${index}`, index, title },
        originalOrder: Array.from(this.container.children).indexOf(element)
      });
      
      elementsToRemove.push(element);
    });

    squares.forEach((element, index) => {
      this.pools.squares.push({
        element: element.cloneNode(true),
        type: 'square',
        spans: this.getItemSpans(element),
        data: { id: `square-${index}`, index },
        originalOrder: Array.from(this.container.children).indexOf(element)
      });
      
      elementsToRemove.push(element);
    });

    customItems.forEach((element, index) => {
      this.pools.custom.push({
        element: element.cloneNode(true),
        type: 'custom',
        spans: this.getItemSpans(element),
        data: { id: `custom-${index}`, index },
        originalOrder: Array.from(this.container.children).indexOf(element)
      });
      
      elementsToRemove.push(element);
    });

    fullWidthItems.forEach((element, index) => {
      this.pools.fullWidth.push({
        element: element.cloneNode(true),
        type: 'fullWidth',
        spans: this.config.columnsCount,
        data: { id: `fullwidth-${index}`, index },
        originalOrder: Array.from(this.container.children).indexOf(element)
      });
      
      elementsToRemove.push(element);
    });
    
    // Remove original elements to prevent duplicates
    elementsToRemove.forEach(element => {
      if (element.parentNode) {
        element.remove();
      }
    });
    
    if (this.config.debug) {
      console.log(`Loaded and cleaned: ${this.pools.projects.length} projects, ${this.pools.squares.length} squares, ${this.pools.custom.length} custom items`);
    }
  }

  getItemSpans(element) {
    if (element.classList.contains('landscape-card') || element.classList.contains('landscape')) {
      return 2;
    }
    return 1;
  }

  createProperRowLayout() {
    this.pools.mixed = [];
    
    // Combine all regular items and shuffle them fresh each time
    let regularItems = [
      ...this.pools.projects,
      ...this.pools.squares,
      ...this.pools.custom
    ];

    if (regularItems.length === 0) {
      return;
    }

    // Shuffle the array to randomly distribute squares among projects each time
    this.shuffleArray(regularItems);

    // Now lay out items and track gaps in real-time
    let currentRow = 0;
    let currentColumn = 0;
    let regularRowsProcessed = 0;
    let fullWidthIndex = 0;
    
    const totalColumns = this.config.columnsCount;
    const rowsBeforeFullWidth = this.config.fullWidthEveryRows;
    const fullWidthItemsToUse = this.pools.fullWidth.length;

    // Track which items can be duplicated (squares and small custom items)
    // ENHANCED: More aggressive gap filling with squares
    const baseSquares = [...this.pools.squares];
    const duplicableItems = [
      ...baseSquares,
      ...baseSquares, // Double the squares
      ...baseSquares, // Triple the squares for even more gap filling
      ...this.pools.custom.filter(item => (item.spans || 1) === 1)
    ];

    // Track positions of placed squares to maintain distance
    this.placedSquarePositions = [];

    for (let i = 0; i < regularItems.length; i++) {
      const item = regularItems[i];
      const itemSpans = item.spans || 1;
      
      // Check if we need to move to next row
      if (currentColumn + itemSpans > totalColumns) {
        // Fill any remaining gaps in current row before moving to next
        const gapsInCurrentRow = totalColumns - currentColumn;
        if (gapsInCurrentRow > 0 && duplicableItems.length > 0) {
          for (let g = 0; g < gapsInCurrentRow; g++) {
            const gapPosition = { row: currentRow, col: currentColumn + g };
            
            // Choose item based on distance from other squares
            const sourceItem = this.selectItemForGap(duplicableItems, gapPosition);
            
            const duplicatedItem = {
              ...sourceItem,
              element: sourceItem.element.cloneNode(true),
              data: { 
                ...sourceItem.data, 
                id: `${sourceItem.data.id}-gap-fill-${currentRow}-${currentColumn + g}`,
                index: `${sourceItem.data.index}-gap-${g}`
              },
              isDuplicate: true,
              rowPosition: currentRow,
              columnStart: currentColumn + g
            };
            this.pools.mixed.push(duplicatedItem);
            
            // Track if we placed a square
            if (sourceItem.type === 'square') {
              this.placedSquarePositions.push({
                row: currentRow,
                col: currentColumn + g,
                type: 'duplicate'
              });
            }
          }
        }
        
        regularRowsProcessed++;
        currentRow++;
        currentColumn = 0;
        
        // Check for full-width break
        if (regularRowsProcessed > 0 && 
            regularRowsProcessed % rowsBeforeFullWidth === 0 && 
            fullWidthIndex < fullWidthItemsToUse) {
          
          this.pools.mixed.push({
            ...this.pools.fullWidth[fullWidthIndex],
            rowPosition: currentRow,
            columnStart: 0,
            isFullWidth: true
          });
          fullWidthIndex++;
          currentRow++;
        }
      }
      
      this.pools.mixed.push({
        ...item,
        rowPosition: currentRow,
        columnStart: currentColumn
      });
      
      // Track square positions for distance calculation
      if (item.type === 'square') {
        this.placedSquarePositions.push({
          row: currentRow,
          col: currentColumn,
          type: 'original'
        });
      }
      
      currentColumn += itemSpans;
    }
    
    // Fill any remaining gaps in the last row
    const finalGaps = totalColumns - currentColumn;
    if (finalGaps > 0 && duplicableItems.length > 0) {
      for (let g = 0; g < finalGaps; g++) {
        const gapPosition = { row: currentRow, col: currentColumn + g };
        
        // Choose item based on distance from other squares
        const sourceItem = this.selectItemForGap(duplicableItems, gapPosition);
        
        const duplicatedItem = {
          ...sourceItem,
          element: sourceItem.element.cloneNode(true),
          data: { 
            ...sourceItem.data, 
            id: `${sourceItem.data.id}-final-gap-${currentColumn + g}`,
            index: `${sourceItem.data.index}-final-${g}`
          },
          isDuplicate: true,
          rowPosition: currentRow,
          columnStart: currentColumn + g
        };
        this.pools.mixed.push(duplicatedItem);
        
        // Track if we placed a square
        if (sourceItem.type === 'square') {
          this.placedSquarePositions.push({
            row: currentRow,
            col: currentColumn + g,
            type: 'duplicate'
          });
        }
      }
    }
    
    // Add remaining full-width items
    while (fullWidthIndex < fullWidthItemsToUse) {
      currentRow++;
      this.pools.mixed.push({
        ...this.pools.fullWidth[fullWidthIndex],
        rowPosition: currentRow,
        columnStart: 0,
        isFullWidth: true
      });
      fullWidthIndex++;
    }
    
    if (this.config.debug) {
      console.log('=== Final Mixed Order with Gap Filling ===');
      const duplicateCount = this.pools.mixed.filter(item => item.isDuplicate).length;
      const squareCount = this.placedSquarePositions.length;
      console.log(`Total items: ${this.pools.mixed.length} (${duplicateCount} gap-fillers added, ${squareCount} squares total)`);
      
      this.pools.mixed.slice(0, 20).forEach((item, index) => {
        const title = item.data.title || `${item.type} ${item.data.index}`;
        const type = item.isFullWidth ? 'FULL-WIDTH' : item.type;
        const isDupe = item.isDuplicate ? ' (GAP-FILLER)' : '';
        console.log(`${index + 1}. ${title} (${type})${isDupe} - Row: ${item.rowPosition}, Col: ${item.columnStart}`);
      });
    }
  }

  // New method to select items for gaps based on distance from existing squares
  selectItemForGap(duplicableItems, gapPosition) {
    const minDistance = 5; // Minimum distance between squares (in grid cells)
    
    // Separate squares from other items
    const squares = duplicableItems.filter(item => item.type === 'square');
    const nonSquares = duplicableItems.filter(item => item.type !== 'square');
    
    // Calculate distance to nearest square
    const distanceToNearestSquare = this.getDistanceToNearestSquare(gapPosition);
    
    if (this.config.debug && this.placedSquarePositions.length > 0) {
      console.log(`Gap at (${gapPosition.row}, ${gapPosition.col}) - distance to nearest square: ${distanceToNearestSquare}`);
    }
    
    // If we're too close to another square, prefer non-square items
    if (distanceToNearestSquare < minDistance && nonSquares.length > 0) {
      const randomIndex = Math.floor(Math.random() * nonSquares.length);
      return nonSquares[randomIndex];
    }
    
    // If we're far enough away, we can use squares but with some randomness
    if (distanceToNearestSquare >= minDistance) {
      // 70% chance for square, 30% for other items if we have both
      const useSquare = Math.random() < 0.7;
      
      if (useSquare && squares.length > 0) {
        const randomIndex = Math.floor(Math.random() * squares.length);
        return squares[randomIndex];
      } else if (nonSquares.length > 0) {
        const randomIndex = Math.floor(Math.random() * nonSquares.length);
        return nonSquares[randomIndex];
      }
    }
    
    // Fallback: random selection from all available items
    const randomIndex = Math.floor(Math.random() * duplicableItems.length);
    return duplicableItems[randomIndex];
  }

  // Calculate distance to the nearest placed square
  getDistanceToNearestSquare(position) {
    if (this.placedSquarePositions.length === 0) {
      return Infinity; // No squares placed yet
    }
    
    let minDistance = Infinity;
    
    this.placedSquarePositions.forEach(squarePos => {
      // Calculate Manhattan distance (more appropriate for grid layout)
      const rowDiff = Math.abs(position.row - squarePos.row);
      const colDiff = Math.abs(position.col - squarePos.col);
      const distance = Math.max(rowDiff, colDiff); // Use Chebyshev distance (max of row/col diff)
      
      if (distance < minDistance) {
        minDistance = distance;
      }
    });
    
    return minDistance;
  }

  // Fisher-Yates shuffle algorithm for random distribution
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  renderGrid() {
    if (!this.container) return;

    const itemsToShow = this.pools.mixed.slice(0, this.state.currentShowCount);
    
    // Clear container completely before rendering
    this.container.innerHTML = '';

    const itemsByRow = {};
    itemsToShow.forEach(item => {
      if (!itemsByRow[item.rowPosition]) {
        itemsByRow[item.rowPosition] = [];
      }
      itemsByRow[item.rowPosition].push(item);
    });

    Object.keys(itemsByRow).sort((a, b) => parseInt(a) - parseInt(b)).forEach(rowIndex => {
      const rowItems = itemsByRow[rowIndex];
      
      rowItems.forEach((item) => {
        const element = item.element.cloneNode(true);
        
        element.classList.add(`grid-row-${item.rowPosition}`);
        element.classList.add(`grid-col-start-${item.columnStart}`);
        
        const globalIndex = this.pools.mixed.indexOf(item);
        element.style.animationDelay = `${globalIndex * 0.05}s`;
        
        // Add data attributes that search can use
        element.setAttribute('data-pool-type', item.type);
        element.setAttribute('data-row', item.rowPosition);
        element.setAttribute('data-col-start', item.columnStart);
        element.setAttribute('data-spans', item.spans);
        
        if (item.isDuplicate) {
          element.setAttribute('data-gap-filler', 'true');
        }
        
        if (item.isFullWidth) {
          element.classList.add('full-width-active');
        }
        
        this.container.appendChild(element);
      });
    });
    
    setTimeout(() => {
      this.initializeCustomComponents();
    }, 100);
  }

  initializeFullWidthComponents() {
    const fullWidthItems = this.container.querySelectorAll('.full-width-component, [data-type="full-width"]');

    fullWidthItems.forEach((item) => {
      const form = item.querySelector('.newsletter-form');
      if (form) {
        // Remove existing listeners to prevent duplicates
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const email = newForm.querySelector('.newsletter-input').value;
          if (email) {
            alert(`Thank you for subscribing with: ${email}`);
            newForm.reset();
          }
        });
      }
    });
  }

  // Public method to refresh the grid (useful after search operations)
  refresh() {
    this.refreshVisibleElements();
  }
}

// CategoryFilter will be loaded separately from your standalone script

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  
  const isProjectsRoute = currentPath === '/projects' || 
                         currentPath === '/projects/' || 
                         currentPath.startsWith('/projects/');
  
  if (isProjectsRoute) {
    // Ensure only one instance is created
    if (!window.cleanGridPool) {
      window.cleanGridPool = new CleanGridPool({
        containerSelector: '#dynamicGrid',
        defaultShowCount: 600,
        fullWidthEveryRows: 15,
        columnsCount: 6,
        debug: false
      });

      window.gridPool = window.cleanGridPool;
    }
  } else {
    setTimeout(() => {
      document.body.classList.add('page-loaded');
    }, 100);
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.querySelector('.search-input');
  const searchContainer = document.querySelector('.search-container');
  const logoElement = document.querySelector('.logo-element');
  const categoryFilter = document.querySelector('.category-filter'); // Adjust selector as needed
  
  if (!searchInput || !searchContainer) return;
  
  function checkSearchWidth() {
    const viewportWidth = window.innerWidth;
    const searchWidth = searchContainer.offsetWidth;
    const widthPercentage = (searchWidth / viewportWidth) * 100;
    
    // Hide elements when search reaches 60% of viewport width
    if (widthPercentage >= 60) {
      if (logoElement) logoElement.style.display = 'none';
      if (categoryFilter) categoryFilter.style.display = 'none';
      document.body.classList.add('search-expanded');
    } else {
      if (logoElement) logoElement.style.display = '';
      if (categoryFilter) categoryFilter.style.display = '';
      document.body.classList.remove('search-expanded');
    }
  }
  
  // Check on input events
  searchInput.addEventListener('input', checkSearchWidth);
  searchInput.addEventListener('focus', checkSearchWidth);
  searchInput.addEventListener('blur', checkSearchWidth);
  
  // Check on window resize
  window.addEventListener('resize', checkSearchWidth);
  
  // Initial check
  checkSearchWidth();
});

// ====================================
// RESPONSIVE NAVIGATION JAVASCRIPT
// ====================================

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const bodyOverlay = document.getElementById('bodyOverlay');
    const body = document.body;

    // Get filter and search elements
    const desktopFilters = document.querySelectorAll('input[name="category-filter"]');
    const mobileFilters = document.querySelectorAll('input[name="mobile-category-filter"]');
    const searchInputs = document.querySelectorAll('.search-input');

    // ====================================
    // MOBILE MENU FUNCTIONS
    // ====================================

    function toggleMobileMenu() {
        const isOpen = mobileOverlay.classList.contains('open');
        
        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }

    function openMobileMenu() {
        hamburgerMenu.classList.add('open');
        mobileOverlay.classList.add('open');
        bodyOverlay.classList.add('active');
        body.style.overflow = 'hidden';
        
        // Add aria attributes for accessibility
        hamburgerMenu.setAttribute('aria-expanded', 'true');
        mobileOverlay.setAttribute('aria-hidden', 'false');
    }

    function closeMobileMenu() {
        hamburgerMenu.classList.remove('open');
        mobileOverlay.classList.remove('open');
        bodyOverlay.classList.remove('active');
        body.style.overflow = '';
        
        // Update aria attributes
        hamburgerMenu.setAttribute('aria-expanded', 'false');
        mobileOverlay.setAttribute('aria-hidden', 'true');
    }

    // ====================================
    // EVENT LISTENERS
    // ====================================

    // Mobile menu toggle
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', toggleMobileMenu);
    }

    // Close menu when clicking overlay
    if (bodyOverlay) {
        bodyOverlay.addEventListener('click', closeMobileMenu);
    }

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileOverlay && mobileOverlay.classList.contains('open')) {
            closeMobileMenu();
        }
    });

    // ====================================
    // FILTER SYNCHRONIZATION WITH GRID REFRESH
    // ====================================

    // Sync desktop to mobile filters
    desktopFilters.forEach((filter, index) => {
        filter.addEventListener('change', () => {
            if (filter.checked && mobileFilters[index]) {
                mobileFilters[index].checked = true;
                
                // Trigger any existing filter functionality
                const event = new Event('change', { bubbles: true });
                mobileFilters[index].dispatchEvent(event);
            }
        });
    });

    // Sync mobile to desktop filters
    mobileFilters.forEach((filter, index) => {
        filter.addEventListener('change', () => {
            if (filter.checked && desktopFilters[index]) {
                desktopFilters[index].checked = true;
                
                // Trigger any existing filter functionality
                const event = new Event('change', { bubbles: true });
                desktopFilters[index].dispatchEvent(event);
                
                // Close mobile menu after selection
                setTimeout(() => {
                    closeMobileMenu();
                }, 300);
            }
        });
    });

    // ====================================
    // SEARCH SYNCHRONIZATION WITH GRID REFRESH
    // ====================================

    searchInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const searchValue = e.target.value;
            
            // Sync all search inputs
            searchInputs.forEach(otherInput => {
                if (otherInput !== e.target) {
                    otherInput.value = searchValue;
                }
            });
            
            // Trigger any existing search functionality
            const event = new Event('input', { bubbles: true });
            searchInputs.forEach(otherInput => {
                if (otherInput !== e.target) {
                    otherInput.dispatchEvent(event);
                }
            });
        });

        // Close mobile menu when search is focused (optional UX enhancement)
        input.addEventListener('focus', () => {
            if (input.closest('.mobile-overlay')) {
                // Don't close immediately when focusing mobile search
                return;
            }
        });
    });

    // ====================================
    // WINDOW RESIZE HANDLER
    // ====================================

    let resizeTimeout;
    window.addEventListener('resize', () => {
        // Debounce resize events
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Close mobile menu if window becomes large enough
            if (window.innerWidth > 768 && mobileOverlay && mobileOverlay.classList.contains('open')) {
                closeMobileMenu();
            }
        }, 250);
    });

    // ====================================
    // ACCESSIBILITY ENHANCEMENTS
    // ====================================

    // Trap focus within mobile overlay when open
    function trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements[focusableElements.length - 1];

        element.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusableElement) {
                        lastFocusableElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusableElement) {
                        firstFocusableElement.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    }

    if (mobileOverlay) {
        trapFocus(mobileOverlay);
    }

    // ====================================
    // INITIALIZATION
    // ====================================

    // Set initial aria attributes
    if (hamburgerMenu) {
        hamburgerMenu.setAttribute('aria-expanded', 'false');
        hamburgerMenu.setAttribute('aria-controls', 'mobileOverlay');
    }

    if (mobileOverlay) {
        mobileOverlay.setAttribute('aria-hidden', 'true');
        mobileOverlay.setAttribute('role', 'dialog');
        mobileOverlay.setAttribute('aria-modal', 'true');
        mobileOverlay.setAttribute('aria-label', 'Navigation menu');
    }

    // ====================================
    // INTEGRATION WITH EXISTING FUNCTIONALITY
    // ====================================

    // If you have existing category filter functionality, make sure it works with both sets of filters
    function handleCategoryChange(selectedCategory) {
        // Update both desktop and mobile filters
        desktopFilters.forEach(filter => {
            filter.checked = filter.value === selectedCategory;
        });
        
        mobileFilters.forEach(filter => {
            filter.checked = filter.value === selectedCategory;
        });
        
        // Call your existing filter logic here
        if (window.filterProjects) {
            window.filterProjects(selectedCategory);
        }
    }

    // If you have existing search functionality, make sure it works with both search inputs
    function handleSearchInput(searchTerm) {
        // Update both search inputs
        searchInputs.forEach(input => {
            input.value = searchTerm;
        });
        
        // Call your existing search logic here
        if (window.searchProjects) {
            window.searchProjects(searchTerm);
        }
    }

    // Export functions for external use if needed
    window.responsiveNav = {
        openMobileMenu,
        closeMobileMenu,
        toggleMobileMenu,
        handleCategoryChange,
        handleSearchInput
    };

    console.log('Responsive navigation with grid refresh integration initialized successfully');
});