import { containsHTML, stripHTML } from '../validationUtils';

describe('validationUtils', () => {
    describe('containsHTML', () => {
        test('returns true for strings with HTML tags', () => {
            expect(containsHTML('<div>Test</div>')).toBe(true);
            expect(containsHTML('This has <span>HTML</span>')).toBe(true);
            expect(containsHTML('<img src="test.jpg">')).toBe(true);
            expect(containsHTML('Text with <br> tag')).toBe(true);
        });
        
        test('returns false for strings without HTML tags', () => {
            expect(containsHTML('Plain text')).toBe(false);
            expect(containsHTML('Text with "quotes"')).toBe(false);
            expect(containsHTML('Text with symbols: & > <')).toBe(false);
            expect(containsHTML('1 < 2 and 3 > 2')).toBe(false);
        });
        
        test('handles undefined and empty values', () => {
            expect(containsHTML()).toBe(false);
            expect(containsHTML(null)).toBe(false);
            expect(containsHTML('')).toBe(false);
        });
    });
    
    describe('stripHTML', () => {
        test('removes HTML tags from strings', () => {
            expect(stripHTML('<div>Test</div>')).toBe('Test');
            expect(stripHTML('This has <span>HTML</span>')).toBe('This has HTML');
            expect(stripHTML('<img src="test.jpg">')).toBe('');
            expect(stripHTML('Text with <br> tag')).toBe('Text with  tag');
        });
        
        test('leaves plain text unchanged', () => {
            expect(stripHTML('Plain text')).toBe('Plain text');
            expect(stripHTML('Text with "quotes"')).toBe('Text with "quotes"');
        });
        
        test('handles undefined and empty values', () => {
            expect(stripHTML()).toBe('');
            expect(stripHTML(null)).toBe('');
            expect(stripHTML('')).toBe('');
        });
    });
});
