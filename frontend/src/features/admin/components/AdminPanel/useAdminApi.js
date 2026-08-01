import apiClient from '@shared/utils/apiClient';
import logger from '@shared/utils/logger';
import axios from "axios";
import { useCallback } from "react";
import { API_ENDPOINTS } from '../../../../shared/constants/constants';
import { useDebouncedApiCall } from '../../../../hooks/useDebounce';

// Cache for categories to avoid frequent API calls
let categoriesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useAdminApi({ setRows, setTotalRows, setDashboard, setError, setToken, setIsLogged }) {
    // Helper function to handle authentication errors. Accepts anything carrying a
    // numeric `status`, so both a fetch Response and an axios error.response fit.
    const handleAuthError = useCallback((response) => {
        // Check if it's an authentication error (400 or 401)
        if (response?.status === 401 || response?.status === 400) {
            // Clear token and logout
            setToken('');
            localStorage.removeItem('adminToken');
            setIsLogged(false);
            setDashboard(true);
            return true;
        }
        return false;
    }, [setToken, setIsLogged, setDashboard]);

    // Create debounced API call for fetching rows
    const fetchRowsApiCall = useCallback(async (offset, limit, filterCategory, searchTerm, languageSetId) => {
        let url = `/admin/rows?offset=${offset}&limit=${limit}`;
        if (filterCategory) url += `&category=${encodeURIComponent(filterCategory)}`;
        if (searchTerm && searchTerm.trim()) url += `&search=${encodeURIComponent(searchTerm.trim())}`;
        if (languageSetId) url += `&language_set_id=${languageSetId}`;

        try {
            const response = await apiClient.get(url);
            return response.data;
        } catch (error) {
            if (handleAuthError(error.response)) {
                throw new Error("Session expired, please log in again.");
            }
            if (error.response?.status === 429) {
                throw new Error("Too many requests. Please wait before trying again.");
            }
            throw new Error("Unauthorized or server error");
        }
    }, [handleAuthError]);

    // Stable callbacks — memoized so useDebouncedApiCall doesn't recreate on every render
    const onFetchSuccess = useCallback((data) => {
        setRows(data.rows || data);
        setTotalRows(data.total || data.length || 0);
        setError("");
    }, [setRows, setTotalRows, setError]);

    const onFetchError = useCallback((err) => {
        setError(err.message);
    }, [setError]);

    const {
        call: debouncedFetchRows,
        isLoading: isFetchingRows,
        showRateLimit: showFetchRateLimit
    } = useDebouncedApiCall(fetchRowsApiCall, 750, {
        onSuccess: onFetchSuccess,
        onError: onFetchError,
    });

    const fetchRows = useCallback((offset, limit, filterCategory, searchTerm, languageSetId) => {
        debouncedFetchRows(offset, limit, filterCategory, searchTerm, languageSetId);
    }, [debouncedFetchRows]);

    const handleLogin = useCallback((auth, setError, setCurrentUser) => {
        // Deliberately the bare client: there is no token yet, and a stale one must not
        // be attached to the login request.
        axios.post('/admin/login', { username: auth.user, password: auth.pass })
            .then(res => res.data)
            .then(data => {
                if (data.access_token) {
                    setToken(data.access_token);
                    localStorage.setItem('adminToken', data.access_token);
                    setIsLogged(true);
                    setCurrentUser(data.user);
                    setError("");
                    window.dispatchEvent(new window.Event('admin-auth-changed'));
                } else {
                    setError(data.detail || "Login failed");
                    setIsLogged(false);
                }
            })
            .catch(err => {
                // Show what the server said, not "Request failed with status code 403":
                // an unconfirmed address (403) and a locked account (429) each need their
                // own explanation, and only the server knows which applies.
                const body = err.response?.data;
                setError(body?.detail || body?.error || err.message);
                setIsLogged(false);
            });
    }, [setToken, setIsLogged]);

    const handleSave = useCallback(async (row, refresh, onSuccess, languageSetId) => {
        const method = row.id ? 'PUT' : 'POST';
        const url = row.id
            ? `/admin/row/${row.id}?language_set_id=${languageSetId}`
            : `/admin/row?language_set_id=${languageSetId}`;

        let response;
        try {
            response = await apiClient.request({ url, method, data: row });
        } catch (error) {
            if (handleAuthError(error.response)) {
                throw new Error("Session expired, please log in again.");
            }
            const body = error.response?.data;
            throw new Error(body?.message || body?.detail || 'Failed to save row');
        }

        if (typeof refresh === 'function') {
            refresh();
        }

        if (typeof onSuccess === 'function') {
            onSuccess();
        }

        return response;
    }, [handleAuthError]);

    const handleExportTxt = useCallback((filterCategory) => {
        const params = new URLSearchParams();
        if (filterCategory) params.append('category', filterCategory);

        apiClient.get(`/admin/export?${params.toString()}`, {
            responseType: 'blob'
        }).then(res => {
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `export_${filterCategory || 'all'}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        }).catch(err => {
            if (err.response && (err.response.status === 401 || err.response.status === 400)) {
                handleAuthError({ status: err.response.status });
            }
        });
    }, [handleAuthError]);

    const clearDb = useCallback((fetchRows) => {
        if (!window.confirm("Are you sure you want to delete all data?")) return;
        apiClient.delete("/admin/clear").then(() => fetchRows());
    }, []);

    const handleDelete = useCallback((id, fetchRows, languageSetId) => {
        apiClient.delete(`/admin/row/${id}?language_set_id=${languageSetId}`).then(() => {
            fetchRows();
        }).catch(err => {
            logger.error('Error deleting row:', err);
        });
    }, []);

    const fetchCategories = useCallback(async () => {
        // Check if we have valid cached data
        const now = Date.now();
        if (categoriesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
            return categoriesCache;
        }

        try {
            // Bare axios on purpose: this is the admin category picker, which wants the
            // full unfiltered list rather than one narrowed by the caller's ignored
            // categories, and staying anonymous keeps it on the shared cache entry.
            const response = await axios.get(API_ENDPOINTS.CATEGORIES);
            categoriesCache = response.data;
            cacheTimestamp = now;
            return categoriesCache;
        } catch (error) {
            logger.error('Error fetching categories:', error);
            // Return empty array on error, but don't cache it
            return [];
        }
    }, []);

    // Function to invalidate cache (call this when adding/updating words with new categories)
    const invalidateCategoriesCache = useCallback(() => {
        categoriesCache = null;
        cacheTimestamp = null;
    }, []);

    const handleBatchDelete = useCallback(async (rowIds, languageSetId) => {
        try {
            let data;
            try {
                const response = await apiClient.post(
                    `${API_ENDPOINTS.ADMIN_BATCH_DELETE}?language_set_id=${languageSetId}`,
                    { row_ids: rowIds }
                );
                data = response.data;
            } catch (error) {
                if (handleAuthError(error.response)) {
                    throw new Error("Session expired, please log in again.");
                }
                const body = error.response?.data;
                throw new Error(body?.error || body?.detail || 'Failed to delete records');
            }

            return {
                success: true,
                affected: data.deleted_count || rowIds.length,
                count: rowIds.length,
                message: data.message
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }, [handleAuthError]);

    const handleBatchAddCategory = useCallback(async (rowIds, category, languageSetId) => {
        try {
            let data;
            try {
                const response = await apiClient.post(
                    `${API_ENDPOINTS.ADMIN_BATCH_ADD_CATEGORY}?language_set_id=${languageSetId}`,
                    {
                    row_ids: rowIds,
                    category: category.trim()
                }
                );
                data = response.data;
            } catch (error) {
                if (handleAuthError(error.response)) {
                    throw new Error("Session expired, please log in again.");
                }
                const body = error.response?.data;
                throw new Error(body?.error || body?.detail || 'Failed to add category');
            }

            return {
                success: true,
                affected: data.affected_count || 0,
                count: rowIds.length,
                category: category.trim(),
                message: data.message
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }, [handleAuthError]);

    const handleBatchRemoveCategory = useCallback(async (rowIds, category, languageSetId) => {
        try {
            let data;
            try {
                const response = await apiClient.post(
                    `${API_ENDPOINTS.ADMIN_BATCH_REMOVE_CATEGORY}?language_set_id=${languageSetId}`,
                    {
                    row_ids: rowIds,
                    category: category.trim()
                }
                );
                data = response.data;
            } catch (error) {
                if (handleAuthError(error.response)) {
                    throw new Error("Session expired, please log in again.");
                }
                const body = error.response?.data;
                throw new Error(body?.error || body?.detail || 'Failed to remove category');
            }

            return {
                success: true,
                affected: data.affected_count || 0,
                count: rowIds.length,
                category: category.trim(),
                message: data.message
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }, [handleAuthError]);

    const getWithAuth = useCallback(async (url) => {
        try {
            const response = await apiClient.get(url);
            return response.data;
        } catch (error) {
            if (handleAuthError(error.response)) {
                throw new Error("Session expired, please log in again.");
            }
            throw new Error(`HTTP error! status: ${error.response?.status}`);
        }
    }, [handleAuthError]);

    return {
        fetchRows,
        handleLogin,
        handleSave,
        handleExportTxt,
        clearDb,
        handleDelete,
        fetchCategories,
        invalidateCategoriesCache,
        handleBatchDelete,
        handleBatchAddCategory,
        handleBatchRemoveCategory,
        getWithAuth,
        isFetchingRows,
        showFetchRateLimit
    };
}