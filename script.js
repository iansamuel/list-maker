class ListMaker {
    constructor() {
        this.lists = this.loadFromStorage() || [];
        this.currentId = this.lists.length > 0 ? Math.max(...this.lists.map(l => l.id)) + 1 : 1;
        this.maxZIndex = 100;
        this.debug = false; // Set to true to enable debug logging
        
        // Navigation state for hierarchical views
        this.currentView = 'root'; // 'root' or 'zoomed'
        this.zoomedListId = null;
        this.zoomedItemId = null;
        this.navigationPath = [];
        
        // Minimize state
        this.minimizedLists = new Set();
        this.minimizedItems = new Set();
        
        this.init();
        
        // Make instance globally available for debugging
        window.listMaker = this;
    }

    init() {
        this.bindEvents();
        this.bindWindowEvents();
        this.bindResizeHandler();
        this.render();
    }

    bindEvents() {
        const createListBtn = document.getElementById('create-list-btn');
        const newListInput = document.getElementById('new-list-input');
        const exportBtn = document.getElementById('export-btn');

        if (!createListBtn || !newListInput || !exportBtn) {
            console.error('Required DOM elements not found:', {
                createListBtn: !!createListBtn,
                newListInput: !!newListInput,
                exportBtn: !!exportBtn
            });
            return;
        }

        createListBtn.addEventListener('click', () => this.createList());
        newListInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createList();
        });
        exportBtn.addEventListener('click', () => this.exportAllLists());
        
        // Bind breadcrumb navigation
        this.bindBreadcrumbEvents();
    }

    createList() {
        const input = document.getElementById('new-list-input');
        const title = input.value.trim();
        
        if (!title) return;

        const newList = {
            id: this.currentId++,
            title: title,
            items: [],
            position: this.getSmartPosition(),
            size: { width: 350, height: 400 },
            zIndex: this.maxZIndex++
        };

        this.lists.push(newList);
        input.value = '';
        this.saveToStorage();
        this.render();
        
        // Bring the new list to the front
        this.bringToFront(newList.id);
    }

    deleteList(listId) {
        this.lists = this.lists.filter(list => list.id !== listId);
        this.saveToStorage();
        this.render();
    }

    exportAllLists() {
        if (this.lists.length === 0) {
            alert('No lists to export!');
            return;
        }

        try {
            // Create export data with metadata
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0',
                appName: 'List Maker',
                totalLists: this.lists.length,
                lists: this.lists.map(list => ({
                    id: list.id,
                    title: list.title,
                    items: this.flattenItems(list.items),
                    position: list.position,
                    size: list.size,
                    zIndex: list.zIndex,
                    itemCount: this.countAllItems(list.items)
                }))
            };

            // Convert to JSON
            const jsonString = JSON.stringify(exportData, null, 2);
            
            // Create and download file
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `list-maker-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success message
            alert(`Successfully exported ${this.lists.length} lists!`);
            
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    }

    flattenItems(items) {
        // Recursively flatten nested items for export
        return items.map(item => ({
            id: item.id,
            text: item.text,
            type: item.type,
            expanded: item.expanded,
            items: item.items ? this.flattenItems(item.items) : []
        }));
    }

    countAllItems(items) {
        // Count all items including nested ones
        let count = items.length;
        items.forEach(item => {
            if (item.items && item.items.length > 0) {
                count += this.countAllItems(item.items);
            }
        });
        return count;
    }

    addItem(listId, text, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.lists.find(l => l.id === listId);
        if (!targetContainer || !text.trim()) return;

        const newItem = {
            id: Date.now(),
            text: text.trim(),
            type: 'item',
            items: [],
            expanded: true
        };

        targetContainer.items.push(newItem);
        this.saveToStorage();
        this.render();
    }

    deleteItem(listId, itemId, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.lists.find(l => l.id === listId);
        if (!targetContainer) return;

        targetContainer.items = targetContainer.items.filter(item => item.id !== itemId);
        this.saveToStorage();
        this.render();
    }

    updateItem(listId, itemId, newText, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.lists.find(l => l.id === listId);
        if (!targetContainer) return;

        const item = targetContainer.items.find(i => i.id === itemId);
        if (item) {
            item.text = newText.trim();
            this.saveToStorage();
        }
    }

    reorderItems(listId, oldIndex, newIndex, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.lists.find(l => l.id === listId);
        if (!targetContainer) return;

        const item = targetContainer.items.splice(oldIndex, 1)[0];
        targetContainer.items.splice(newIndex, 0, item);
        this.saveToStorage();
        this.render();
    }

    render() {
        const container = document.getElementById('lists-container');
        
        if (this.currentView === 'root') {
            this.renderRootView(container);
        } else if (this.currentView === 'zoomed') {
            this.renderZoomedView(container);
        }
        
        this.bindListEvents();
        this.updateBreadcrumbs();
        this.updateTaskbar();
    }

    renderRootView(container) {
        if (this.lists.length === 0) {
            container.innerHTML = '<div class="empty-state">No lists yet. Create your first list above!</div>';
            return;
        }

        container.innerHTML = this.lists
            .filter(list => !this.minimizedLists.has(list.id))
            .map(list => this.renderList(list))
            .join('');
    }

    renderZoomedView(container) {
        const zoomedList = this.lists.find(l => l.id === this.zoomedListId);
        if (!zoomedList) {
            this.zoomOut();
            return;
        }

        let itemsToRender = [];
        
        if (this.zoomedItemId) {
            // We're zoomed into a specific item, show its sub-items
            const zoomedItem = zoomedList.items.find(i => i.id === this.zoomedItemId);
            if (!zoomedItem || !zoomedItem.items) {
                this.zoomOut();
                return;
            }
            itemsToRender = zoomedItem.items;
        } else {
            // We're zoomed into a list, show its items
            itemsToRender = zoomedList.items;
        }

        if (itemsToRender.length === 0) {
            container.innerHTML = '<div class="empty-state">No items yet. Add some items to see them as individual lists!</div>';
            return;
        }

        // Render each item as a full list window using stored spatial data (skip minimized items)
        const itemLists = itemsToRender
            .filter(item => !this.minimizedItems.has(item.id))
            .map((item, index) => {
                return this.renderItemAsList(item, zoomedList.id, index);
            }).join('');

        container.innerHTML = itemLists;
    }

    renderList(list) {
        const itemsHtml = this.renderItems(list.items, list.id, []);
        
        // Use stored size from list data
        const width = list.size.width;
        const height = list.size.height;

        return `
            <div class="list-card" 
                 data-list-id="${list.id}"
                 style="left: ${list.position.x}px; top: ${list.position.y}px; width: ${width}px; height: ${height}px; z-index: ${list.zIndex};">
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
            const pathStr = currentPath.join('-');
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

    bindListEvents() {
        const container = document.getElementById('lists-container');

        // Remove existing event listeners if any
        if (container.listEventsHandler) {
            container.removeEventListener('click', container.listEventsHandler);
        }

        container.listEventsHandler = (e) => {
            // Prevent event bubbling for button clicks
            if (e.target.tagName === 'BUTTON') {
                e.stopPropagation();
            }

            const listId = parseInt(e.target.dataset.listId);
            const itemId = parseInt(e.target.dataset.itemId);
            const parentPath = e.target.dataset.parentPath;
            const parsedParentPath = parentPath && parentPath !== '' ? [listId, ...parentPath.split('-').map(Number)] : null;

            if (e.target.classList.contains('delete-list-btn')) {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this list?')) {
                    this.deleteList(listId);
                }
            } else if (e.target.classList.contains('add-item-btn')) {
                const input = e.target.previousElementSibling;
                const targetItemId = e.target.dataset.itemId;
                const targetParentListId = e.target.dataset.parentListId;
                
                if (targetItemId && targetParentListId) {
                    // Adding to an item in zoomed view
                    this.addItemToZoomedItem(targetItemId, targetParentListId, input.value);
                } else {
                    // Adding to a regular list
                    this.addItem(listId, input.value, parsedParentPath);
                }
                input.value = '';
            } else if (e.target.classList.contains('delete-item-btn')) {
                this.deleteItem(listId, itemId, parsedParentPath);
            } else if (e.target.classList.contains('convert-btn')) {
                this.convertToSubList(listId, itemId, parsedParentPath);
            } else if (e.target.classList.contains('expand-btn')) {
                this.toggleExpanded(listId, itemId, parsedParentPath);
            } else if (e.target.classList.contains('zoom-in-btn')) {
                const zoomItemId = e.target.dataset.itemId;
                const zoomParentListId = e.target.dataset.parentListId;
                
                if (zoomItemId && zoomParentListId) {
                    // Zooming into an item in zoomed view
                    this.zoomIntoItem(zoomItemId, zoomParentListId);
                } else if (listId) {
                    // Zooming into a regular list
                    this.zoomIntoList(listId);
                }
            } else if (e.target.classList.contains('edit-item-btn')) {
                this.editItemInZoomedView(e.target.dataset.itemId, e.target.dataset.parentListId);
            } else if (e.target.classList.contains('zoom-in-item-btn')) {
                this.zoomIntoItem(e.target.dataset.itemId, e.target.dataset.parentListId);
            } else if (e.target.classList.contains('minimize-btn')) {
                const minimizeItemId = e.target.dataset.itemId;
                const minimizeParentListId = e.target.dataset.parentListId;
                
                if (minimizeItemId && minimizeParentListId) {
                    // Minimizing an item in zoomed view
                    this.minimizeItem(minimizeItemId, minimizeParentListId);
                } else if (listId) {
                    // Minimizing a regular list
                    this.minimizeList(listId);
                }
            }
        };

        container.addEventListener('click', container.listEventsHandler);

        container.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (e.target.classList.contains('item-input')) {
                    const listId = parseInt(e.target.dataset.listId);
                    const parentPath = e.target.dataset.parentPath;
                    const targetItemId = e.target.dataset.itemId;
                    const targetParentListId = e.target.dataset.parentListId;
                    
                    if (targetItemId && targetParentListId) {
                        // Adding to an item in zoomed view
                        this.addItemToZoomedItem(targetItemId, targetParentListId, e.target.value);
                    } else {
                        // Adding to a regular list
                        const parsedParentPath = parentPath && parentPath !== '' ? [listId, ...parentPath.split('-').map(Number)] : null;
                        this.addItem(listId, e.target.value, parsedParentPath);
                    }
                    e.target.value = '';
                }
            }
        });

        container.addEventListener('blur', (e) => {
            if (e.target.classList.contains('item-text')) {
                const listId = parseInt(e.target.dataset.listId);
                const itemId = parseInt(e.target.dataset.itemId);
                const parentPath = e.target.dataset.parentPath;
                const parsedParentPath = parentPath && parentPath !== '' ? [listId, ...parentPath.split('-').map(Number)] : null;
                this.updateItem(listId, itemId, e.target.value, parsedParentPath);
            }
        }, true);

        this.bindDragEvents();
        this.bindWindowEvents();
    }

    bindDragEvents() {
        const container = document.getElementById('lists-container');
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
                    this.reorderItems(targetListId, draggedIndex, newIndex);
                }
            }
        });
    }

    findItemByPath(path) {
        const [listId, ...itemIds] = path;
        let current = this.lists.find(l => l.id === listId);
        
        for (const itemId of itemIds) {
            if (!current || !current.items) return null;
            current = current.items.find(i => i.id === itemId);
        }
        
        return current;
    }

    findItemById(itemId, listId) {
        const list = this.lists.find(l => l.id === listId);
        if (!list) return null;
        
        // Search through all items in the list recursively
        const searchItems = (items) => {
            for (const item of items) {
                if (item.id === itemId) return item;
                if (item.items && item.items.length > 0) {
                    const found = searchItems(item.items);
                    if (found) return found;
                }
            }
            return null;
        };
        
        return searchItems(list.items);
    }

    convertToSubList(listId, itemId, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.lists.find(l => l.id === listId);
        if (!targetContainer) return;

        const item = targetContainer.items.find(i => i.id === itemId);
        if (item && item.type === 'item') {
            item.type = 'sublist';
            item.expanded = true;
            this.saveToStorage();
            this.render();
        }
    }

    toggleExpanded(listId, itemId, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.lists.find(l => l.id === listId);
        if (!targetContainer) return;

        const item = targetContainer.items.find(i => i.id === itemId);
        if (item && item.type === 'sublist') {
            item.expanded = !item.expanded;
            this.saveToStorage();
            this.render();
        }
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

    bindWindowEvents() {
        const container = document.getElementById('lists-container');
        let draggedCard = null;
        let dragOffset = { x: 0, y: 0 };
        let isResizing = false;
        let resizeData = null;

        container.addEventListener('mousedown', (e) => {
            const listCard = e.target.closest('.list-card');
            if (!listCard) return;

            // Handle both regular lists and item windows
            const listId = parseInt(listCard.dataset.listId);
            const itemId = parseInt(listCard.dataset.itemId);
            
            if (listId) {
                this.bringToFront(listId);
            } else if (itemId) {
                this.bringItemWindowToFront(itemId);
            }

            if (e.target.classList.contains('resize-handle')) {
                isResizing = true;
                resizeData = {
                    listId: listId,
                    itemId: itemId,
                    startX: e.clientX,
                    startY: e.clientY,
                    startWidth: listCard.offsetWidth,
                    startHeight: listCard.offsetHeight
                };
                e.preventDefault();
                return;
            }

            if (e.target.closest('.list-header')) {
                draggedCard = listCard;
                const cardRect = listCard.getBoundingClientRect();
                
                // Calculate offset relative to the card position
                dragOffset.x = e.clientX - cardRect.left;
                dragOffset.y = e.clientY - cardRect.top;
                
                listCard.classList.add('dragging');
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isResizing && resizeData) {
                const deltaX = e.clientX - resizeData.startX;
                const deltaY = e.clientY - resizeData.startY;
                
                const newWidth = Math.max(300, resizeData.startWidth + deltaX);
                const newHeight = Math.max(200, resizeData.startHeight + deltaY);
                
                if (resizeData.listId) {
                    this.updateListSize(resizeData.listId, newWidth, newHeight);
                } else if (resizeData.itemId) {
                    this.updateItemWindowSize(resizeData.itemId, newWidth, newHeight);
                }
                return;
            }

            if (draggedCard) {
                // Calculate new position relative to viewport (since container is now full-screen)
                const newX = e.clientX - dragOffset.x;
                const newY = e.clientY - dragOffset.y;
                
                const listId = parseInt(draggedCard.dataset.listId);
                const itemId = parseInt(draggedCard.dataset.itemId);
                
                if (listId) {
                    this.updateListPosition(listId, newX, newY);
                } else if (itemId) {
                    this.updateItemWindowPosition(itemId, newX, newY);
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (draggedCard) {
                draggedCard.classList.remove('dragging');
                draggedCard = null;
            }
            if (isResizing) {
                isResizing = false;
                resizeData = null;
            }
        });

    }

    bringToFront(listId) {
        const list = this.lists.find(l => l.id === listId);
        if (list) {
            list.zIndex = ++this.maxZIndex;
            this.saveToStorage();
            this.updateListZIndex(listId, list.zIndex);
        }
    }

    bringItemWindowToFront(itemId) {
        const itemWindow = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemWindow) {
            itemWindow.style.zIndex = ++this.maxZIndex;
        }
    }

    updateItemWindowPosition(itemId, x, y) {
        const itemWindow = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemWindow) {
            // Constrain position to keep title bar accessible
            const headerHeight = 140; // Match the header height used in positioning
            const minX = 0;
            const minY = headerHeight;
            const maxX = window.innerWidth - 100;
            const maxY = window.innerHeight - 100;
            
            const constrainedX = Math.max(minX, Math.min(maxX, x));
            const constrainedY = Math.max(minY, Math.min(maxY, y));
            
            itemWindow.style.left = constrainedX + 'px';
            itemWindow.style.top = constrainedY + 'px';
            
            // Save position to item data
            const parentListId = parseInt(itemWindow.dataset.parentListId);
            const item = this.findItemById(itemId, parentListId);
            if (item) {
                if (!item.zoomedPosition) item.zoomedPosition = {};
                item.zoomedPosition.x = constrainedX;
                item.zoomedPosition.y = constrainedY;
                this.saveToStorage();
            }
        }
    }

    updateItemWindowSize(itemId, width, height) {
        const itemWindow = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemWindow) {
            itemWindow.style.width = width + 'px';
            itemWindow.style.height = height + 'px';
            
            // Save size to item data
            const parentListId = parseInt(itemWindow.dataset.parentListId);
            const item = this.findItemById(itemId, parentListId);
            if (item) {
                if (!item.zoomedSize) item.zoomedSize = {};
                item.zoomedSize.width = width;
                item.zoomedSize.height = height;
                this.saveToStorage();
            }
        }
    }

    updateListPosition(listId, x, y) {
        const list = this.lists.find(l => l.id === listId);
        if (list) {
            // Constrain position to keep title bar accessible
            const headerHeight = 120; // Height of fixed header (consistent with item windows)
            const minX = 0;
            const minY = headerHeight;
            const maxX = window.innerWidth - 100; // Leave some space on right
            const maxY = window.innerHeight - 100; // Leave some space on bottom
            
            list.position.x = Math.max(minX, Math.min(maxX, x));
            list.position.y = Math.max(minY, Math.min(maxY, y));
            this.saveToStorage();
            
            const listCard = document.querySelector(`[data-list-id="${listId}"]`);
            if (listCard) {
                listCard.style.left = list.position.x + 'px';
                listCard.style.top = list.position.y + 'px';
            }
        }
    }

    updateListSize(listId, width, height) {
        const list = this.lists.find(l => l.id === listId);
        if (list) {
            if (this.debug) {
                console.log(`Updating list ${listId} size from ${list.size.width}x${list.size.height} to ${width}x${height}`);
            }
            list.size.width = width;
            list.size.height = height;
            this.saveToStorage();
            
            const listCard = document.querySelector(`[data-list-id="${listId}"]`);
            if (listCard) {
                listCard.style.width = width + 'px';
                listCard.style.height = height + 'px';
            }
        }
    }

    // Debug utilities
    enableDebug() {
        this.debug = true;
        console.log('Debug mode enabled. Available commands:');
        console.log('- listMaker.inspectList(id) - inspect a specific list');
        console.log('- listMaker.inspectAll() - inspect all lists');
        console.log('- listMaker.validateState() - check for inconsistencies');
    }

    inspectList(listId) {
        const list = this.lists.find(l => l.id === listId);
        const domElement = document.querySelector(`[data-list-id="${listId}"]`);
        
        console.log('=== LIST INSPECTION ===');
        console.log('Stored data:', list);
        console.log('DOM element:', domElement);
        if (domElement) {
            console.log('DOM size:', {
                width: domElement.offsetWidth,
                height: domElement.offsetHeight
            });
            console.log('DOM position:', {
                x: domElement.offsetLeft,
                y: domElement.offsetTop
            });
        }
    }

    inspectAll() {
        this.lists.forEach(list => {
            console.log(`List ${list.id} (${list.title}):`, {
                position: list.position,
                size: list.size,
                zIndex: list.zIndex,
                itemCount: list.items.length
            });
        });
    }

    validateState() {
        const issues = [];
        
        this.lists.forEach(list => {
            if (list.position.y < 80) {
                issues.push(`List ${list.id} positioned above header (y=${list.position.y})`);
            }
            if (list.size.width < 300) {
                issues.push(`List ${list.id} too narrow (width=${list.size.width})`);
            }
            if (list.size.height < 200) {
                issues.push(`List ${list.id} too short (height=${list.size.height})`);
            }
        });
        
        if (issues.length === 0) {
            console.log('✅ No state issues found');
        } else {
            console.log('❌ State issues found:');
            issues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        return issues;
    }

    captureCurrentState() {
        if (this.currentView === 'root') {
            // Capture regular list positions and sizes
            this.lists.forEach(list => {
                const existingCard = document.querySelector(`[data-list-id="${list.id}"]`);
                if (existingCard) {
                    list.size.width = existingCard.offsetWidth;
                    list.size.height = existingCard.offsetHeight;
                    list.position.x = existingCard.offsetLeft;
                    list.position.y = existingCard.offsetTop;
                }
            });
        } else if (this.currentView === 'zoomed') {
            // Capture item window positions and sizes in zoomed view
            const itemWindows = document.querySelectorAll('[data-item-id]');
            
            itemWindows.forEach(window => {
                const itemId = parseInt(window.dataset.itemId);
                const parentListId = parseInt(window.dataset.parentListId);
                
                // Find the item in the data structure
                const item = this.findItemById(itemId, parentListId);
                if (item) {
                    // Initialize spatial data if it doesn't exist
                    if (!item.zoomedPosition) item.zoomedPosition = {};
                    if (!item.zoomedSize) item.zoomedSize = {};
                    
                    // Store current position and size
                    item.zoomedPosition.x = window.offsetLeft;
                    item.zoomedPosition.y = window.offsetTop;
                    item.zoomedSize.width = window.offsetWidth;
                    item.zoomedSize.height = window.offsetHeight;
                }
            });
        }
        
        this.saveToStorage();
    }

    // Zoom functionality
    zoomIntoList(listId) {
        const list = this.lists.find(l => l.id === listId);
        if (!list) return;

        // Capture current state before switching views
        this.captureCurrentState();

        this.currentView = 'zoomed';
        this.zoomedListId = listId;
        this.navigationPath = [{ id: listId, title: list.title }];
        this.render();
    }

    zoomOut() {
        // Capture current state before switching views
        this.captureCurrentState();

        this.currentView = 'root';
        this.zoomedListId = null;
        this.zoomedItemId = null;
        this.navigationPath = [];
        this.render();
    }

    renderItemAsList(item, parentListId, index) {
        // Use stored spatial data if available, otherwise use default positioning
        const position = item.zoomedPosition || this.getItemWindowPosition(index);
        const hasSubItems = item.items && item.items.length > 0;
        
        // Use stored size if available, otherwise use default size
        const width = item.zoomedSize ? item.zoomedSize.width : 350;
        const height = item.zoomedSize ? item.zoomedSize.height : 400;
        
        // Render sub-items as regular list items
        const itemsHtml = hasSubItems ? this.renderItems(item.items, parentListId, [item.id]) : '';
        
        return `
            <div class="list-card" 
                 data-item-id="${item.id}" 
                 data-parent-list-id="${parentListId}"
                 style="left: ${position.x}px; top: ${position.y}px; width: ${width}px; height: ${height}px; z-index: ${100 + index};">
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

    bindBreadcrumbEvents() {
        const breadcrumbNav = document.getElementById('breadcrumb-nav');
        if (!breadcrumbNav) return;

        breadcrumbNav.addEventListener('click', (e) => {
            if (e.target.classList.contains('breadcrumb-item')) {
                const action = e.target.dataset.action;
                if (action === 'root') {
                    this.zoomOut();
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
            const zoomedList = this.lists.find(l => l.id === this.zoomedListId);
            breadcrumbHTML = `
                <span class="breadcrumb-item" data-action="root">All Lists</span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-item active">${zoomedList ? zoomedList.title : 'Unknown List'}</span>
            `;
        }

        breadcrumbNav.innerHTML = breadcrumbHTML;
    }

    minimizeList(listId) {
        this.captureCurrentState();
        this.minimizedLists.add(listId);
        this.render();
    }

    minimizeItem(itemId, parentListId) {
        this.captureCurrentState();
        this.minimizedItems.add(parseInt(itemId));
        this.render();
    }

    restoreList(listId) {
        this.minimizedLists.delete(listId);
        this.render();
    }

    restoreItem(itemId) {
        this.minimizedItems.delete(parseInt(itemId));
        this.render();
    }

    updateTaskbar() {
        const taskbarItems = document.getElementById('taskbar-items');
        if (!taskbarItems) return;

        let taskbarHTML = '';

        // Add minimized lists
        this.minimizedLists.forEach(listId => {
            const list = this.lists.find(l => l.id === listId);
            if (list) {
                taskbarHTML += `
                    <button class="taskbar-item" data-list-id="${listId}" data-action="restore-list">
                        ${list.title}
                    </button>
                `;
            }
        });

        // Add minimized items (only in zoomed view)
        if (this.currentView === 'zoomed') {
            this.minimizedItems.forEach(itemId => {
                const item = this.findItemById(itemId, this.zoomedListId);
                if (item) {
                    taskbarHTML += `
                        <button class="taskbar-item" data-item-id="${itemId}" data-action="restore-item">
                            ${item.text}
                        </button>
                    `;
                }
            });
        }

        taskbarItems.innerHTML = taskbarHTML;

        // Bind taskbar click events
        taskbarItems.addEventListener('click', (e) => {
            if (e.target.classList.contains('taskbar-item')) {
                const action = e.target.dataset.action;
                const listId = e.target.dataset.listId;
                const itemId = e.target.dataset.itemId;

                if (action === 'restore-list' && listId) {
                    this.restoreList(parseInt(listId));
                } else if (action === 'restore-item' && itemId) {
                    this.restoreItem(parseInt(itemId));
                }
            }
        });
    }

    editItemInZoomedView(itemId, parentListId) {
        const parentList = this.lists.find(l => l.id === parseInt(parentListId));
        if (!parentList) return;

        const item = parentList.items.find(i => i.id === parseInt(itemId));
        if (!item) return;

        const newText = prompt('Edit item text:', item.text);
        if (newText !== null && newText.trim() !== '') {
            item.text = newText.trim();
            this.saveToStorage();
            this.render();
        }
    }

    zoomIntoItem(itemId, parentListId) {
        const parentList = this.lists.find(l => l.id === parseInt(parentListId));
        if (!parentList) return;

        const item = parentList.items.find(i => i.id === parseInt(itemId));
        if (!item) return;

        // Capture current state before switching views
        this.captureCurrentState();

        // Convert the item to a sublist if it isn't already
        if (item.type !== 'sublist') {
            item.type = 'sublist';
            item.items = item.items || [];
            item.expanded = true;
        }

        // Set up zoom state for this item
        this.currentView = 'zoomed';
        this.zoomedListId = parentListId;
        this.zoomedItemId = itemId;
        
        // Update navigation path
        this.navigationPath.push({ id: itemId, title: item.text, type: 'item' });
        
        this.saveToStorage();
        this.render();
    }

    addItemToZoomedItem(itemId, parentListId, text) {
        if (!text || !text.trim()) return;

        const parentList = this.lists.find(l => l.id === parseInt(parentListId));
        if (!parentList) return;

        const targetItem = parentList.items.find(i => i.id === parseInt(itemId));
        if (!targetItem) return;

        // Ensure the target item is a sublist
        if (targetItem.type !== 'sublist') {
            targetItem.type = 'sublist';
            targetItem.items = targetItem.items || [];
            targetItem.expanded = true;
        }

        const newItem = {
            id: Date.now(),
            text: text.trim(),
            type: 'item',
            items: [],
            expanded: true
        };

        targetItem.items.push(newItem);
        this.saveToStorage();
        this.render();
    }

    updateListZIndex(listId, zIndex) {
        const listCard = document.querySelector(`[data-list-id="${listId}"]`);
        if (listCard) {
            listCard.style.zIndex = zIndex;
        }
    }

    bindResizeHandler() {
        window.addEventListener('resize', () => {
            // Fix positions of all lists when window is resized
            this.lists.forEach(list => {
                this.fixListPosition(list);
                const listCard = document.querySelector(`[data-list-id="${list.id}"]`);
                if (listCard) {
                    listCard.style.left = list.position.x + 'px';
                    listCard.style.top = list.position.y + 'px';
                }
            });
            this.saveToStorage();
        });
    }

    saveToStorage() {
        localStorage.setItem('listMakerData', JSON.stringify(this.lists));
    }

    loadFromStorage() {
        const data = localStorage.getItem('listMakerData');
        if (!data) return null;
        
        const parsedData = JSON.parse(data);
        return this.migrateOldData(parsedData);
    }

    migrateOldData(lists) {
        return lists.map((list, index) => {
            const migratedList = {
                ...list,
                items: this.migrateItems(list.items || []),
                position: list.position || this.getDefaultPosition(index),
                size: list.size || { width: 350, height: 400 },
                zIndex: list.zIndex || (100 + index)
            };
            
            // Fix lists that are positioned above the header
            this.fixListPosition(migratedList);
            
            return migratedList;
        });
    }

    fixListPosition(list) {
        const headerHeight = 120;
        const minX = 0;
        const minY = headerHeight;
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;
        
        if (list.position.x < minX || list.position.x > maxX) {
            list.position.x = Math.max(minX, Math.min(maxX, list.position.x));
        }
        
        if (list.position.y < minY || list.position.y > maxY) {
            list.position.y = Math.max(minY, Math.min(maxY, list.position.y));
        }
    }

    getDefaultPosition(index = 0) {
        const offset = index * 30;
        return {
            x: 50 + offset,
            y: 100 + offset  // Start below the fixed header
        };
    }

    getItemWindowPosition(index = 0) {
        const headerHeight = 140; // Account for min-height + padding + content + extra margin
        const safeMargin = 20;
        const offset = index * 30;
        return {
            x: 50 + offset,
            y: headerHeight + safeMargin + offset  // Ensure windows start below header with margin
        };
    }

    getSmartPosition() {
        // Start with a base position
        const baseX = 100;
        const baseY = 120;
        const listWidth = 350;
        const listHeight = 400;
        const margin = 20;
        
        // If no existing lists, use base position
        if (this.lists.length === 0) {
            return { x: baseX, y: baseY };
        }
        
        // Try to find a position that doesn't overlap
        const maxAttempts = 20;
        let attempt = 0;
        
        while (attempt < maxAttempts) {
            // Calculate position with cascading offset
            const offsetX = (attempt % 5) * 30;
            const offsetY = Math.floor(attempt / 5) * 30;
            const candidateX = baseX + offsetX;
            const candidateY = baseY + offsetY;
            
            // Check if this position overlaps with any existing list
            const overlaps = this.lists.some(list => {
                const listRight = list.position.x + listWidth;
                const listBottom = list.position.y + listHeight;
                const candidateRight = candidateX + listWidth;
                const candidateBottom = candidateY + listHeight;
                
                return !(candidateX > listRight + margin || 
                        candidateRight < list.position.x - margin ||
                        candidateY > listBottom + margin || 
                        candidateBottom < list.position.y - margin);
            });
            
            if (!overlaps) {
                return { x: candidateX, y: candidateY };
            }
            
            attempt++;
        }
        
        // If we couldn't find a non-overlapping position, use cascading default
        const fallbackOffset = this.lists.length * 30;
        return {
            x: baseX + fallbackOffset,
            y: baseY + fallbackOffset
        };
    }

    migrateItems(items) {
        return items.map(item => ({
            ...item,
            type: item.type || 'item',
            items: this.migrateItems(item.items || []),
            expanded: item.expanded !== undefined ? item.expanded : true
        }));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ListMaker();
});