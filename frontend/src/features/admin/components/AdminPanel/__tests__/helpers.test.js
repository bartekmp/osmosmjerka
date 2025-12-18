import { isTokenExpired } from '../helpers';
import { jwtDecode } from 'jwt-decode';

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
    jwtDecode: jest.fn()
}));

describe('isTokenExpired', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock Date.now to return a fixed timestamp
        jest.spyOn(Date, 'now').mockReturnValue(1000000000000); // Fixed timestamp
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should return true for expired token', () => {
        // Token expired 1 hour ago
        const expiredExp = Math.floor((Date.now() - 3600000) / 1000);
        jwtDecode.mockReturnValue({ exp: expiredExp });

        expect(isTokenExpired('expired-token')).toBe(true);
        expect(jwtDecode).toHaveBeenCalledWith('expired-token');
    });

    test('should return false for valid token', () => {
        // Token expires in 1 hour
        const validExp = Math.floor((Date.now() + 3600000) / 1000);
        jwtDecode.mockReturnValue({ exp: validExp });

        expect(isTokenExpired('valid-token')).toBe(false);
        expect(jwtDecode).toHaveBeenCalledWith('valid-token');
    });

    test('should return true for token without exp claim', () => {
        jwtDecode.mockReturnValue({});

        expect(isTokenExpired('token-without-exp')).toBe(true);
    });

    test('should return true for token with null exp', () => {
        jwtDecode.mockReturnValue({ exp: null });

        expect(isTokenExpired('token-with-null-exp')).toBe(true);
    });

    test('should return true when jwtDecode throws an error', () => {
        jwtDecode.mockImplementation(() => {
            throw new Error('Invalid token');
        });

        expect(isTokenExpired('invalid-token')).toBe(true);
    });

    test('should return true for token expiring exactly now', () => {
        // Token expires exactly at current time
        const currentExp = Math.floor(Date.now() / 1000);
        jwtDecode.mockReturnValue({ exp: currentExp });

        expect(isTokenExpired('token-expiring-now')).toBe(true);
    });

    test('should return false for token expiring in the future', () => {
        // Token expires in 1 second
        const futureExp = Math.floor((Date.now() + 1000) / 1000);
        jwtDecode.mockReturnValue({ exp: futureExp });

        expect(isTokenExpired('token-expiring-future')).toBe(false);
    });
});


