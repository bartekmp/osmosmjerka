import { useState, useRef, useCallback } from 'react';

const useLogoColor = () => {
    const [logoFilter, setLogoFilter] = useState('none');

    const changeLogoColor = useCallback(() => {
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
        
        setLogoFilter(currentFilter => {
            let newFilter;
            do {
                newFilter = colorFilters[Math.floor(Math.random() * colorFilters.length)];
            } while (newFilter === currentFilter);
            return newFilter;
        });
    }, []);

    const handleLogoClick = () => {
        changeLogoColor();
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
    };

    return {
        logoFilter,
        setLogoFilter,
        changeLogoColor,
        handleLogoClick
    };
};

export default useLogoColor;
