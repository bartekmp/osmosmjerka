/**
 * Manual mock for the shared API client.
 *
 * Suites that call `jest.mock('axios')` auto-mock `axios.create()` to return undefined,
 * which blows up when the real apiClient module registers its interceptor at import
 * time. Those suites can add a bare `jest.mock('@shared/utils/apiClient')` and jest
 * will pick this up, no factory needed.
 *
 * Every verb resolves with an empty payload by default; override per test with
 * `apiClient.get.mockResolvedValue({ data: ... })`.
 */
const apiClient = {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    request: jest.fn(() => Promise.resolve({ data: {} })),
};

export const getAuthToken = () => {
    try {
        return globalThis.localStorage.getItem('adminToken');
    } catch {
        return null;
    }
};

export default apiClient;
