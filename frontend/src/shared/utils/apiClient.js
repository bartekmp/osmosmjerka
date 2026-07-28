import axios from 'axios';
import { STORAGE_KEYS } from '../constants/constants';

/**
 * Shared axios instance that attaches the stored auth token to every request.
 *
 * Before this existed, ~60 call sites across ~30 files each read the token out of
 * localStorage and hand-built an `Authorization: Bearer ...` header, and the codebase
 * used axios and raw fetch() in roughly equal measure. Use this instead: it keeps the
 * header in one place and gives every caller the same axios response shape.
 *
 * Requests still go out when no token is stored - the header is simply omitted, which
 * is what endpoints with optional auth (e.g. /api/phrases, /api/categories) expect.
 * An explicit Authorization header passed by the caller always wins.
 */

export const getAuthToken = () => {
    try {
        return localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    } catch {
        // Storage can throw in private-browsing / disabled-cookie modes.
        return null;
    }
};

const apiClient = axios.create();

apiClient.interceptors.request.use((config) => {
    const token = getAuthToken();
    // axios v1 hands interceptors an AxiosHeaders instance; assigning the property is
    // supported and avoids clobbering the other headers a spread would drop.
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;
