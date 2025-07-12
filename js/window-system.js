/**
 * WindowSystem - Spatial window management system
 * Handles all window positioning, dragging, resizing, and spatial stability
 * The "Snow Leopard Architecture" for maintaining window positions
 */
class WindowSystem {
    constructor() {
        this.windows = new Map(); // id -> window config
        this.maxZIndex = 100;
        this.HEADER_HEIGHT = 140;
        this.debug = false;
        
        // Position validation constants
        this.POSITION_CONSTRAINTS = {
            minX: 0,
            minY: this.HEADER_HEIGHT + 10, // 10px buffer below header
            maxXOffset: 100, // Minimum visible width from right edge
            maxYOffset: 100, // Minimum visible height from bottom edge
            minVisibleWidth: 50, // Minimum visible window width
            minVisibleHeight: 30  // Minimum visible window height (enough for title bar)
        };
        
        // Spatial stability system
        this.spatialObserver = null;
        this.lastKnownSpatialState = new Map();
        this.isUpdatingDOM = false;
        
        // View-specific position storage
        this.viewPositions = new Map(); // viewKey -> Map(windowId -> position)
        
        // Minimize state
        this.minimizedWindows = new Set();
        
        // Drag state
        this.draggedWindow = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isResizing = false;
        this.resizeData = null;
        
        this.init();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    init() {
        this.bindWindowEvents();
        this.bindResizeHandler();
        this.initSpatialStabilitySystem();
        this.initPositionMonitoring();
        
        // Make globally available for debugging
        window.windowSystem = this;
        console.log('🪟 WindowSystem initialized');
    }

    initSpatialStabilitySystem() {
        // Set up continuous monitoring of window positions and sizes
        this.spatialObserver = new MutationObserver((mutations) => {
            if (!this.isUpdatingDOM) {
                this.captureAllSpatialState();
            }
        });

        // Monitor for changes in the lists container
        const container = document.getElementById('lists-container');
        if (container) {
            this.spatialObserver.observe(container, {
                childList: true,
                attributes: true,
                attributeFilter: ['style'],
                subtree: true
            });
        }

        // Capture initial state
        setTimeout(() => this.captureAllSpatialState(), 100);
    }

    initPositionMonitoring() {
        // Set up periodic position validation to catch any windows that might get stuck
        this.positionMonitorInterval = setInterval(() => {
            const issues = this.scanForPositionIssues();
            if (issues.length > 0) {
                console.warn(`🚨 Found ${issues.length} position issues - auto-correcting...`);
                this.fixStuckWindows();
            }
        }, 5000); // Check every 5 seconds

        // Monitor window resize events to revalidate positions
        window.addEventListener('resize', () => {
            // Small delay to let the resize settle
            setTimeout(() => {
                const fixedCount = this.fixStuckWindows();
                if (fixedCount > 0) {
                    console.log(`📐 Window resized - fixed ${fixedCount} windows`);
                }
            }, 100);
        });

        // Run initial validation after a short delay
        setTimeout(() => {
            const fixedCount = this.fixStuckWindows();
            if (fixedCount > 0) {
                console.log(`🔍 Initial position validation fixed ${fixedCount} windows`);
            }
        }, 1000);
    }

    // ==========================================
    // WINDOW LIFECYCLE
    // ==========================================

    createWindow(id, type, config = {}) {
        const proposedPosition = config.position || this.getSmartPosition();
        const proposedSize = config.size || { width: 350, height: 400 };
        
        // Validate the proposed position
        const validPosition = this.validatePosition(
            proposedPosition.x, 
            proposedPosition.y, 
            proposedSize.width, 
            proposedSize.height
        );

        const windowConfig = {
            id,
            type, // 'list' or 'item'
            position: validPosition,
            size: proposedSize,
            zIndex: config.zIndex || this.maxZIndex++,
            minimized: false,
            _createdAt: Date.now(), // For debugging
            ...config
        };

        this.windows.set(id, windowConfig);
        
        console.log(`CREATE: Created window ${id} (${type}) at (${windowConfig.position.x}, ${windowConfig.position.y}) [${windowConfig._createdAt}]`);
        
        return windowConfig;
    }

    destroyWindow(id) {
        const window = this.windows.get(id);
        if (!window) return false;

        this.windows.delete(id);
        this.minimizedWindows.delete(id);
        this.lastKnownSpatialState.delete(`${window.type}-${id}`);
        
        // Remove DOM element
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            element.remove();
        }
        
        if (this.debug) {
            console.log(`Destroyed window ${id}`);
        }
        
        return true;
    }

    getWindow(id) {
        return this.windows.get(id);
    }

    getAllWindows() {
        return new Map(this.windows);
    }

    // ==========================================
    // POSITIONING
    // ==========================================

    moveWindow(id, x, y) {
        const window = this.windows.get(id);
        if (!window) return false;

        // Validate and correct position using new validation system
        const validPos = this.validatePosition(x, y, window.size.width, window.size.height);
        window.position.x = validPos.x;
        window.position.y = validPos.y;

        // Update DOM
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            element.style.left = validPos.x + 'px';
            element.style.top = validPos.y + 'px';
        }

        // Notify callback if provided
        if (this.onWindowMoved) {
            this.onWindowMoved(id, validPos.x, validPos.y);
        }

        if (this.debug) {
            console.log(`Moved window ${id} to (${validPos.x}, ${validPos.y})`);
        }

        return true;
    }

    // ==========================================
    // POSITION VALIDATION SYSTEM
    // ==========================================

    /**
     * Validates and corrects a position to ensure the window remains accessible
     * @param {number} x - Proposed X position
     * @param {number} y - Proposed Y position  
     * @param {number} width - Window width (optional, defaults to 350)
     * @param {number} height - Window height (optional, defaults to 400)
     * @returns {Object} Valid position {x, y}
     */
    validatePosition(x, y, width = 350, height = 400) {
        const constraints = this.POSITION_CONSTRAINTS;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate valid bounds ensuring window remains grabbable
        const minX = constraints.minX;
        const minY = constraints.minY;
        const maxX = viewportWidth - constraints.minVisibleWidth;
        const maxY = viewportHeight - constraints.minVisibleHeight;

        // Correct invalid positions
        let validX = x;
        let validY = y;

        // Horizontal constraints
        if (validX < minX) {
            validX = minX;
        } else if (validX > maxX) {
            validX = maxX;
        }

        // Vertical constraints (most important - prevent header overlap)
        if (validY < minY) {
            validY = minY;
            console.warn(`Position validation: Corrected Y from ${y} to ${validY} (below header)`);
        } else if (validY > maxY) {
            validY = maxY;
        }

        // Log corrections for debugging
        if (validX !== x || validY !== y) {
            console.log(`Position validation: (${x}, ${y}) → (${validX}, ${validY})`);
        }

        return { x: validX, y: validY };
    }

    /**
     * Legacy method for backward compatibility - now uses validatePosition
     */
    constrainPosition(x, y, width, height) {
        return this.validatePosition(x, y, width, height);
    }

    /**
     * Checks if a position would put the window in an inaccessible location
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {boolean} True if position is valid/accessible
     */
    isPositionAccessible(x, y) {
        const constraints = this.POSITION_CONSTRAINTS;
        return y >= constraints.minY && 
               x >= constraints.minX &&
               x <= (window.innerWidth - constraints.minVisibleWidth) &&
               y <= (window.innerHeight - constraints.minVisibleHeight);
    }

    getSmartPosition() {
        const baseX = 100;
        const baseY = this.HEADER_HEIGHT;
        const windowWidth = 350;
        const windowHeight = 400;
        const margin = 20;

        // If no existing windows, use base position
        if (this.windows.size === 0) {
            return { x: baseX, y: baseY };
        }

        // Try to find a position that doesn't overlap
        const maxAttempts = 20;
        let attempt = 0;

        while (attempt < maxAttempts) {
            const offsetX = (attempt % 5) * 30;
            const offsetY = Math.floor(attempt / 5) * 30;
            const candidateX = baseX + offsetX;
            const candidateY = baseY + offsetY;

            // Check if this position overlaps with any existing window
            const overlaps = Array.from(this.windows.values()).some(window => {
                const windowRight = window.position.x + windowWidth;
                const windowBottom = window.position.y + windowHeight;
                const candidateRight = candidateX + windowWidth;
                const candidateBottom = candidateY + windowHeight;

                return !(candidateX > windowRight + margin || 
                        candidateRight < window.position.x - margin ||
                        candidateY > windowBottom + margin || 
                        candidateBottom < window.position.y - margin);
            });

            if (!overlaps) {
                return { x: candidateX, y: candidateY };
            }

            attempt++;
        }

        // If we couldn't find a non-overlapping position, use cascading default
        const fallbackOffset = this.windows.size * 30;
        return {
            x: baseX + fallbackOffset,
            y: baseY + fallbackOffset
        };
    }

    // ==========================================
    // SIZING
    // ==========================================

    resizeWindow(id, width, height) {
        const window = this.windows.get(id);
        if (!window) return false;

        // Constrain size
        const minWidth = 300;
        const minHeight = 200;
        const constrainedWidth = Math.max(minWidth, width);
        const constrainedHeight = Math.max(minHeight, height);

        window.size.width = constrainedWidth;
        window.size.height = constrainedHeight;

        // Update DOM
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            element.style.width = constrainedWidth + 'px';
            element.style.height = constrainedHeight + 'px';
        }

        // Notify callback if provided
        if (this.onWindowResized) {
            this.onWindowResized(id, constrainedWidth, constrainedHeight);
        }

        if (this.debug) {
            console.log(`Resized window ${id} to ${constrainedWidth}x${constrainedHeight}`);
        }

        return true;
    }

    // ==========================================
    // Z-INDEX MANAGEMENT
    // ==========================================

    bringToFront(id) {
        const window = this.windows.get(id);
        if (!window) return false;

        window.zIndex = ++this.maxZIndex;

        // Update DOM
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            element.style.zIndex = window.zIndex;
        }

        if (this.debug) {
            console.log(`Brought window ${id} to front (z-index: ${window.zIndex})`);
        }

        return true;
    }

    // ==========================================
    // MINIMIZE/RESTORE
    // ==========================================

    minimizeWindow(id) {
        const window = this.windows.get(id);
        if (!window) return false;

        window.minimized = true;
        this.minimizedWindows.add(id);

        // Capture current state before minimizing
        this.captureWindowState(id);

        // Hide DOM element
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            element.style.display = 'none';
        }

        if (this.debug) {
            console.log(`Minimized window ${id}`);
        }

        return true;
    }

    restoreWindow(id) {
        const window = this.windows.get(id);
        if (!window) {
            console.error(`RESTORE: No window found for id ${id}`);
            return false;
        }

        // Validate and correct position before restoring
        const validPosition = this.validatePosition(
            window.position.x, 
            window.position.y, 
            window.size.width, 
            window.size.height
        );
        
        // Update window config with validated position
        window.position.x = validPosition.x;
        window.position.y = validPosition.y;

        window.minimized = false;
        this.minimizedWindows.delete(id);

        // Show DOM element
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            element.style.display = '';
            
            // Restore position and size with validated coordinates
            element.style.left = validPosition.x + 'px';
            element.style.top = validPosition.y + 'px';
            element.style.width = window.size.width + 'px';
            element.style.height = window.size.height + 'px';
            element.style.zIndex = window.zIndex;
        } else {
            console.error(`RESTORE: Could not find DOM element for window ${id}`);
        }

        // Bring to front
        this.bringToFront(id);

        if (this.debug) {
            console.log(`Restored window ${id}`);
        }

        return true;
    }

    // ==========================================
    // SPATIAL STABILITY SYSTEM
    // ==========================================

    captureAllSpatialState() {
        const allCards = document.querySelectorAll('.list-card');
        
        allCards.forEach(card => {
            const listId = card.dataset.listId;
            const itemId = card.dataset.itemId;
            const id = listId || itemId;
            const type = listId ? 'list' : 'item';
            
            if (id) {
                const key = `${type}-${id}`;
                
                this.lastKnownSpatialState.set(key, {
                    x: card.offsetLeft,
                    y: card.offsetTop,
                    width: card.offsetWidth,
                    height: card.offsetHeight,
                    zIndex: card.style.zIndex || '100'
                });
                
                // Update window config only if not minimized
                const window = this.windows.get(parseInt(id));
                if (window && !window.minimized) {
                    window.position.x = card.offsetLeft;
                    window.position.y = card.offsetTop;
                    window.size.width = card.offsetWidth;
                    window.size.height = card.offsetHeight;
                    window.zIndex = parseInt(card.style.zIndex) || 100;
                }
            }
        });
    }

    captureWindowState(id) {
        const window = this.windows.get(id);
        if (!window) return;

        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            window.position.x = element.offsetLeft;
            window.position.y = element.offsetTop;
            window.size.width = element.offsetWidth;
            window.size.height = element.offsetHeight;
            window.zIndex = parseInt(element.style.zIndex) || 100;
        }
    }

    restoreSpatialState() {
        this.lastKnownSpatialState.forEach((state, key) => {
            const element = document.querySelector(
                key.startsWith('list-') ? 
                `[data-list-id="${key.replace('list-', '')}"]` :
                `[data-item-id="${key.replace('item-', '')}"]`
            );
            
            if (element) {
                element.style.left = state.x + 'px';
                element.style.top = Math.max(this.HEADER_HEIGHT, state.y) + 'px';
                element.style.width = state.width + 'px';
                element.style.height = state.height + 'px';
                element.style.zIndex = state.zIndex;
            }
        });
    }

    // ==========================================
    // VIEW-SPECIFIC POSITION MANAGEMENT
    // ==========================================

    /**
     * Saves current window positions for a specific view context
     * @param {string} viewKey - Unique identifier for the view (e.g., "root", "list-123", "item-456")
     */
    savePositionsForView(viewKey) {
        const positions = new Map();
        
        this.windows.forEach((window, id) => {
            if (!window.minimized) {
                // Capture current DOM position
                const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
                if (element) {
                    positions.set(id, {
                        x: element.offsetLeft,
                        y: element.offsetTop,
                        width: element.offsetWidth,
                        height: element.offsetHeight,
                        zIndex: parseInt(element.style.zIndex) || 100
                    });
                } else {
                    // Fallback to stored position
                    positions.set(id, {
                        x: window.position.x,
                        y: window.position.y,
                        width: window.size.width,
                        height: window.size.height,
                        zIndex: window.zIndex
                    });
                }
            }
        });
        
        this.viewPositions.set(viewKey, positions);
        console.log(`💾 Saved positions for view: ${viewKey} (${positions.size} windows)`);
    }

    /**
     * Restores window positions for a specific view context
     * @param {string} viewKey - Unique identifier for the view
     */
    restorePositionsForView(viewKey) {
        const positions = this.viewPositions.get(viewKey);
        if (!positions) {
            console.log(`📂 No saved positions for view: ${viewKey}`);
            return;
        }

        let restoredCount = 0;
        positions.forEach((savedPos, windowId) => {
            const window = this.windows.get(windowId);
            if (window && !window.minimized) {
                // Validate position before applying
                const validPos = this.validatePosition(savedPos.x, savedPos.y, savedPos.width, savedPos.height);
                
                // Update window config
                window.position.x = validPos.x;
                window.position.y = validPos.y;
                window.size.width = savedPos.width;
                window.size.height = savedPos.height;
                window.zIndex = savedPos.zIndex;

                // Update DOM element
                const element = document.querySelector(`[data-${window.type}-id="${windowId}"]`);
                if (element) {
                    element.style.left = validPos.x + 'px';
                    element.style.top = validPos.y + 'px';
                    element.style.width = savedPos.width + 'px';
                    element.style.height = savedPos.height + 'px';
                    element.style.zIndex = savedPos.zIndex;
                    restoredCount++;
                }
            }
        });

        console.log(`📂 Restored positions for view: ${viewKey} (${restoredCount} windows)`);
    }

    /**
     * Generates a view key for the current application state
     * @param {string} currentView - 'root' or 'zoomed'
     * @param {number} zoomedListId - ID of zoomed list (if any)
     * @param {number} zoomedItemId - ID of zoomed item (if any)
     * @returns {string} Unique view key
     */
    generateViewKey(currentView, zoomedListId = null, zoomedItemId = null) {
        if (currentView === 'root') {
            return 'root';
        } else if (currentView === 'zoomed') {
            if (zoomedItemId) {
                return `list-${zoomedListId}-item-${zoomedItemId}`;
            } else {
                return `list-${zoomedListId}`;
            }
        }
        return 'unknown';
    }

    // ==========================================
    // EVENT HANDLING
    // ==========================================

    bindWindowEvents() {
        // Note: Events are now handled by AppController and delegated to WindowSystem
        // This prevents conflicts with other event handlers
        
        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        document.addEventListener('mouseup', () => {
            this.handleMouseUp();
        });
    }

    handleMouseDown(e) {
        const listCard = e.target.closest('.list-card');
        if (!listCard) return;

        const listId = listCard.dataset.listId;
        const itemId = listCard.dataset.itemId;
        const id = parseInt(listId || itemId);
        
        if (id) {
            this.bringToFront(id);
        }

        // Handle resize
        if (e.target.classList.contains('resize-handle')) {
            this.isResizing = true;
            this.resizeData = {
                id: id,
                startX: e.clientX,
                startY: e.clientY,
                startWidth: listCard.offsetWidth,
                startHeight: listCard.offsetHeight
            };
            e.preventDefault();
            return;
        }

        // Handle drag
        if (e.target.closest('.list-header')) {
            this.draggedWindow = {
                id: id,
                element: listCard,
                type: listId ? 'list' : 'item'
            };
            
            const cardRect = listCard.getBoundingClientRect();
            this.dragOffset.x = e.clientX - cardRect.left;
            this.dragOffset.y = e.clientY - cardRect.top;
            
            listCard.classList.add('dragging');
            listCard.style.zIndex = this.maxZIndex + 1000;
            
            e.preventDefault();
        }
    }

    handleMouseMove(e) {
        // Handle resize
        if (this.isResizing && this.resizeData) {
            const deltaX = e.clientX - this.resizeData.startX;
            const deltaY = e.clientY - this.resizeData.startY;
            
            const newWidth = Math.max(300, this.resizeData.startWidth + deltaX);
            const newHeight = Math.max(200, this.resizeData.startHeight + deltaY);
            
            this.resizeWindow(this.resizeData.id, newWidth, newHeight);
            return;
        }

        // Handle drag
        if (this.draggedWindow) {
            const newX = e.clientX - this.dragOffset.x;
            const newY = e.clientY - this.dragOffset.y;
            
            this.moveWindow(this.draggedWindow.id, newX, newY);
        }
    }

    handleMouseUp() {
        // End drag
        if (this.draggedWindow) {
            this.draggedWindow.element.classList.remove('dragging');
            this.bringToFront(this.draggedWindow.id);
            this.draggedWindow = null;
        }

        // End resize
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeData = null;
        }
    }

    bindResizeHandler() {
        window.addEventListener('resize', () => {
            // Fix positions of all windows when window is resized
            this.windows.forEach((window, id) => {
                const constrainedPos = this.constrainPosition(window.position.x, window.position.y);
                if (constrainedPos.x !== window.position.x || constrainedPos.y !== window.position.y) {
                    this.moveWindow(id, constrainedPos.x, constrainedPos.y);
                }
            });
        });
    }

    // ==========================================
    // TASKBAR MANAGEMENT
    // ==========================================

    updateTaskbar() {
        const taskbarItems = document.getElementById('taskbar-items');
        if (!taskbarItems) return;

        let taskbarHTML = '';

        // Add minimized windows
        this.minimizedWindows.forEach(id => {
            const window = this.windows.get(id);
            if (window) {
                const title = window.title || `Window ${id}`;
                const displayTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;
                
                taskbarHTML += `
                    <button class="taskbar-item" 
                            data-${window.type}-id="${id}" 
                            data-action="restore-${window.type}" 
                            title="${title}">
                        ${displayTitle}
                    </button>
                `;
            }
        });

        taskbarItems.innerHTML = taskbarHTML;
    }

    handleTaskbarClick(e) {
        if (!e.target.classList.contains('taskbar-item')) return;

        const action = e.target.dataset.action;
        const listId = e.target.dataset.listId;
        const itemId = e.target.dataset.itemId;
        const id = parseInt(listId || itemId);

        if (action === 'restore-list' || action === 'restore-item') {
            this.restoreWindow(id);
        }
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Scans all windows and automatically fixes any that are in inaccessible positions
     * This includes windows stuck behind the header, off-screen, or otherwise unreachable
     * @returns {number} Number of windows that were fixed
     */
    fixStuckWindows() {
        let fixedCount = 0;
        const fixes = [];
        
        this.windows.forEach((window, id) => {
            const originalPos = { x: window.position.x, y: window.position.y };
            const validatedPos = this.validatePosition(
                window.position.x, 
                window.position.y, 
                window.size.width, 
                window.size.height
            );
            
            // Check if position needed correction
            if (originalPos.x !== validatedPos.x || originalPos.y !== validatedPos.y) {
                const reason = [];
                if (originalPos.y < this.POSITION_CONSTRAINTS.minY) {
                    reason.push('behind header');
                }
                if (originalPos.x < this.POSITION_CONSTRAINTS.minX) {
                    reason.push('left edge');
                }
                if (originalPos.x > window.innerWidth - this.POSITION_CONSTRAINTS.minVisibleWidth) {
                    reason.push('right edge');
                }
                if (originalPos.y > window.innerHeight - this.POSITION_CONSTRAINTS.minVisibleHeight) {
                    reason.push('bottom edge');
                }
                
                fixes.push({
                    id,
                    from: originalPos,
                    to: validatedPos,
                    reason: reason.join(', ')
                });
                
                // Apply the fix
                this.moveWindow(id, validatedPos.x, validatedPos.y);
                fixedCount++;
            }
        });
        
        if (fixedCount > 0) {
            console.log(`🔧 Fixed ${fixedCount} stuck windows:`);
            fixes.forEach(fix => {
                console.log(`  Window ${fix.id}: (${fix.from.x}, ${fix.from.y}) → (${fix.to.x}, ${fix.to.y}) [${fix.reason}]`);
            });
        } else {
            console.log('✅ No stuck windows found - all windows are accessible');
        }
        
        return fixedCount;
    }

    /**
     * Validates all window positions and reports any issues without fixing them
     * Useful for diagnostics and monitoring
     * @returns {Array} Array of position issues found
     */
    scanForPositionIssues() {
        const issues = [];
        
        this.windows.forEach((window, id) => {
            const pos = window.position;
            const size = window.size;
            const constraints = this.POSITION_CONSTRAINTS;
            
            // Check various accessibility issues
            if (pos.y < constraints.minY) {
                issues.push({
                    id,
                    type: 'behind_header',
                    position: pos,
                    message: `Window ${id} is behind header (y=${pos.y} < ${constraints.minY})`
                });
            }
            
            if (pos.x < constraints.minX) {
                issues.push({
                    id,
                    type: 'left_edge',
                    position: pos,
                    message: `Window ${id} is off left edge (x=${pos.x})`
                });
            }
            
            if (pos.x > window.innerWidth - constraints.minVisibleWidth) {
                issues.push({
                    id,
                    type: 'right_edge',
                    position: pos,
                    message: `Window ${id} is off right edge`
                });
            }
            
            if (pos.y > window.innerHeight - constraints.minVisibleHeight) {
                issues.push({
                    id,
                    type: 'bottom_edge',
                    position: pos,
                    message: `Window ${id} is off bottom edge`
                });
            }
        });
        
        return issues;
    }

    enableDebug() {
        this.debug = true;
        console.log('WindowSystem debug mode enabled');
        console.log('Available commands:');
        console.log('- windowSystem.inspectWindow(id) - inspect specific window');
        console.log('- windowSystem.inspectAll() - inspect all windows');
        console.log('- windowSystem.fixStuckWindows() - fix stuck windows automatically');
        console.log('- windowSystem.scanForPositionIssues() - scan for position issues');
        console.log('- windowSystem.validatePosition(x, y, w, h) - test position validation');
        console.log('- windowSystem.savePositionsForView(viewKey) - save current positions');
        console.log('- windowSystem.restorePositionsForView(viewKey) - restore saved positions');
        console.log('- windowSystem.viewPositions - inspect all saved view positions');
        console.log('- windowSystem.captureAllSpatialState() - capture state');
        console.log('- windowSystem.restoreSpatialState() - restore state');
    }

    inspectWindow(id) {
        const window = this.windows.get(id);
        const element = document.querySelector(`[data-${window?.type}-id="${id}"]`);
        
        console.log('=== WINDOW INSPECTION ===');
        console.log('Window config:', window);
        console.log('DOM element:', element);
        if (element) {
            console.log('DOM position:', {
                x: element.offsetLeft,
                y: element.offsetTop
            });
            console.log('DOM size:', {
                width: element.offsetWidth,
                height: element.offsetHeight
            });
        }
    }

    inspectAll() {
        console.log('=== ALL WINDOWS ===');
        this.windows.forEach((window, id) => {
            console.log(`Window ${id}:`, {
                type: window.type,
                position: window.position,
                size: window.size,
                zIndex: window.zIndex,
                minimized: window.minimized
            });
        });
    }

    getStats() {
        return {
            totalWindows: this.windows.size,
            minimizedWindows: this.minimizedWindows.size,
            maxZIndex: this.maxZIndex,
            spatialStates: this.lastKnownSpatialState.size
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindowSystem;
}