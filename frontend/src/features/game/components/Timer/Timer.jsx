import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import './Timer.css';

const Timer = ({ 
    isActive,
    onTimeUpdate,
    resetTrigger = 0,
    showTimer = true,
    currentElapsedTime = 0 
}) => {
    const [elapsedTime, setElapsedTime] = useState(currentElapsedTime);
    const intervalRef = useRef(null);
    const elapsedSecondsRef = useRef(currentElapsedTime);

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

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!showTimer) {
        return null;
    }

    return (
        <Box className="timer-container">
            <Typography
                variant="h6"
                className={`timer-display ${isActive ? 'active' : ''}`}
                sx={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: isActive ? 'primary.main' : 'text.secondary'
                }}
            >
                ⏱️ {formatTime(elapsedTime)}
            </Typography>
        </Box>
    );
};

export default Timer;
