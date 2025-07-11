# 📝 List Maker - Hierarchical Spatial Workspace

A powerful, intuitive list management application that transforms simple lists into infinite hierarchical workspaces. Built with vanilla JavaScript, HTML, and CSS.

## 🌟 **Live Demo**
**[Try it live: https://iansamuel.github.io/list-maker](https://iansamuel.github.io/list-maker)**

## ✨ **Features**

### 🔍 **Hierarchical Navigation**
- **Zoom into any list** to see its items as individual windows
- **Infinite depth** - items can become lists, which can have sub-items, and so on
- **Breadcrumb navigation** to always know where you are
- **Seamless view transitions** between root and zoomed views

### 🪟 **Spatial Window Management**
- **Drag and drop** windows anywhere on screen
- **Resize windows** with mouse handles
- **Smart positioning** prevents overlapping on creation
- **Persistent spatial memory** - windows remember their exact positions and sizes
- **macOS-style constraints** - windows can't be moved above the header

### 🗂️ **Advanced List Features**
- **Nested sub-lists** - convert any item into a sub-list
- **Drag-and-drop reordering** within lists
- **Real-time editing** of list titles and items
- **Expandable/collapsible** sub-lists
- **Visual hierarchy** with color-coded borders

### 🎛️ **Window Management**
- **Minimize to taskbar** - Windows 95-style taskbar at bottom
- **One-click restore** from taskbar
- **Auto-focus** - clicking any window brings it to front
- **Context-aware taskbar** - shows relevant minimized items

### 💾 **Data Persistence**
- **Auto-save** - all changes saved instantly to localStorage
- **Export functionality** - download all lists as JSON with metadata
- **Session persistence** - maintains state across browser sessions
- **Spatial persistence** - remembers window positions across views

### 📱 **Mobile Ready**
- **PWA support** - add to home screen on mobile devices
- **Touch-optimized** interface
- **Responsive design** works on all screen sizes
- **Custom app icon** when installed

## 🚀 **Getting Started**

### Quick Start
1. **Visit the live demo**: https://iansamuel.github.io/list-maker
2. **Create your first list** using the input field at the top
3. **Add items** to your list
4. **Convert items to sub-lists** using the ⊞ button
5. **Zoom in** using the 🔍 button to see items as individual windows
6. **Drag, resize, and organize** your workspace
7. **Minimize unused windows** with the − button

### Local Development
```bash
# Clone the repository
git clone https://github.com/iansamuel/list-maker.git
cd list-maker

# Open in browser (no build process needed!)
open index.html
# or serve locally
python -m http.server 8000
```

## 🎯 **Use Cases**

- **Project Management** - Break down projects into hierarchical tasks
- **Note Organization** - Create nested knowledge structures  
- **Research** - Organize topics, subtopics, and references spatially
- **Planning** - Hierarchical planning with spatial arrangement
- **Knowledge Management** - Build interconnected information networks
- **Brainstorming** - Spatial idea organization and development

## 🏗️ **Architecture**

### Core Technologies
- **Vanilla JavaScript** - No frameworks, maximum performance
- **CSS Grid & Flexbox** - Modern, responsive layouts
- **HTML5** - Semantic, accessible markup
- **LocalStorage API** - Client-side data persistence

### Key Design Patterns
- **Event Delegation** - Efficient DOM event handling
- **State Management** - Centralized application state
- **Modular Rendering** - Component-based view updates
- **Spatial Data Models** - Position and size persistence
- **Hierarchical Data Structures** - Recursive item nesting

### Performance Features
- **Lazy Rendering** - Only visible windows are in DOM
- **Event Batching** - Optimized DOM updates
- **Memory Management** - Efficient data structure usage
- **Constraint-Based Positioning** - Smart collision avoidance

## 🎨 **User Interface**

### Visual Design
- **Clean, modern aesthetic** inspired by macOS and Windows 95
- **Salmon header** reminiscent of Financial Times branding
- **Color-coded hierarchy** - different colors for lists vs items
- **Smooth animations** for all interactions
- **Contextual hover effects** provide visual feedback

### Interaction Design
- **Intuitive drag-and-drop** - grab any window by its header
- **Right-sized controls** - buttons optimized for both mouse and touch
- **Visual feedback** - hover states, active states, focus management
- **Consistent iconography** - 🔍 for zoom, − for minimize, ✏️ for edit

## 🔧 **Development Story**

This project was built in a single evening session using **AI-assisted development** with Claude Code. What started as a simple list app evolved into a sophisticated spatial workspace through iterative feature development:

1. **Basic List Management** - Create, edit, delete lists
2. **Nested Sub-lists** - Hierarchical data structures
3. **Drag-and-Drop Windows** - Spatial interface paradigm
4. **Hierarchical Zoom Navigation** - Infinite depth exploration
5. **Persistent Spatial Memory** - Remember window arrangements
6. **Minimize/Taskbar System** - Window management
7. **Mobile PWA Support** - Cross-platform accessibility

The AI assistant helped architect complex features like recursive data structures, event delegation patterns, and state management that would typically take much longer to implement solo.

## 📄 **License**

MIT License - see [LICENSE](LICENSE) for details

## 🤝 **Contributing**

This project was created as a demonstration of AI-assisted development. Feel free to fork, modify, and enhance!

## 🚀 **Future Enhancements**

- **Cloud Sync** - Share lists across devices
- **Collaboration** - Real-time multi-user editing
- **Themes** - Customizable color schemes
- **Keyboard Shortcuts** - Power user efficiency
- **Import/Export** - Support for other formats
- **Search** - Find items across all lists
- **Tags** - Category-based organization
- **Reminders** - Time-based notifications

---

**Built with ❤️ using AI-assisted development**

*A showcase of what's possible when human creativity meets AI assistance*