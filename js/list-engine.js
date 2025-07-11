/**
 * ListEngine - Pure data management for hierarchical lists
 * Handles all CRUD operations, persistence, and export functionality
 * No UI concerns - pure business logic
 */
class ListEngine {
    constructor() {
        this.lists = [];
        this.currentId = 1;
        this.lastItemId = 0;
        this.itemIdCounter = 0;
        this.loadFromStorage();
        this.updateCurrentId();
    }

    // ==========================================
    // CORE DATA OPERATIONS
    // ==========================================

    createList(title) {
        if (!title || !title.trim()) {
            throw new Error('List title cannot be empty');
        }

        const newList = {
            id: this.currentId++,
            title: title.trim(),
            items: [],
            metadata: {
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            }
        };

        this.lists.push(newList);
        this.saveToStorage();
        return newList;
    }

    deleteList(listId) {
        const index = this.lists.findIndex(list => list.id === listId);
        if (index === -1) {
            throw new Error(`List with ID ${listId} not found`);
        }

        const deletedList = this.lists.splice(index, 1)[0];
        this.saveToStorage();
        return deletedList;
    }

    getList(listId) {
        return this.lists.find(list => list.id === listId);
    }

    getAllLists() {
        return [...this.lists]; // Return copy to prevent external mutation
    }

    updateListTitle(listId, newTitle) {
        const list = this.getList(listId);
        if (!list) {
            throw new Error(`List with ID ${listId} not found`);
        }

        list.title = newTitle.trim();
        list.metadata.modified = new Date().toISOString();
        this.saveToStorage();
        return list;
    }

    // ==========================================
    // ITEM OPERATIONS
    // ==========================================

    addItem(listId, text, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.getList(listId);
        if (!targetContainer) {
            throw new Error('Target container not found');
        }

        if (!text || !text.trim()) {
            throw new Error('Item text cannot be empty');
        }

        const newItem = {
            id: this.generateItemId(),
            text: text.trim(),
            type: 'item',
            items: [],
            expanded: true,
            metadata: {
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            }
        };

        targetContainer.items.push(newItem);
        this.updateListModified(listId);
        this.saveToStorage();
        return newItem;
    }

    deleteItem(listId, itemId, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.getList(listId);
        if (!targetContainer) {
            throw new Error('Target container not found');
        }

        const index = targetContainer.items.findIndex(item => item.id === itemId);
        if (index === -1) {
            throw new Error(`Item with ID ${itemId} not found`);
        }

        const deletedItem = targetContainer.items.splice(index, 1)[0];
        this.updateListModified(listId);
        this.saveToStorage();
        return deletedItem;
    }

    updateItem(listId, itemId, newText, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.getList(listId);
        if (!targetContainer) {
            throw new Error('Target container not found');
        }

        const item = targetContainer.items.find(i => i.id === itemId);
        if (!item) {
            throw new Error(`Item with ID ${itemId} not found`);
        }

        item.text = newText.trim();
        item.metadata.modified = new Date().toISOString();
        this.updateListModified(listId);
        this.saveToStorage();
        return item;
    }

    convertToSubList(listId, itemId, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.getList(listId);
        if (!targetContainer) {
            throw new Error('Target container not found');
        }

        const item = targetContainer.items.find(i => i.id === itemId);
        if (!item) {
            throw new Error(`Item with ID ${itemId} not found`);
        }

        if (item.type === 'sublist') {
            throw new Error('Item is already a sublist');
        }

        item.type = 'sublist';
        item.expanded = true;
        item.metadata.modified = new Date().toISOString();
        this.updateListModified(listId);
        this.saveToStorage();
        return item;
    }

    toggleExpanded(listId, itemId, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.getList(listId);
        if (!targetContainer) {
            throw new Error('Target container not found');
        }

        const item = targetContainer.items.find(i => i.id === itemId);
        if (!item) {
            throw new Error(`Item with ID ${itemId} not found`);
        }

        if (item.type !== 'sublist') {
            throw new Error('Only sublists can be expanded/collapsed');
        }

        item.expanded = !item.expanded;
        item.metadata.modified = new Date().toISOString();
        this.updateListModified(listId);
        this.saveToStorage();
        return item;
    }

    reorderItems(listId, oldIndex, newIndex, parentPath = null) {
        const targetContainer = parentPath ? this.findItemByPath(parentPath) : this.getList(listId);
        if (!targetContainer) {
            throw new Error('Target container not found');
        }

        if (oldIndex < 0 || oldIndex >= targetContainer.items.length ||
            newIndex < 0 || newIndex >= targetContainer.items.length) {
            throw new Error('Invalid item indices');
        }

        const item = targetContainer.items.splice(oldIndex, 1)[0];
        targetContainer.items.splice(newIndex, 0, item);
        this.updateListModified(listId);
        this.saveToStorage();
        return targetContainer.items;
    }

    // ==========================================
    // SEARCH AND TRAVERSAL
    // ==========================================

    findItemById(itemId, listId) {
        const list = this.getList(listId);
        if (!list) return null;

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

    findItemByPath(path) {
        if (!path || path.length === 0) return null;

        const [listId, ...itemIds] = path;
        let current = this.getList(listId);

        for (const itemId of itemIds) {
            if (!current || !current.items) return null;
            current = current.items.find(i => i.id === itemId);
        }

        return current;
    }

    // ==========================================
    // EXPORT FUNCTIONALITY
    // ==========================================

    exportAllLists(format = 'json') {
        if (this.lists.length === 0) {
            throw new Error('No lists to export');
        }

        switch (format.toLowerCase()) {
            case 'json':
                return this.exportToJSON();
            case 'html':
                return this.exportToHTML();
            case 'markdown':
                return this.exportToMarkdown();
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    exportToJSON() {
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '2.0',
            appName: 'List Maker',
            totalLists: this.lists.length,
            lists: this.lists.map(list => ({
                id: list.id,
                title: list.title,
                items: this.flattenItems(list.items),
                metadata: list.metadata,
                itemCount: this.countAllItems(list.items)
            }))
        };

        return {
            content: JSON.stringify(exportData, null, 2),
            mimeType: 'application/json',
            fileExtension: 'json'
        };
    }

    exportToHTML() {
        const exportDate = new Date().toISOString();
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>List Maker Export</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 40px; }
        .header { border-bottom: 2px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .list { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .list-title { font-size: 1.5em; font-weight: bold; color: #2c3e50; margin-bottom: 15px; }
        .items { margin-left: 20px; }
        .item { margin: 8px 0; padding: 5px 0; }
        .sublist { margin-left: 20px; border-left: 3px solid #9b59b6; padding-left: 15px; margin-top: 10px; }
        .sublist-title { font-weight: bold; color: #9b59b6; margin-bottom: 8px; }
        .meta { color: #666; font-size: 0.9em; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📝 List Maker Export</h1>
        <p>Exported on ${new Date(exportDate).toLocaleString()}</p>
        <p>Total Lists: ${this.lists.length}</p>
    </div>
`;

        this.lists.forEach(list => {
            html += `    <div class="list">
        <div class="list-title">${this.escapeHtml(list.title)}</div>
        <div class="items">
${this.renderItemsHTML(list.items)}
        </div>
    </div>
`;
        });

        html += `    <div class="meta">
        <p>Generated by <strong>List Maker</strong> - A hierarchical list management application</p>
        <p>Total items across all lists: ${this.lists.reduce((sum, list) => sum + this.countAllItems(list.items), 0)}</p>
    </div>
</body>
</html>`;

        return {
            content: html,
            mimeType: 'text/html',
            fileExtension: 'html'
        };
    }

    exportToMarkdown() {
        const exportDate = new Date().toISOString();
        let markdown = `# 📝 List Maker Export

**Exported:** ${new Date(exportDate).toLocaleString()}  
**Total Lists:** ${this.lists.length}

---

`;

        this.lists.forEach(list => {
            markdown += `## ${list.title}\n\n`;
            markdown += this.renderItemsMarkdown(list.items);
            markdown += '\n---\n\n';
        });

        markdown += `*Generated by **List Maker** - A hierarchical list management application*  
*Total items across all lists: ${this.lists.reduce((sum, list) => sum + this.countAllItems(list.items), 0)}*`;

        return {
            content: markdown,
            mimeType: 'text/markdown',
            fileExtension: 'md'
        };
    }

    // ==========================================
    // PERSISTENCE
    // ==========================================

    saveToStorage() {
        try {
            const dataToSave = {
                version: '2.0',
                lists: this.lists,
                currentId: this.currentId,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('listMakerData', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            throw new Error('Failed to save data');
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('listMakerData');
            if (!data) {
                this.lists = [];
                this.currentId = 1;
                return;
            }

            const parsedData = JSON.parse(data);
            
            // Handle different data formats
            if (Array.isArray(parsedData)) {
                // Legacy format - just array of lists
                this.lists = this.migrateOldData(parsedData);
                this.currentId = this.lists.length > 0 ? Math.max(...this.lists.map(l => l.id)) + 1 : 1;
            } else {
                // New format - structured data
                this.lists = this.migrateOldData(parsedData.lists || []);
                this.currentId = parsedData.currentId || 1;
            }

            this.updateCurrentId();
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            this.lists = [];
            this.currentId = 1;
        }
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    generateItemId() {
        // Ensure uniqueness by adding a small counter for same-millisecond calls
        const timestamp = Date.now();
        if (this.lastItemId === timestamp) {
            this.itemIdCounter = (this.itemIdCounter || 0) + 1;
            return timestamp + this.itemIdCounter;
        } else {
            this.lastItemId = timestamp;
            this.itemIdCounter = 0;
            return timestamp;
        }
    }

    updateCurrentId() {
        if (this.lists.length > 0) {
            this.currentId = Math.max(...this.lists.map(l => l.id)) + 1;
        }
    }

    updateListModified(listId) {
        const list = this.getList(listId);
        if (list) {
            list.metadata = list.metadata || {};
            list.metadata.modified = new Date().toISOString();
        }
    }

    countAllItems(items) {
        let count = items.length;
        items.forEach(item => {
            if (item.items && item.items.length > 0) {
                count += this.countAllItems(item.items);
            }
        });
        return count;
    }

    flattenItems(items) {
        return items.map(item => ({
            id: item.id,
            text: item.text,
            type: item.type,
            expanded: item.expanded,
            metadata: item.metadata,
            items: item.items ? this.flattenItems(item.items) : []
        }));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderItemsHTML(items, level = 0) {
        let html = '';
        items.forEach(item => {
            if (item.type === 'item') {
                html += `            <div class="item">• ${this.escapeHtml(item.text)}</div>\n`;
            } else if (item.type === 'sublist') {
                html += `            <div class="sublist">
                <div class="sublist-title">📂 ${this.escapeHtml(item.text)}</div>
${this.renderItemsHTML(item.items, level + 1)}
            </div>\n`;
            }
        });
        return html;
    }

    renderItemsMarkdown(items, level = 0) {
        let markdown = '';
        items.forEach(item => {
            const indent = '  '.repeat(level);
            if (item.type === 'item') {
                markdown += `${indent}- ${item.text}\n`;
            } else if (item.type === 'sublist') {
                markdown += `${indent}- **📂 ${item.text}**\n`;
                markdown += this.renderItemsMarkdown(item.items, level + 1);
            }
        });
        return markdown;
    }

    migrateOldData(lists) {
        return lists.map((list, index) => {
            const migratedList = {
                ...list,
                items: this.migrateItems(list.items || []),
                metadata: list.metadata || {
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                }
            };

            return migratedList;
        });
    }

    migrateItems(items) {
        return items.map(item => ({
            ...item,
            type: item.type || 'item',
            items: this.migrateItems(item.items || []),
            expanded: item.expanded !== undefined ? item.expanded : true,
            metadata: item.metadata || {
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            }
        }));
    }

    // ==========================================
    // VALIDATION AND DEBUG
    // ==========================================

    validateData() {
        const issues = [];

        this.lists.forEach(list => {
            if (!list.id || !list.title) {
                issues.push(`List ${list.id} missing required fields`);
            }
            
            if (!Array.isArray(list.items)) {
                issues.push(`List ${list.id} has invalid items array`);
            }

            this.validateItems(list.items, `List ${list.id}`, issues);
        });

        return issues;
    }

    validateItems(items, context, issues) {
        items.forEach((item, index) => {
            if (!item.id || !item.text) {
                issues.push(`${context} item ${index} missing required fields`);
            }

            if (item.type === 'sublist' && !Array.isArray(item.items)) {
                issues.push(`${context} sublist ${item.id} has invalid items array`);
            }

            if (item.items && item.items.length > 0) {
                this.validateItems(item.items, `${context} > ${item.text}`, issues);
            }
        });
    }

    getStats() {
        return {
            totalLists: this.lists.length,
            totalItems: this.lists.reduce((sum, list) => sum + this.countAllItems(list.items), 0),
            currentId: this.currentId,
            dataSize: JSON.stringify(this.lists).length
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ListEngine;
}