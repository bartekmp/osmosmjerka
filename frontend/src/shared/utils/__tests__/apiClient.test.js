import apiClient, { getAuthToken } from '../apiClient';
import { STORAGE_KEYS } from '../../constants/constants';

// Run the request interceptor the way axios would, without issuing a real request.
const runInterceptor = (config = { headers: {} }) => {
    const { fulfilled } = apiClient.interceptors.request.handlers[0];
    return fulfilled(config);
};

afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
});

test('attaches the stored token as a Bearer header', () => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok-123');
    const config = runInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer tok-123');
});

test('sends no Authorization header when no token is stored', () => {
    const config = runInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
});

test('does not overwrite an Authorization header set by the caller', () => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok-123');
    const config = runInterceptor({ headers: { Authorization: 'Bearer explicit' } });
    expect(config.headers.Authorization).toBe('Bearer explicit');
});

test('preserves other headers already on the request', () => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok-123');
    const config = runInterceptor({ headers: { 'Content-Type': 'application/json' } });
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers.Authorization).toBe('Bearer tok-123');
});

test('getAuthToken returns null instead of throwing when storage is unavailable', () => {
    // jsdom's localStorage.getItem isn't a plain spy-able method, so swap it directly.
    const original = localStorage.getItem;
    localStorage.getItem = () => {
        throw new Error('denied');
    };
    try {
        expect(getAuthToken()).toBeNull();
    } finally {
        localStorage.getItem = original;
    }
});
