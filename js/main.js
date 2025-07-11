/**
 * Main entry point for List Maker application
 * Initializes the modular architecture and handles global concerns
 */

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    console.error('Stack trace:', e.error?.stack);
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault(); // Prevent default browser behavior
});

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize the application
        const app = new AppController();
        
        // Make globally available for debugging
        window.listMaker = app; // Maintain backward compatibility
        
        // Development helpers
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🔧 Development mode detected');
            console.log('Available debug commands:');
            console.log('- listMaker.enableDebug() - enable debug mode');
            console.log('- listMaker.getStats() - get application statistics');
            console.log('- listMaker.listEngine.validateData() - validate data integrity');
            console.log('- listMaker.windowSystem.fixStuckWindows() - fix stuck windows');
            
            // Enable debug mode by default in development
            setTimeout(() => {
                if (window.location.search.includes('debug=true')) {
                    app.enableDebug();
                }
            }, 1000);
        }
        
        console.log('✅ List Maker initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize List Maker:', error);
        
        // Show user-friendly error message
        const container = document.getElementById('lists-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="
                    text-align: center; 
                    padding: 2rem; 
                    color: #e74c3c; 
                    background: #fdf2f2; 
                    border-radius: 8px; 
                    margin: 2rem;
                    border: 1px solid #e74c3c;
                ">
                    <h3>❌ Failed to Initialize</h3>
                    <p>There was an error starting the List Maker application.</p>
                    <p>Please refresh the page and try again.</p>
                    <details style="margin-top: 1rem; text-align: left;">
                        <summary>Technical Details</summary>
                        <pre style="background: #fff; padding: 1rem; border-radius: 4px; overflow: auto;">
${error.message}
${error.stack}
                        </pre>
                    </details>
                </div>
            `;
        }
    }
});

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Only register service worker if it exists
        fetch('/sw.js').then(response => {
            if (response.ok) {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registered:', registration);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            }
        }).catch(() => {
            // Service worker doesn't exist, skip registration
        });
    });
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppController, ListEngine, WindowSystem };
}