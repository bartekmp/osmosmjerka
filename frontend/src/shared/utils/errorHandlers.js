/**
 * Global error handlers for module loading and other runtime errors
 */

// Handle unhandled promise rejections (like module loading failures)
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    // Check if it's a module loading error
    const isModuleError = event.reason?.message?.includes('loading dynamically imported module') ||
        event.reason?.message?.includes('Loading chunk') ||
        event.reason?.message?.includes('ChunkLoadError') ||
        event.reason?.toString().includes('Failed to fetch');

    if (isModuleError) {
        // Create a custom error event that our ErrorBoundary can catch
        const moduleError = new Error(`Module loading failed: ${event.reason.message || event.reason}`);
        moduleError.isModuleError = true;

        // Trigger error boundary by throwing in a setTimeout
        setTimeout(() => {
            throw moduleError;
        }, 0);

        // Prevent the default unhandled rejection handling
        event.preventDefault();
    }
});

// Handle general JavaScript errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);

    // Check if it's a module loading error from script tags
    const isModuleError = event.error?.message?.includes('loading dynamically imported module') ||
        event.filename?.includes('assets/') ||
        event.message?.includes('Script error');

    if (isModuleError) {
        // Let this be handled by our error boundary
        const moduleError = new Error(`Script loading failed: ${event.message}`);
        moduleError.isModuleError = true;

        // Don't prevent default here, let it bubble up to error boundary
    }
});

// Export a function to manually trigger error boundary for module errors
export const triggerModuleError = (error) => {
    const moduleError = new Error(`Module error: ${error.message || error}`);
    moduleError.isModuleError = true;
    throw moduleError;
};

// Export function to check if we should show offline message
export const isNetworkError = (error) => {
    return error?.message?.includes('fetch') ||
        error?.message?.includes('network') ||
        error?.message?.includes('Failed to load') ||
        navigator.onLine === false;
};
