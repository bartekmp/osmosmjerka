import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';

const CONTROL_BAR_BREAKPOINTS = {
    compact: 1000,
    full: 1280
};

export const computeControlBarMode = (width) => {
    if (width <= CONTROL_BAR_BREAKPOINTS.compact) {
        return 'compact';
    }
    if (width <= CONTROL_BAR_BREAKPOINTS.full) {
        return 'short';
    }
    return 'full';
};

export const useAdminLayout = () => {
    const containerRef = useRef(null);
    const manualCollapseRef = useRef(false);

    const [autoControlMode, setAutoControlMode] = useState(() => {
        if (typeof window === 'undefined') {
            return 'full';
        }
        return computeControlBarMode(window.innerWidth);
    });

    const [isControlBarCollapsed, setIsControlBarCollapsed] = useState(autoControlMode === 'compact');

    const updateAutoControlMode = useCallback(() => {
        let width = containerRef.current?.getBoundingClientRect?.().width;
        if (typeof width !== 'number') {
            width = typeof window !== 'undefined' ? window.innerWidth : CONTROL_BAR_BREAKPOINTS.full;
        }

        setAutoControlMode((prev) => {
            const next = computeControlBarMode(width);
            return next === prev ? prev : next;
        });
    }, []);

    useLayoutEffect(() => {
        updateAutoControlMode();

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateAutoControlMode);
        }

        let observer;
        if (typeof window !== 'undefined' && window.ResizeObserver) {
            observer = new window.ResizeObserver(() => {
                updateAutoControlMode();
            });
            if (containerRef.current) {
                observer.observe(containerRef.current);
            }
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', updateAutoControlMode);
            }
            if (observer) {
                observer.disconnect();
            }
        };
    }, [updateAutoControlMode]);

    useEffect(() => {
        if (autoControlMode === 'compact') {
            manualCollapseRef.current = false;
            // Only collapse if not already collapsed, to avoid loops
            if (!isControlBarCollapsed) {
                setIsControlBarCollapsed(true);
            }
            return;
        }

        // If we switch out of compact mode, and user hasn't manually collapsed it, expand it
        if (!manualCollapseRef.current && isControlBarCollapsed) {
            setIsControlBarCollapsed(false);
        }
    }, [autoControlMode, isControlBarCollapsed]);

    const toggleControlBar = useCallback(() => {
        manualCollapseRef.current = !isControlBarCollapsed;
        setIsControlBarCollapsed(prev => !prev);
    }, [isControlBarCollapsed]);

    const isLayoutCompact = autoControlMode === 'compact';

    return {
        containerRef,
        isControlBarCollapsed,
        setIsControlBarCollapsed, // Exposed if manual control is needed from parent
        toggleControlBar,
        isLayoutCompact,
        autoControlMode
    };
};
