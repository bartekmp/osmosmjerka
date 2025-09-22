import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';

const useCelebration = (allFound, setLogoFilter) => {
    const [showCelebration, setShowCelebration] = useState(false);
    const celebrationTriggeredRef = useRef(false);

    // Trigger celebration when game is won
    useEffect(() => {
        if (allFound && !celebrationTriggeredRef.current) {
            celebrationTriggeredRef.current = true;
            setShowCelebration(true);
            
            // Trigger confetti effect
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            
            // Additional confetti bursts
            setTimeout(() => {
                confetti({
                    particleCount: 50,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 }
                });
            }, 250);
            
            setTimeout(() => {
                confetti({
                    particleCount: 50,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 }
                });
            }, 400);
            
            // Hide celebration after 6 seconds
            setTimeout(() => {
                setShowCelebration(false);
            }, 6000);
        }
    }, [allFound]);

    // Color cycling effect during celebration
    useEffect(() => {
        if (!showCelebration) return;
        
        const timeouts = [];
        
        // Color filters array - copied to avoid dependency issues
        const colorFilters = [
            'hue-rotate(45deg) saturate(2)', // orange
            'hue-rotate(120deg) saturate(2)', // green  
            'hue-rotate(240deg) saturate(2)', // blue
            'hue-rotate(300deg) saturate(2)', // purple
            'hue-rotate(0deg) saturate(3)', // red
            'hue-rotate(60deg) saturate(2)', // yellow
            'hue-rotate(180deg) saturate(2)', // cyan
            'hue-rotate(320deg) saturate(2)', // magenta
            'hue-rotate(90deg) saturate(2.5)', // lime green
            'hue-rotate(210deg) saturate(2)', // deep blue
            'hue-rotate(270deg) saturate(2.5)', // violet
            'hue-rotate(30deg) saturate(2)', // golden orange
            'hue-rotate(150deg) saturate(2)', // teal
            'hue-rotate(330deg) saturate(2)', // pink
            'hue-rotate(15deg) saturate(3)', // bright orange-red
            'hue-rotate(75deg) saturate(2)', // yellow-green
            'hue-rotate(195deg) saturate(2)', // sky blue
            'hue-rotate(225deg) saturate(2)', // indigo
            'hue-rotate(285deg) saturate(2)', // orchid
            'hue-rotate(345deg) saturate(2)', // rose
        ];
        
        // Function to pick a random color filter
        const getRandomColor = () => {
            return colorFilters[Math.floor(Math.random() * colorFilters.length)];
        };
        
        // Schedule multiple color changes during the 6-second celebration
        const scheduleColorChanges = () => {
            let totalTime = 0;
            const celebrationDuration = 6000; // 6 seconds
            
            while (totalTime < celebrationDuration) {
                const delay = 300 + Math.random() * 500; // 300-800ms
                totalTime += delay;
                
                if (totalTime < celebrationDuration) {
                    const timeout = setTimeout(() => {
                        setLogoFilter(getRandomColor());
                    }, totalTime);
                    timeouts.push(timeout);
                }
            }
        };
        
        // Start the first color change immediately and schedule the rest
        setLogoFilter(getRandomColor());
        scheduleColorChanges();
        
        return () => {
            timeouts.forEach(timeout => clearTimeout(timeout));
        };
    }, [showCelebration, setLogoFilter]);

    const resetCelebration = () => {
        setShowCelebration(false);
        celebrationTriggeredRef.current = false;
    };

    return {
        showCelebration,
        setShowCelebration,
        celebrationTriggeredRef,
        resetCelebration
    };
};

export default useCelebration;
