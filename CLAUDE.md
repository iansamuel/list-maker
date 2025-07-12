# CLAUDE.md

This file provides guidance to AI code agents (Claude Code, Gemini Code Assist, etc.) when working with code in this repository.

**Multi-Agent Compatibility**: This documentation is designed to work with various AI coding assistants. The same guidance applies regardless of which agent you're using.

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
- **Position Validation**: Comprehensive system preventing windows from getting stuck behind header
- **Automatic Correction**: Real-time position validation with automatic fixes
- **Window Lifecycle**: Create, destroy, minimize, restore windows
- **Smart Positioning**: Collision avoidance with validated safe zones
- **Drag & Drop**: Window dragging and resizing with position constraints
- **Z-Index Management**: Window layering and focus
- **Taskbar**: Minimized window management
- **Position Monitoring**: Periodic validation and automatic correction system

#### **AppController** (`js/app-controller.js`)
Orchestrates all components - the main director:
- **Event Delegation**: Routes UI events to appropriate systems
- **View Management**: Root view vs zoomed view transitions with position persistence
- **Rendering**: Coordinates UI updates between data and windows
- **Navigation**: Hierarchical breadcrumb system with deep navigation support
- **View State**: Position persistence across view transitions
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
- **Position Validation System**: Comprehensive prevention of inaccessible window positions
- **Automatic Correction**: Real-time validation with immediate fixes for stuck windows
- **Position Constraints**: Enforced minimum Y position (header + 10px buffer), viewport boundaries
- **Monitoring System**: Periodic checks (5s intervals) + window resize event handling
- **Diagnostic Tools**: Position scanning and batch correction utilities
- Key methods: `validatePosition()`, `fixStuckWindows()`, `scanForPositionIssues()`, `moveWindow()`, `resizeWindow()`

#### Data Management (ListEngine)
- **Pure Data Layer**: No UI concerns, only business logic
- **CRUD Operations**: All data manipulation through clean APIs
- **Persistence**: Automatic localStorage with data migration
- **Export System**: Multi-format export (JSON, HTML, Markdown)

#### View Orchestration (AppController)
- **Event Delegation**: Single container-level event listener
- **View Management**: Root view vs zoomed view transitions with automatic position persistence
- **Navigation System**: Hierarchical breadcrumb navigation with clickable path traversal
- **Position Persistence**: View-specific window arrangement storage and restoration
- **Deep Navigation**: Support for infinite zoom depth with proper state management
- **Rendering**: Coordinates between data and windowing systems

## Common Development Tasks

### Adding New Features
1. **Determine the layer**: Data (ListEngine), UI (AppController), or Windows (WindowSystem)
2. **Use appropriate APIs**: Each system has clean, focused interfaces
3. **Maintain separation**: Don't mix data logic with UI or window logic
4. **Test each layer**: Components can be tested in isolation

### Debugging Issues
- Enable debug mode: `listMaker.enableDebug()` in console
- **Data Issues**: Use `listMaker.listEngine.validateData()` and `listMaker.listEngine.getStats()`
- **Position Issues**: Use `listMaker.windowSystem.fixStuckWindows()` for automatic fixes
- **Position Diagnostics**: Use `listMaker.windowSystem.scanForPositionIssues()` for analysis
- **View Positions**: Use `listMaker.windowSystem.viewPositions` to inspect saved arrangements
- **Window Issues**: Use `listMaker.windowSystem.inspectAll()` and `listMaker.windowSystem.inspectWindow(id)`
- **Position Testing**: Use `listMaker.windowSystem.validatePosition(x, y, w, h)` to test coordinates
- **Navigation State**: Use `listMaker.navigationPath` and `listMaker.currentView` to inspect zoom state
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

## Git Workflow

**IMPORTANT**: This project follows a specific Git workflow:

1. **Local commits are fine** - Make commits locally to save progress
2. **Never push without permission** - DO NOT run `git push` without explicit user instruction
3. **Ask before pushing** - Always wait for user to say "push to GitHub" or similar
4. **User controls deployment** - The user decides when changes go live

Always commit changes locally for version control, but let the user control when those changes are published to GitHub.

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
- **Position Validation**: All window positions automatically validated and corrected
- **Accessibility Enforcement**: Windows cannot be positioned behind header or off-screen
- **Automatic Monitoring**: System continuously checks for and fixes position issues
- Dragging handled by mouse events on `.list-header` elements with position constraints
- Resizing via `.resize-handle` elements in bottom-right corner
- Z-index management for bringing windows to front

### Data Persistence
- Auto-save to localStorage on every change
- Data migration system for backward compatibility
- Export functionality supports JSON, HTML, and Markdown formats

### Navigation & View Management
- **Hierarchical Breadcrumbs**: Full navigation path display with clickable levels
- **Deep Navigation**: Infinite zoom depth with proper state management
- **Position Persistence**: Window arrangements saved per view and automatically restored
- **View Transitions**: Seamless navigation between root, list, and item levels
- **Smart Restoration**: Position validation ensures windows remain accessible after restoration

### Performance Optimizations
- Incremental DOM updates to prevent position loss
- Event delegation reduces event listener overhead
- Spatial state caching prevents unnecessary recalculations
- Minimized windows hidden with `display: none` but kept in DOM

## Important Constants

- `HEADER_HEIGHT = 140` - Header height, determines minimum Y position for windows  
- `POSITION_CONSTRAINTS.minY = 150` - Enforced minimum Y position (header + 10px buffer)
- `POSITION_CONSTRAINTS.minVisibleWidth = 50` - Minimum visible window width for accessibility
- `POSITION_CONSTRAINTS.minVisibleHeight = 30` - Minimum visible window height for title bar access
- `BUILD_NUMBER = 102` - Current build tracking
- Default window size: 350x400px
- Position monitoring interval: 5000ms (5 seconds)
- Default positions use smart collision avoidance with validation

## Testing

No formal test framework. Test manually by:
1. Creating lists and items
2. Dragging and resizing windows
3. Using zoom in/out functionality with deep navigation
4. Testing breadcrumb navigation at different zoom levels
5. Minimizing/restoring windows across view transitions
6. Converting items to sublists
7. Verifying position persistence when navigating between views
8. Exporting data in different formats

## Common Pitfalls

1. **Don't mix concerns** - Keep data logic in ListEngine, UI logic in AppController, spatial logic in WindowSystem
2. **Don't bypass APIs** - Use the clean interfaces provided by each component
3. **Don't modify data directly** - Always use ListEngine methods for data changes
4. **Don't manipulate windows directly** - Use WindowSystem methods for spatial operations
5. **Maintain the dependency order** - Scripts must load in correct order (ListEngine, WindowSystem, AppController, Main)
6. **Trust position validation** - All positioning goes through validation automatically
7. **Use event delegation** - AppController handles all events through container-level listeners
8. **Don't manually position windows behind header** - System prevents this automatically
9. **Rely on automatic correction** - Position monitoring fixes issues without intervention