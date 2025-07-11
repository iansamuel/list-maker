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
        
        // Spatial stability system
        this.spatialObserver = null;
        this.lastKnownSpatialState = new Map();
        this.isUpdatingDOM = false;
        
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

    // ==========================================
    // WINDOW LIFECYCLE
    // ==========================================

    createWindow(id, type, config = {}) {
        const windowConfig = {
            id,
            type, // 'list' or 'item'
            position: config.position || this.getSmartPosition(),
            size: config.size || { width: 350, height: 400 },
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

        // Constrain position
        const constrainedPos = this.constrainPosition(x, y);
        window.position.x = constrainedPos.x;
        window.position.y = constrainedPos.y;

        // Update DOM
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            element.style.left = constrainedPos.x + 'px';
            element.style.top = constrainedPos.y + 'px';
        }

        // Notify callback if provided
        if (this.onWindowMoved) {
            this.onWindowMoved(id, constrainedPos.x, constrainedPos.y);
        }

        if (this.debug) {
            console.log(`Moved window ${id} to (${constrainedPos.x}, ${constrainedPos.y})`);
        }

        return true;
    }

    constrainPosition(x, y) {
        const minX = 0;
        const minY = this.HEADER_HEIGHT;
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;

        return {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        };
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

        console.log(`MINIMIZE: Before capturing state for window ${id} [${window._createdAt}]:`, {
            position: window.position,
            size: window.size
        });

        window.minimized = true;
        this.minimizedWindows.add(id);

        // Capture current state before minimizing
        this.captureWindowState(id);

        console.log(`MINIMIZE: After capturing state for window ${id}:`, {
            position: window.position,
            size: window.size
        });

        // Hide DOM element
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            console.log(`MINIMIZE: DOM element position:`, {
                left: element.offsetLeft,
                top: element.offsetTop,
                width: element.offsetWidth,
                height: element.offsetHeight
            });
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

        console.log(`RESTORE: Restoring window ${id} [${window._createdAt}] with data:`, {
            position: window.position,
            size: window.size,
            zIndex: window.zIndex
        });

        window.minimized = false;
        this.minimizedWindows.delete(id);

        // Show DOM element
        const element = document.querySelector(`[data-${window.type}-id="${id}"]`);
        if (element) {
            console.log(`RESTORE: Found DOM element, applying styles:`, {
                left: window.position.x + 'px',
                top: window.position.y + 'px',
                width: window.size.width + 'px',
                height: window.size.height + 'px',
                zIndex: window.zIndex
            });

            element.style.display = '';
            
            // Restore position and size
            element.style.left = window.position.x + 'px';
            element.style.top = window.position.y + 'px';
            element.style.width = window.size.width + 'px';
            element.style.height = window.size.height + 'px';
            element.style.zIndex = window.zIndex;

            console.log(`RESTORE: After applying styles, element position:`, {
                left: element.offsetLeft,
                top: element.offsetTop,
                width: element.offsetWidth,
                height: element.offsetHeight
            });
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
                
                // Update window config
                const window = this.windows.get(parseInt(id));
                if (window) {
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
            
            console.log(`CAPTURE: Captured state for window ${id}:`, {
                position: window.position,
                size: window.size,
                zIndex: window.zIndex
            });
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

    fixStuckWindows() {
        let fixedCount = 0;
        
        this.windows.forEach((window, id) => {
            if (window.position.y < this.HEADER_HEIGHT) {
                console.log(`Moving window ${id} from y=${window.position.y} to y=${this.HEADER_HEIGHT}`);
                this.moveWindow(id, window.position.x, this.HEADER_HEIGHT);
                fixedCount++;
            }
        });
        
        console.log(`Fixed ${fixedCount} stuck windows`);
        return fixedCount;
    }

    enableDebug() {
        this.debug = true;
        console.log('WindowSystem debug mode enabled');
        console.log('Available commands:');
        console.log('- windowSystem.inspectWindow(id) - inspect specific window');
        console.log('- windowSystem.inspectAll() - inspect all windows');
        console.log('- windowSystem.fixStuckWindows() - fix stuck windows');
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