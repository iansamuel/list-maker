/**
 * AppController - Main application controller
 * Orchestrates the ListEngine and WindowSystem
 * Handles UI rendering, events, and view management
 */
class AppController {
    constructor() {
        this.listEngine = new ListEngine();
        this.windowSystem = new WindowSystem();
        
        // View state
        this.currentView = 'root'; // 'root' or 'zoomed'
        this.zoomedListId = null;
        this.zoomedItemId = null;
        this.navigationPath = [];
        
        // Build number tracking
        this.BUILD_NUMBER = 101;
        
        this.init();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    init() {
        this.bindEvents();
        this.bindBreadcrumbEvents();
        this.bindTaskbarEvents();
        this.setupWindowCallbacks();
        this.render();
        
        // Make globally available for debugging
        window.app = this;
        
        console.log(`🚀 List Maker - Build #${this.BUILD_NUMBER} - Ready!`);
        console.log('Available debug commands:');
        console.log('- app.listEngine.getStats() - data statistics');
        console.log('- app.windowSystem.getStats() - window statistics');
        console.log('- app.windowSystem.enableDebug() - enable window debugging');
    }

    setupWindowCallbacks() {
        // Sync WindowSystem changes back to ListEngine for persistence
        this.windowSystem.onWindowMoved = (id, x, y) => {
            const list = this.listEngine.getList(id);
            if (list) {
                list.position = { x, y };
                this.listEngine.saveToStorage();
            }
        };

        this.windowSystem.onWindowResized = (id, width, height) => {
            const list = this.listEngine.getList(id);
            if (list) {
                list.size = { width, height };
                this.listEngine.saveToStorage();
            }
        };
    }

    // ==========================================
    // EVENT HANDLING
    // ==========================================

    bindEvents() {
        // Main controls
        const createListBtn = document.getElementById('create-list-btn');
        const newListInput = document.getElementById('new-list-input');
        const exportBtn = document.getElementById('export-btn');

        if (!createListBtn || !newListInput || !exportBtn) {
            console.error('Required DOM elements not found');
            return;
        }

        createListBtn.addEventListener('click', () => this.handleCreateList());
        newListInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleCreateList();
        });
        exportBtn.addEventListener('click', () => this.handleExport());

        // Container events (event delegation)
        const container = document.getElementById('lists-container');
        if (container) {
            container.addEventListener('click', (e) => this.handleContainerClick(e));
            container.addEventListener('mousedown', (e) => this.handleContainerMouseDown(e));
            container.addEventListener('keypress', (e) => this.handleContainerKeypress(e));
            container.addEventListener('blur', (e) => this.handleContainerBlur(e), true);
            this.bindDragEvents(container);
        }
    }

    handleCreateList() {
        const input = document.getElementById('new-list-input');
        const title = input.value.trim();
        
        if (!title) return;

        try {
            const newList = this.listEngine.createList(title);
            
            // Create window for the new list
            const windowConfig = this.windowSystem.createWindow(newList.id, 'list', {
                title: newList.title,
                position: this.windowSystem.getSmartPosition(),
                size: { width: 350, height: 400 }
            });

            input.value = '';
            
            // Render the new list
            this.renderNewList(newList, windowConfig);
            
            // Bring to front
            this.windowSystem.bringToFront(newList.id);
            
        } catch (error) {
            console.error('Failed to create list:', error);
            alert('Failed to create list: ' + error.message);
        }
    }

    handleExport() {
        try {
            const lists = this.listEngine.getAllLists();
            if (lists.length === 0) {
                alert('No lists to export!');
                return;
            }

            const format = prompt('Choose export format:\n\n1. JSON (structured data)\n2. HTML (web page)\n3. Markdown (text format)\n\nEnter 1, 2, or 3:');
            
            if (!format || !['1', '2', '3'].includes(format.trim())) {
                alert('Export cancelled or invalid format selected.');
                return;
            }

            const formatMap = { '1': 'json', '2': 'html', '3': 'markdown' };
            const selectedFormat = formatMap[format.trim()];
            
            const exportData = this.listEngine.exportAllLists(selectedFormat);
            
            // Create and download file
            const blob = new Blob([exportData.content], { type: exportData.mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `list-maker-export-${dateStr}.${exportData.fileExtension}`;
            document.body.appendChild(a);
            a.click();
            
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert(`Successfully exported ${lists.length} lists as ${exportData.fileExtension.toUpperCase()}!`);
            
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed: ' + error.message);
        }
    }

    handleContainerClick(e) {
        if (e.target.tagName === 'BUTTON') {
            e.stopPropagation();
        }

        const listId = parseInt(e.target.dataset.listId);
        const itemId = parseInt(e.target.dataset.itemId);
        const parentPath = e.target.dataset.parentPath;
        const parsedParentPath = parentPath && parentPath !== '' ? 
            [listId, ...parentPath.split('-').map(Number)] : null;

        try {
            if (e.target.classList.contains('delete-list-btn')) {
                this.handleDeleteList(listId);
            } else if (e.target.classList.contains('add-item-btn')) {
                this.handleAddItem(e.target);
            } else if (e.target.classList.contains('delete-item-btn')) {
                this.handleDeleteItem(listId, itemId, parsedParentPath);
            } else if (e.target.classList.contains('convert-btn')) {
                this.handleConvertToSubList(listId, itemId, parsedParentPath);
            } else if (e.target.classList.contains('expand-btn')) {
                this.handleToggleExpanded(listId, itemId, parsedParentPath);
            } else if (e.target.classList.contains('zoom-in-btn')) {
                this.handleZoomIn(e.target);
            } else if (e.target.classList.contains('minimize-btn')) {
                this.handleMinimize(e.target);
            } else if (e.target.classList.contains('edit-item-btn')) {
                this.handleEditItem(e.target);
            }
        } catch (error) {
            console.error('Error handling container click:', error);
            alert('Error: ' + error.message);
        }
    }

    handleContainerKeypress(e) {
        if (e.key === 'Enter' && e.target.classList.contains('item-input')) {
            this.handleAddItem(e.target.nextElementSibling);
        }
    }

    handleContainerMouseDown(e) {
        // Delegate window management events to WindowSystem
        this.windowSystem.handleMouseDown(e);
    }

    handleContainerBlur(e) {
        if (e.target.classList.contains('item-text')) {
            const listId = parseInt(e.target.dataset.listId);
            const itemId = parseInt(e.target.dataset.itemId);
            const parentPath = e.target.dataset.parentPath;
            const parsedParentPath = parentPath && parentPath !== '' ? 
                [listId, ...parentPath.split('-').map(Number)] : null;
            
            try {
                this.listEngine.updateItem(listId, itemId, e.target.value, parsedParentPath);
            } catch (error) {
                console.error('Error updating item:', error);
            }
        }
    }

    // ==========================================
    // SPECIFIC EVENT HANDLERS
    // ==========================================

    handleDeleteList(listId) {
        if (!confirm('Are you sure you want to delete this list?')) return;

        try {
            this.listEngine.deleteList(listId);
            this.windowSystem.destroyWindow(listId);
            this.windowSystem.updateTaskbar();
        } catch (error) {
            console.error('Error deleting list:', error);
            alert('Failed to delete list: ' + error.message);
        }
    }

    handleAddItem(button) {
        const input = button.previousElementSibling;
        if (!input || !input.value.trim()) return;

        const listId = parseInt(input.dataset.listId);
        const parentPath = input.dataset.parentPath;
        const parsedParentPath = parentPath && parentPath !== '' ? 
            [listId, ...parentPath.split('-').map(Number)] : null;

        try {
            const newItem = this.listEngine.addItem(listId, input.value, parsedParentPath);
            input.value = '';
            
            // Re-render the affected list
            this.renderUpdatedList(listId);
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Failed to add item: ' + error.message);
        }
    }

    handleDeleteItem(listId, itemId, parentPath) {
        try {
            this.listEngine.deleteItem(listId, itemId, parentPath);
            this.renderUpdatedList(listId);
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Failed to delete item: ' + error.message);
        }
    }

    handleConvertToSubList(listId, itemId, parentPath) {
        try {
            this.listEngine.convertToSubList(listId, itemId, parentPath);
            this.renderUpdatedList(listId);
        } catch (error) {
            console.error('Error converting to sublist:', error);
            alert('Failed to convert to sublist: ' + error.message);
        }
    }

    handleToggleExpanded(listId, itemId, parentPath) {
        try {
            this.listEngine.toggleExpanded(listId, itemId, parentPath);
            this.renderUpdatedList(listId);
        } catch (error) {
            console.error('Error toggling expanded:', error);
            alert('Failed to toggle expanded: ' + error.message);
        }
    }

    handleZoomIn(button) {
        const listId = parseInt(button.dataset.listId);
        const itemId = parseInt(button.dataset.itemId);
        const parentListId = parseInt(button.dataset.parentListId);

        if (itemId && parentListId) {
            this.zoomIntoItem(itemId, parentListId);
        } else if (listId) {
            this.zoomIntoList(listId);
        }
    }

    handleMinimize(button) {
        const listId = parseInt(button.dataset.listId);
        const itemId = parseInt(button.dataset.itemId);
        const id = listId || itemId;

        if (id) {
            this.windowSystem.minimizeWindow(id);
            this.windowSystem.updateTaskbar();
        }
    }

    handleEditItem(button) {
        const itemId = parseInt(button.dataset.itemId);
        const parentListId = parseInt(button.dataset.parentListId);
        
        try {
            const item = this.listEngine.findItemById(itemId, parentListId);
            if (!item) return;

            const newText = prompt('Edit item text:', item.text);
            if (newText !== null && newText.trim() !== '') {
                this.listEngine.updateItem(parentListId, itemId, newText.trim());
                this.renderUpdatedList(parentListId);
            }
        } catch (error) {
            console.error('Error editing item:', error);
            alert('Failed to edit item: ' + error.message);
        }
    }

    // ==========================================
    // DRAG AND DROP
    // ==========================================

    bindDragEvents(container) {
        let draggedElement = null;
        let draggedIndex = null;
        let targetListId = null;

        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('list-item')) {
                draggedElement = e.target;
                draggedIndex = parseInt(e.target.dataset.index);
                targetListId = parseInt(e.target.closest('.list-card').dataset.listId);
                e.target.classList.add('dragging');
            }
        });

        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('list-item')) {
                e.target.classList.remove('dragging');
                draggedElement = null;
                draggedIndex = null;
                targetListId = null;
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(e.target.closest('.list-items'), e.clientY);
            const listItems = e.target.closest('.list-items');
            
            if (listItems && draggedElement) {
                if (afterElement == null) {
                    listItems.appendChild(draggedElement);
                } else {
                    listItems.insertBefore(draggedElement, afterElement);
                }
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedElement && targetListId) {
                const newIndex = Array.from(draggedElement.parentElement.children).indexOf(draggedElement);
                if (newIndex !== draggedIndex) {
                    try {
                        this.listEngine.reorderItems(targetListId, draggedIndex, newIndex);
                        this.renderUpdatedList(targetListId);
                    } catch (error) {
                        console.error('Error reordering items:', error);
                    }
                }
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.list-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    bindBreadcrumbEvents() {
        const breadcrumbNav = document.getElementById('breadcrumb-nav');
        if (!breadcrumbNav) return;

        breadcrumbNav.addEventListener('click', (e) => {
            if (e.target.classList.contains('breadcrumb-item')) {
                const action = e.target.dataset.action;
                if (action === 'root') {
                    this.zoomOut();
                } else if (action === 'zoom-to') {
                    const pathIndex = parseInt(e.target.dataset.pathIndex);
                    this.zoomToLevel(pathIndex);
                }
            }
        });
    }

    bindTaskbarEvents() {
        const taskbarItems = document.getElementById('taskbar-items');
        if (!taskbarItems) return;

        taskbarItems.addEventListener('click', (e) => {
            if (e.target.classList.contains('taskbar-item')) {
                const action = e.target.dataset.action;
                const listId = parseInt(e.target.dataset.listId);
                const itemId = parseInt(e.target.dataset.itemId);
                const id = listId || itemId;

                if (action === 'restore-list' || action === 'restore-item') {
                    this.windowSystem.restoreWindow(id);
                    this.windowSystem.updateTaskbar();
                }
            }
        });
    }

    updateBreadcrumbs() {
        const breadcrumbNav = document.getElementById('breadcrumb-nav');
        if (!breadcrumbNav) return;

        let breadcrumbHTML = '';
        
        if (this.currentView === 'root') {
            breadcrumbHTML = '<span class="breadcrumb-item active">All Lists</span>';
        } else if (this.currentView === 'zoomed') {
            // Build breadcrumb from navigation path
            breadcrumbHTML = '<span class="breadcrumb-item" data-action="root">All Lists</span>';
            
            this.navigationPath.forEach((pathItem, index) => {
                const isLast = index === this.navigationPath.length - 1;
                const isActive = isLast ? 'active' : '';
                const dataAction = isLast ? '' : `data-action="zoom-to" data-path-index="${index}"`;
                
                breadcrumbHTML += '<span class="breadcrumb-separator"> > </span>';
                breadcrumbHTML += `<span class="breadcrumb-item ${isActive}" ${dataAction}>${pathItem.title}</span>`;
            });
        }

        breadcrumbNav.innerHTML = breadcrumbHTML;
    }

    zoomIntoList(listId) {
        const list = this.listEngine.getList(listId);
        if (!list) return;

        // Save positions for current view before transitioning
        const currentViewKey = this.windowSystem.generateViewKey(this.currentView, this.zoomedListId, this.zoomedItemId);
        this.windowSystem.savePositionsForView(currentViewKey);

        this.currentView = 'zoomed';
        this.zoomedListId = listId;
        this.navigationPath = [{ id: listId, title: list.title }];
        
        this.render();

        // Restore positions for the new view after rendering
        const newViewKey = this.windowSystem.generateViewKey(this.currentView, this.zoomedListId, this.zoomedItemId);
        setTimeout(() => {
            this.windowSystem.restorePositionsForView(newViewKey);
        }, 100);
    }

    zoomOut() {
        // Save positions for current view before transitioning
        const currentViewKey = this.windowSystem.generateViewKey(this.currentView, this.zoomedListId, this.zoomedItemId);
        this.windowSystem.savePositionsForView(currentViewKey);

        this.currentView = 'root';
        this.zoomedListId = null;
        this.zoomedItemId = null;
        this.navigationPath = [];
        
        this.render();

        // Restore positions for the root view after rendering
        setTimeout(() => {
            this.windowSystem.restorePositionsForView('root');
        }, 100);
    }

    zoomIntoItem(itemId, parentListId) {
        const item = this.listEngine.findItemById(itemId, parentListId);
        if (!item) return;

        // Save positions for current view before transitioning
        const currentViewKey = this.windowSystem.generateViewKey(this.currentView, this.zoomedListId, this.zoomedItemId);
        this.windowSystem.savePositionsForView(currentViewKey);

        // Convert to sublist if needed
        if (item.type !== 'sublist') {
            this.listEngine.convertToSubList(parentListId, itemId);
        }

        this.currentView = 'zoomed';
        this.zoomedListId = parentListId;
        this.zoomedItemId = itemId;
        
        this.navigationPath.push({ id: itemId, title: item.text, type: 'item' });
        
        this.render();

        // Restore positions for the new view after rendering
        const newViewKey = this.windowSystem.generateViewKey(this.currentView, this.zoomedListId, this.zoomedItemId);
        setTimeout(() => {
            this.windowSystem.restorePositionsForView(newViewKey);
        }, 100);
    }

    zoomToLevel(pathIndex) {
        if (pathIndex < 0 || pathIndex >= this.navigationPath.length) return;

        // Save positions for current view before transitioning
        const currentViewKey = this.windowSystem.generateViewKey(this.currentView, this.zoomedListId, this.zoomedItemId);
        this.windowSystem.savePositionsForView(currentViewKey);

        // Trim navigation path to the specified level
        this.navigationPath = this.navigationPath.slice(0, pathIndex + 1);
        
        const targetLevel = this.navigationPath[pathIndex];
        
        if (pathIndex === 0) {
            // Zooming back to the root list level
            this.zoomedListId = targetLevel.id;
            this.zoomedItemId = null;
        } else {
            // Zooming to a specific item level
            this.zoomedListId = this.navigationPath[0].id; // Root list
            this.zoomedItemId = targetLevel.id;
        }

        this.render();

        // Restore positions for the target view after rendering
        const newViewKey = this.windowSystem.generateViewKey(this.currentView, this.zoomedListId, this.zoomedItemId);
        setTimeout(() => {
            this.windowSystem.restorePositionsForView(newViewKey);
        }, 100);
    }

    // ==========================================
    // RENDERING
    // ==========================================

    render() {
        const container = document.getElementById('lists-container');
        if (!container) return;

        if (this.currentView === 'root') {
            this.renderRootView(container);
        } else if (this.currentView === 'zoomed') {
            this.renderZoomedView(container);
        }
        
        this.updateBreadcrumbs();
        this.windowSystem.updateTaskbar();
    }

    renderRootView(container) {
        console.log('RENDER: renderRootView called');
        const lists = this.listEngine.getAllLists();
        
        if (lists.length === 0) {
            container.innerHTML = '<div class="empty-state">No lists yet. Create your first list above!</div>';
            return;
        }

        const listsHTML = lists.map(list => {
            let window = this.windowSystem.getWindow(list.id);
            
            // Create window if it doesn't exist
            if (!window) {
                console.log(`RENDER: Creating window for list ${list.id}:`, {
                    hasPosition: !!list.position,
                    hasSize: !!list.size,
                    hasZIndex: !!list.zIndex,
                    position: list.position,
                    size: list.size,
                    zIndex: list.zIndex
                });
                
                window = this.windowSystem.createWindow(list.id, 'list', {
                    title: list.title,
                    position: list.position || this.windowSystem.getSmartPosition(),
                    size: list.size || { width: 350, height: 400 },
                    zIndex: list.zIndex || 100
                });
            } else {
                console.log(`RENDER: Using existing window for list ${list.id}:`, {
                    position: window.position,
                    size: window.size,
                    minimized: window.minimized
                });
            }
            
            const listHTML = this.renderList(list, window);
            
            // Hide minimized windows
            if (window && window.minimized) {
                return listHTML.replace('class="list-card"', 'class="list-card" style="display: none;"');
            }
            return listHTML;
        }).join('');
        
        container.innerHTML = listsHTML;
    }

    renderZoomedView(container) {
        const zoomedList = this.listEngine.getList(this.zoomedListId);
        if (!zoomedList) {
            this.zoomOut();
            return;
        }

        let itemsToRender = [];
        
        if (this.zoomedItemId) {
            const zoomedItem = this.listEngine.findItemById(this.zoomedItemId, this.zoomedListId);
            if (!zoomedItem || !zoomedItem.items) {
                this.zoomOut();
                return;
            }
            itemsToRender = zoomedItem.items;
        } else {
            itemsToRender = zoomedList.items;
        }

        if (itemsToRender.length === 0) {
            container.innerHTML = '<div class="empty-state">No items yet. Add some items to see them as individual lists!</div>';
            return;
        }

        const itemLists = itemsToRender
            .map((item, index) => {
                const itemHTML = this.renderItemAsList(item, zoomedList.id, index);
                const itemWindow = this.windowSystem.getWindow(item.id);
                
                // Hide minimized items
                if (itemWindow && itemWindow.minimized) {
                    return itemHTML.replace('class="list-card"', 'class="list-card" style="display: none;"');
                }
                return itemHTML;
            }).join('');

        container.innerHTML = itemLists;
    }

    renderNewList(list, windowConfig) {
        if (this.currentView !== 'root') return;

        const container = document.getElementById('lists-container');
        if (!container) return;

        const listHTML = this.renderList(list, windowConfig);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = listHTML;
        const newListElement = tempDiv.firstElementChild;
        
        container.appendChild(newListElement);
    }

    renderUpdatedList(listId) {
        const list = this.listEngine.getList(listId);
        const window = this.windowSystem.getWindow(listId);
        if (!list || !window) return;

        const listElement = document.querySelector(`[data-list-id="${listId}"]`);
        if (listElement) {
            // Capture current state
            this.windowSystem.captureWindowState(listId);
            
            // Update content
            const listHTML = this.renderList(list, window);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = listHTML;
            const newListElement = tempDiv.firstElementChild;
            
            listElement.parentNode.replaceChild(newListElement, listElement);
            
            // Restore position and state
            this.windowSystem.restoreSpatialState();
        }
    }

    renderList(list, window) {
        console.log(`RENDER: renderList called for list ${list.id} with window:`, {
            hasWindow: !!window,
            position: window?.position,
            size: window?.size,
            zIndex: window?.zIndex,
            minimized: window?.minimized
        });
        
        const itemsHtml = this.renderItems(list.items, list.id, []);
        const position = window?.position || { x: 100, y: 200 };
        const size = window?.size || { width: 350, height: 400 };
        const zIndex = window?.zIndex || 100;

        return `
            <div class="list-card" 
                 data-list-id="${list.id}"
                 style="left: ${position.x}px; top: ${position.y}px; width: ${size.width}px; height: ${size.height}px; z-index: ${zIndex};">
                <div class="list-header" data-list-id="${list.id}">
                    <div class="list-title">${list.title}</div>
                    <div class="list-header-actions">
                        <button class="minimize-btn" data-list-id="${list.id}" title="Minimize this list">−</button>
                        <button class="zoom-in-btn" data-list-id="${list.id}" title="Zoom into this list">🔍</button>
                        <button class="delete-list-btn" data-list-id="${list.id}">Delete List</button>
                    </div>
                </div>
                <div class="list-content">
                    <div class="item-input-container">
                        <input type="text" class="item-input" placeholder="Add new item..." data-list-id="${list.id}">
                        <button class="add-item-btn" data-list-id="${list.id}">Add</button>
                    </div>
                    <div class="list-items" data-list-id="${list.id}">
                        ${itemsHtml || '<div class="empty-state">No items yet</div>'}
                    </div>
                </div>
                <div class="resize-handle" data-list-id="${list.id}"></div>
            </div>
        `;
    }

    renderItems(items, listId, parentPath, depth = 0) {
        return items.map((item, index) => {
            const currentPath = [...parentPath, item.id];
            const isSubList = item.type === 'sublist';
            const hasChildren = isSubList && item.items && item.items.length > 0;
            
            let nestedItemsHtml = '';
            if (isSubList && item.expanded && hasChildren) {
                nestedItemsHtml = this.renderItems(item.items, listId, currentPath, depth + 1);
            }

            return `
                <div class="list-item ${isSubList ? 'sublist' : 'item'}" 
                     draggable="true" 
                     data-item-id="${item.id}" 
                     data-index="${index}"
                     data-parent-path="${parentPath.join('-')}"
                     data-depth="${depth}">
                    <div class="item-content">
                        ${isSubList ? `
                            <button class="expand-btn ${item.expanded ? 'expanded' : ''}" 
                                    data-list-id="${listId}" 
                                    data-item-id="${item.id}" 
                                    data-parent-path="${parentPath.join('-')}">
                                ${item.expanded ? '▼' : '▶'}
                            </button>
                        ` : ''}
                        <input type="text" class="item-text" value="${item.text}" 
                               data-list-id="${listId}" 
                               data-item-id="${item.id}"
                               data-parent-path="${parentPath.join('-')}">
                        <div class="item-actions">
                            ${!isSubList ? `
                                <button class="convert-btn" 
                                        data-list-id="${listId}" 
                                        data-item-id="${item.id}"
                                        data-parent-path="${parentPath.join('-')}"
                                        title="Convert to sub-list">⊞</button>
                            ` : ''}
                            <button class="delete-item-btn" 
                                    data-list-id="${listId}" 
                                    data-item-id="${item.id}"
                                    data-parent-path="${parentPath.join('-')}">×</button>
                        </div>
                    </div>
                    ${isSubList ? `
                        <div class="nested-items ${item.expanded ? 'expanded' : 'collapsed'}">
                            <div class="item-input-container">
                                <input type="text" class="item-input" 
                                       placeholder="Add new item..." 
                                       data-list-id="${listId}"
                                       data-parent-path="${currentPath.join('-')}">
                                <button class="add-item-btn" 
                                        data-list-id="${listId}"
                                        data-parent-path="${currentPath.join('-')}">Add</button>
                            </div>
                            <div class="nested-list-items" 
                                 data-list-id="${listId}"
                                 data-parent-path="${currentPath.join('-')}">
                                ${nestedItemsHtml || '<div class="empty-state">No items yet</div>'}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderItemAsList(item, parentListId, index) {
        const position = this.windowSystem.getSmartPosition();
        const hasSubItems = item.items && item.items.length > 0;
        const size = { width: 350, height: 400 };
        const zIndex = 100 + index;
        
        // Create window for item if it doesn't exist
        if (!this.windowSystem.getWindow(item.id)) {
            this.windowSystem.createWindow(item.id, 'item', {
                title: item.text,
                position: position,
                size: size,
                zIndex: zIndex
            });
        }
        
        const itemsHtml = hasSubItems ? this.renderItems(item.items, parentListId, [item.id]) : '';
        
        return `
            <div class="list-card" 
                 data-item-id="${item.id}" 
                 data-parent-list-id="${parentListId}"
                 style="left: ${position.x}px; top: ${position.y}px; width: ${size.width}px; height: ${size.height}px; z-index: ${zIndex};">
                <div class="list-header" data-item-id="${item.id}">
                    <div class="list-title">${item.text}</div>
                    <div class="list-header-actions">
                        <button class="minimize-btn" data-item-id="${item.id}" data-parent-list-id="${parentListId}" title="Minimize this item">−</button>
                        ${hasSubItems ? `<button class="zoom-in-btn" data-item-id="${item.id}" data-parent-list-id="${parentListId}" title="Zoom into this item">🔍</button>` : ''}
                        <button class="edit-item-btn" data-item-id="${item.id}" data-parent-list-id="${parentListId}" title="Edit this item">✏️</button>
                    </div>
                </div>
                <div class="list-content">
                    <div class="item-input-container">
                        <input type="text" class="item-input" placeholder="Add new item..." data-item-id="${item.id}" data-parent-list-id="${parentListId}">
                        <button class="add-item-btn" data-item-id="${item.id}" data-parent-list-id="${parentListId}">Add</button>
                    </div>
                    <div class="list-items" data-item-id="${item.id}" data-parent-list-id="${parentListId}">
                        ${itemsHtml || '<div class="empty-state">No items yet</div>'}
                    </div>
                </div>
                <div class="resize-handle" data-item-id="${item.id}"></div>
            </div>
        `;
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    getStats() {
        return {
            currentView: this.currentView,
            zoomedListId: this.zoomedListId,
            zoomedItemId: this.zoomedItemId,
            navigationPath: this.navigationPath,
            buildNumber: this.BUILD_NUMBER,
            listEngine: this.listEngine.getStats(),
            windowSystem: this.windowSystem.getStats()
        };
    }

    enableDebug() {
        this.windowSystem.enableDebug();
        console.log('AppController debug mode enabled');
        console.log('Available commands:');
        console.log('- app.getStats() - application statistics');
        console.log('- app.listEngine.validateData() - validate data integrity');
        console.log('- app.windowSystem.fixStuckWindows() - fix stuck windows');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppController;
}