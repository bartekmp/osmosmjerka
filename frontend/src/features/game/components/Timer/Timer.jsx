import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import './Timer.css';

const RESUME_BLINK_DURATION_MS = 1200;

const Timer = ({ 
    isActive,
    onTimeUpdate,
    resetTrigger = 0,
    showTimer = true,
    currentElapsedTime = 0,
    isPaused = false,
    onTogglePause,
    canPause = false
}) => {
    const [elapsedTime, setElapsedTime] = useState(currentElapsedTime);
    const intervalRef = useRef(null);
    const elapsedSecondsRef = useRef(currentElapsedTime);
    const [resumeBlinkActive, setResumeBlinkActive] = useState(false);
    const previousPausedRef = useRef(isPaused);
    const resumeBlinkTimeoutRef = useRef(null);
    const resumeBlinkRafRef = useRef(null);

    // Update timer when currentElapsedTime changes (from App state)
    useEffect(() => {
        elapsedSecondsRef.current = currentElapsedTime;
        setElapsedTime(currentElapsedTime);
    }, [currentElapsedTime]);

    // Effect to handle timer start/stop/pause/resume
    useEffect(() => {
        if (isActive && showTimer) {
            // Start or resume timer
            intervalRef.current = setInterval(() => {
                elapsedSecondsRef.current += 1;
                setElapsedTime(elapsedSecondsRef.current);
                
                if (onTimeUpdate) {
                    onTimeUpdate(elapsedSecondsRef.current);
                }
            }, 1000);
        } else {
            // Pause timer (don't reset, just stop)
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isActive, showTimer, onTimeUpdate]);

    // Effect to handle timer reset
    useEffect(() => {
        if (resetTrigger > 0) {
            setElapsedTime(0);
            elapsedSecondsRef.current = 0;
        }
    }, [resetTrigger]);

    useEffect(() => {
        const wasPaused = previousPausedRef.current;
        const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame
            : (callback) => setTimeout(callback, 0);
        const cancelRaf = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
            ? window.cancelAnimationFrame
            : (id) => clearTimeout(id);

        if (wasPaused && !isPaused) {
            if (resumeBlinkTimeoutRef.current) {
                clearTimeout(resumeBlinkTimeoutRef.current);
                resumeBlinkTimeoutRef.current = null;
            }
            if (resumeBlinkRafRef.current) {
                cancelRaf(resumeBlinkRafRef.current);
                resumeBlinkRafRef.current = null;
            }

            setResumeBlinkActive(false);
            resumeBlinkRafRef.current = raf(() => {
                resumeBlinkRafRef.current = null;
                setResumeBlinkActive(true);
                resumeBlinkTimeoutRef.current = setTimeout(() => {
                    setResumeBlinkActive(false);
                    resumeBlinkTimeoutRef.current = null;
                }, RESUME_BLINK_DURATION_MS);
            });
        } else if (!wasPaused && isPaused) {
            if (resumeBlinkTimeoutRef.current) {
                clearTimeout(resumeBlinkTimeoutRef.current);
                resumeBlinkTimeoutRef.current = null;
            }
            if (resumeBlinkRafRef.current) {
                cancelRaf(resumeBlinkRafRef.current);
                resumeBlinkRafRef.current = null;
            }
            setResumeBlinkActive(false);
        }

        previousPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => () => {
        if (resumeBlinkTimeoutRef.current) {
            clearTimeout(resumeBlinkTimeoutRef.current);
            resumeBlinkTimeoutRef.current = null;
        }
        if (resumeBlinkRafRef.current) {
            const cancelRaf = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
                ? window.cancelAnimationFrame
                : (id) => clearTimeout(id);
            cancelRaf(resumeBlinkRafRef.current);
            resumeBlinkRafRef.current = null;
        }
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!showTimer) {
        return null;
    }

    const handleClick = () => {
        if (!canPause || typeof onTogglePause !== 'function') {
            return;
        }
        onTogglePause();
    };

    const timerColor = resumeBlinkActive
        ? '#FFD700'
        : (isPaused ? 'warning.main' : (isActive ? 'primary.main' : 'text.secondary'));

    return (
        <Box className="timer-container">
            <Typography
                variant="h6"
                className={`timer-display ${isActive ? 'active' : ''} ${isPaused ? 'paused' : ''} ${resumeBlinkActive ? 'resume-blink' : ''}`}
                sx={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: timerColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: canPause ? 'pointer' : 'default',
                    userSelect: 'none'
                }}
                role={canPause ? 'button' : undefined}
                aria-pressed={isPaused || undefined}
                aria-disabled={!canPause}
                tabIndex={canPause ? 0 : -1}
                onClick={handleClick}
                onKeyDown={(event) => {
                    if (!canPause) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleClick();
                    }
                }}
            >
                {isPaused ? '⏸️' : '⏱️'} {formatTime(elapsedTime)}
            </Typography>
        </Box>
    );
};

export default Timer;
