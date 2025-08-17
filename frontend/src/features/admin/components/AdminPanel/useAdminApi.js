import axios from "axios";
import { useCallback } from "react";
import { API_ENDPOINTS } from '../../../../shared/constants/constants';
import { useDebouncedApiCall } from '../../../../hooks/useDebounce';

// Cache for categories to avoid frequent API calls
let categoriesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useAdminApi({ token, setRows, setTotalRows, setDashboard, setError, setToken, setIsLogged }) {
    const authHeader = token
        ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
        : {};

    // Create debounced API call for fetching rows
    const fetchRowsApiCall = useCallback(async (offset, limit, filterCategory, searchTerm, languageSetId) => {
        let url = `/admin/rows?offset=${offset}&limit=${limit}`;
        if (filterCategory) url += `&category=${encodeURIComponent(filterCategory)}`;
        if (searchTerm && searchTerm.trim()) url += `&search=${encodeURIComponent(searchTerm.trim())}`;
        if (languageSetId) url += `&language_set_id=${languageSetId}`;
        
        const response = await fetch(url, { headers: authHeader });
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error("Too many requests. Please wait before trying again.");
            }
            throw new Error("Unauthorized or server error");
        }
        return response.json();
    }, [authHeader]);

    const { 
        call: debouncedFetchRows, 
        isLoading: isFetchingRows, 
        showRateLimit: showFetchRateLimit 
    } = useDebouncedApiCall(fetchRowsApiCall, 750, {
        onSuccess: (data) => {
            setRows(data.rows || data);
            setTotalRows(data.total || data.length || 0);
            setDashboard(false);
            setError("");
        },
        onError: (err) => {
            setError(err.message);
        }
    });

    const fetchRows = useCallback((offset, limit, filterCategory, searchTerm, languageSetId) => {
        debouncedFetchRows(offset, limit, filterCategory, searchTerm, languageSetId);
    }, [debouncedFetchRows]);

    const handleLogin = useCallback((auth, setError, setCurrentUser) => {
        fetch(`/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: auth.user, password: auth.pass })
        })
            .then(res => res.json())
            .then(data => {
                if (data.access_token) {
                    setToken(data.access_token);
                    localStorage.setItem('adminToken', data.access_token);
                    setIsLogged(true);
                    setCurrentUser(data.user);
                    setError("");
                } else {
                    setError(data.detail || "Login failed");
                    setIsLogged(false);
                }
            })
            .catch(err => {
                setError(err.message);
                setIsLogged(false);
            });
    }, [setToken, setIsLogged]);

    const handleSave = useCallback((editRow, fetchRows, setEditRow, languageSetId) => {
        const method = editRow.id ? 'PUT' : 'POST';
        const url = editRow.id 
            ? `/admin/row/${editRow.id}?language_set_id=${languageSetId}` 
            : `/admin/row?language_set_id=${languageSetId}`;
        fetch(url, {
            method,
            headers: authHeader,
            body: JSON.stringify(editRow)
        }).then(() => {
            fetchRows();
            if (editRow.id) {
                setEditRow(null);
            } else {
                setEditRow({ categories: '', phrase: '', translation: '' });
            }
        });
    }, [authHeader]);

    const handleExportTxt = useCallback((filterCategory) => {
        const params = new URLSearchParams();
        if (filterCategory) params.append('category', filterCategory);

        axios.get(`/admin/export?${params.toString()}`, {
            headers: authHeader,
            responseType: 'blob'
        }).then(res => {
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `export_${filterCategory || 'all'}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    }, [authHeader]);

    const clearDb = useCallback((fetchRows) => {
        if (!window.confirm("Are you sure you want to delete all data?")) return;
        fetch("/admin/clear", { method: "DELETE", headers: authHeader })
            .then(() => fetchRows());
    }, [authHeader]);

    const handleDelete = useCallback((id, fetchRows, languageSetId) => {
        fetch(`/admin/row/${id}?language_set_id=${languageSetId}`, {
            method: 'DELETE',
            headers: authHeader
        }).then(() => {
            fetchRows();
        }).catch(err => {
            console.error('Error deleting row:', err);
        });
    }, [authHeader]);

    const fetchCategories = useCallback(async () => {
        // Check if we have valid cached data
        const now = Date.now();
        if (categoriesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
            return categoriesCache;
        }

        try {
            const response = await axios.get(API_ENDPOINTS.CATEGORIES);
            categoriesCache = response.data;
            cacheTimestamp = now;
            return categoriesCache;
        } catch (error) {
            console.error('Error fetching categories:', error);
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
            const response = await fetch(`${API_ENDPOINTS.ADMIN_BATCH_DELETE}?language_set_id=${languageSetId}`, {
                method: 'POST',
                headers: authHeader,
                body: JSON.stringify({ row_ids: rowIds })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.detail || 'Failed to delete records');
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
    }, [authHeader]);

    const handleBatchAddCategory = useCallback(async (rowIds, category, languageSetId) => {
        try {
            const response = await fetch(`${API_ENDPOINTS.ADMIN_BATCH_ADD_CATEGORY}?language_set_id=${languageSetId}`, {
                method: 'POST',
                headers: authHeader,
                body: JSON.stringify({ 
                    row_ids: rowIds,
                    category: category.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.detail || 'Failed to add category');
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
    }, [authHeader]);

    const handleBatchRemoveCategory = useCallback(async (rowIds, category, languageSetId) => {
        try {
            const response = await fetch(`${API_ENDPOINTS.ADMIN_BATCH_REMOVE_CATEGORY}?language_set_id=${languageSetId}`, {
                method: 'POST',
                headers: authHeader,
                body: JSON.stringify({ 
                    row_ids: rowIds,
                    category: category.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.detail || 'Failed to remove category');
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
    }, [authHeader]);

    const getWithAuth = useCallback(async (url) => {
        const response = await fetch(url, { headers: authHeader });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }, [authHeader]);

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