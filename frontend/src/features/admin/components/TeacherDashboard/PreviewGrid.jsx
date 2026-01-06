import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Box, Tooltip } from '@mui/material';

// Distinct colors for highlighting phrases
const PHRASE_COLORS_LIGHT = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#2ECC71', '#E74C3C', '#3498DB', '#9B59B6',
    '#1ABC9C', '#E67E22', '#7F8C8D', '#16A085', '#C0392B',
];

// Darker/more muted colors for dark mode
const PHRASE_COLORS_DARK = [
    '#8B3A3A', '#2E7D7B', '#2B6E82', '#5A7D6B', '#8B8A4E',
    '#7D5A7D', '#5A8B7D', '#8B7D3E', '#6B4F7D', '#4A6E8B',
    '#8B6500', '#1B7340', '#8B2A2A', '#1F5A8B', '#5A3570',
    '#0F6B5A', '#8B4F1F', '#4A5252', '#0E5A4A', '#6B1F1F',
];

function generateStripeGradient(colors) {
    if (colors.length === 1) return colors[0];
    const stripeWidth = 100 / colors.length;
    const stops = colors.flatMap((color, i) => [
        `${color} ${i * stripeWidth}%`,
        `${color} ${(i + 1) * stripeWidth}%`,
    ]);
    return `repeating-linear-gradient(45deg, ${stops.join(', ')})`;
}

/**
 * PreviewGrid - Auto-stretches to fill container
 */
const PreviewGrid = forwardRef(function PreviewGrid({
    grid,
    phrases,
    isDarkMode = false,
    containerWidth = 500,
    containerHeight = 500,
}, ref) {
    const [blinkingPhraseIndex, setBlinkingPhraseIndex] = useState(null);

    useImperativeHandle(ref, () => ({
        blinkPhrase: (phraseIndex) => {
            setBlinkingPhraseIndex(phraseIndex);
            setTimeout(() => setBlinkingPhraseIndex(null), 1500);
        }
    }), []);

    if (!grid || grid.length === 0) {
        return <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>No grid available</Box>;
    }

    const gridSize = grid.length;
    const gap = 2;
    const padding = 8;

    // Calculate cell size to fill container proportionally
    const availableSize = Math.min(containerWidth, containerHeight) - padding * 2;
    const cellSize = Math.max(20, Math.floor((availableSize - gap * (gridSize - 1)) / gridSize));

    const colors = isDarkMode ? PHRASE_COLORS_DARK : PHRASE_COLORS_LIGHT;

    // Build cell -> phrase indices map
    const cellPhraseMap = {};
    phrases.forEach((phrase, idx) => {
        phrase.coords?.forEach(([r, c]) => {
            const key = `${r}-${c}`;
            if (!cellPhraseMap[key]) cellPhraseMap[key] = [];
            cellPhraseMap[key].push(idx);
        });
    });

    const getCellStyle = (r, c) => {
        const indices = cellPhraseMap[`${r}-${c}`] || [];
        if (indices.length === 0) return { background: isDarkMode ? '#2d2d2d' : '#f5f5f5' };
        const cellColors = indices.map(i => colors[i % colors.length]);
        if (cellColors.length === 1) return { background: cellColors[0] };
        return {
            background: generateStripeGradient(cellColors),
            backgroundSize: `${cellColors.length * 8}px ${cellColors.length * 8}px`,
        };
    };

    const isCellBlinking = (r, c) => {
        if (blinkingPhraseIndex === null) return false;
        return phrases[blinkingPhraseIndex]?.coords?.some(([pr, pc]) => pr === r && pc === c);
    };

    const getCellTooltip = (r, c) => {
        const indices = cellPhraseMap[`${r}-${c}`] || [];
        return indices.length > 0 ? indices.map(i => phrases[i]?.phrase).filter(Boolean).join(', ') : null;
    };

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
                gap: `${gap}px`,
                padding: `${padding}px`,
                backgroundColor: isDarkMode ? '#1a1a1a' : '#e0e0e0',
                borderRadius: 1,
            }}
        >
            {grid.flat().map((cell, index) => {
                const r = Math.floor(index / gridSize);
                const c = index % gridSize;
                const tooltip = getCellTooltip(r, c);
                const isBlinking = isCellBlinking(r, c);

                const cellContent = (
                    <Box
                        sx={{
                            width: cellSize,
                            height: cellSize,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: Math.max(10, cellSize * 0.45),
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            color: isDarkMode ? '#fff' : '#000',
                            borderRadius: '3px',
                            userSelect: 'none',
                            transition: 'transform 0.1s',
                            '&:hover': { transform: 'scale(1.05)', zIndex: 1, boxShadow: 2 },
                            ...(isBlinking && {
                                animation: 'pulse 0.3s ease-in-out infinite alternate',
                                boxShadow: isDarkMode ? '0 0 12px 4px rgba(255,255,255,0.6)' : '0 0 12px 4px rgba(0,0,0,0.4)',
                                zIndex: 2,
                            }),
                            '@keyframes pulse': { '0%': { transform: 'scale(1)' }, '100%': { transform: 'scale(1.15)' } },
                            ...getCellStyle(r, c),
                        }}
                    >
                        {cell}
                    </Box>
                );

                return tooltip ? (
                    <Tooltip key={`${r}-${c}`} title={tooltip} arrow>{cellContent}</Tooltip>
                ) : (
                    <Box key={`${r}-${c}`}>{cellContent}</Box>
                );
            })}
        </Box>
    );
});

export default PreviewGrid;
export { PHRASE_COLORS_LIGHT, PHRASE_COLORS_DARK };
