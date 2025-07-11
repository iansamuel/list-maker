# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **List Maker** application - a hierarchical spatial workspace for managing lists with infinite depth. Built with vanilla JavaScript, HTML, and CSS, it provides a unique windowed interface where lists can be arranged spatially and items can be zoomed into as separate windows.

## Key Architecture

### Modular Architecture (Refactored)
The application is now split into focused, single-responsibility modules:

#### **ListEngine** (`js/list-engine.js`)
Pure data management layer - no UI concerns:
- **Data Structure Management**: Lists, items, hierarchical relationships
- **CRUD Operations**: Create, read, update, delete lists and items
- **Persistence**: localStorage save/load with data migration
- **Export**: JSON, HTML, Markdown export functionality
- **Validation**: Data integrity checks and error handling

#### **WindowSystem** (`js/window-system.js`)
Pure spatial window management - no business logic:
- **Spatial Stability**: "Snow Leopard Architecture" for maintaining positions
- **Window Lifecycle**: Create, destroy, minimize, restore windows
- **Positioning**: Smart positioning with collision avoidance
- **Drag & Drop**: Window dragging and resizing
- **Z-Index Management**: Window layering and focus
- **Taskbar**: Minimized window management

#### **AppController** (`js/app-controller.js`)
Orchestrates all components - the main director:
- **Event Delegation**: Routes UI events to appropriate systems
- **View Management**: Root view vs zoomed view transitions
- **Rendering**: Coordinates UI updates between data and windows
- **Navigation**: Breadcrumb system and view state
- **Integration**: Bridges ListEngine and WindowSystem

#### **Main** (`js/main.js`)
Entry point and global concerns:
- **Initialization**: Boots up all components
- **Error Handling**: Global error management
- **Debug Support**: Development helpers and debugging tools

### Data Structure
```javascript
{
  id: number,
  title: string,
  items: Array<Item>,
  position: {x: number, y: number},
  size: {width: number, height: number},
  zIndex: number
}
```

Items can be nested infinitely:
```javascript
{
  id: number,
  text: string,
  type: 'item' | 'sublist',
  items: Array<Item>,
  expanded: boolean,
  zoomedPosition?: {x: number, y: number},
  zoomedSize?: {width: number, height: number}
}
```

### Critical Systems

#### Spatial Stability System (WindowSystem)
- **Snow Leopard Architecture**: Maintains window positions through DOM updates
- **Window Lifecycle**: Create, destroy, minimize, restore operations
- **Position Constraints**: Windows cannot be positioned above header (y < 140px)
- Key methods: `captureAllSpatialState()`, `restoreSpatialState()`, `moveWindow()`, `resizeWindow()`

#### Data Management (ListEngine)
- **Pure Data Layer**: No UI concerns, only business logic
- **CRUD Operations**: All data manipulation through clean APIs
- **Persistence**: Automatic localStorage with data migration
- **Export System**: Multi-format export (JSON, HTML, Markdown)

#### View Orchestration (AppController)
- **Event Delegation**: Single container-level event listener
- **View Management**: Root view vs zoomed view transitions
- **Rendering**: Coordinates between data and windowing systems
- **Navigation**: Breadcrumb system for hierarchical navigation

## Common Development Tasks

### Adding New Features
1. **Determine the layer**: Data (ListEngine), UI (AppController), or Windows (WindowSystem)
2. **Use appropriate APIs**: Each system has clean, focused interfaces
3. **Maintain separation**: Don't mix data logic with UI or window logic
4. **Test each layer**: Components can be tested in isolation

### Debugging Issues
- Enable debug mode: `listMaker.enableDebug()` in console
- **Data Issues**: Use `listMaker.listEngine.validateData()` and `listMaker.listEngine.getStats()`
- **Window Issues**: Use `listMaker.windowSystem.inspectAll()` and `listMaker.windowSystem.fixStuckWindows()`
- **Application Issues**: Use `listMaker.getStats()` for overall state

### Working with Components
- **ListEngine**: Pure data operations, no side effects
- **WindowSystem**: Pure spatial operations, no business logic
- **AppController**: Coordinates between systems, handles UI events
- All components expose clean APIs and can be used independently

## Development Commands

This is a vanilla JavaScript project with no build system:

```bash
# Serve locally for development
python -m http.server 8000
# or
npx serve .

# Open directly in browser
open index.html
```

## File Structure

- `index.html` - Main HTML structure with PWA meta tags
- `style.css` - Comprehensive styling with responsive design
- `README.md` - Project documentation and features
- `js/` - Modular JavaScript architecture:
  - `list-engine.js` - Pure data management layer
  - `window-system.js` - Spatial window management system
  - `app-controller.js` - Main application orchestrator
  - `main.js` - Entry point and initialization

## Key Implementation Details

### Window Management
- Windows are positioned absolutely within full-screen container
- Dragging handled by mouse events on `.list-header` elements
- Resizing via `.resize-handle` elements in bottom-right corner
- Z-index management for bringing windows to front

### Data Persistence
- Auto-save to localStorage on every change
- Data migration system for backward compatibility
- Export functionality supports JSON, HTML, and Markdown formats

### Performance Optimizations
- Incremental DOM updates to prevent position loss
- Event delegation reduces event listener overhead
- Spatial state caching prevents unnecessary recalculations
- Minimized windows hidden with `display: none` but kept in DOM

## Important Constants

- `HEADER_HEIGHT = 140` - Minimum Y position for windows
- `BUILD_NUMBER = 100` - Current build tracking
- Default window size: 350x400px
- Default positions use smart collision avoidance

## Testing

No formal test framework. Test manually by:
1. Creating lists and items
2. Dragging and resizing windows
3. Using zoom in/out functionality
4. Minimizing/restoring windows
5. Converting items to sublists
6. Exporting data in different formats

## Common Pitfalls

1. **Don't mix concerns** - Keep data logic in ListEngine, UI logic in AppController, spatial logic in WindowSystem
2. **Don't bypass APIs** - Use the clean interfaces provided by each component
3. **Don't modify data directly** - Always use ListEngine methods for data changes
4. **Don't manipulate windows directly** - Use WindowSystem methods for spatial operations
5. **Maintain the dependency order** - Scripts must load in correct order (ListEngine, WindowSystem, AppController, Main)
6. **Respect header height constraint** - Windows must be positioned below y=140
7. **Use event delegation** - AppController handles all events through container-level listeners