import axios from "axios";
import { useCallback } from "react";

export function useAdminApi({ token, setRows, setTotalRows, setDashboard, setError, setToken, setIsLogged }) {
    const authHeader = token
        ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
        : {};

    const fetchRows = useCallback((offset, limit, filterCategory, searchTerm) => {
        let url = `/admin/rows?offset=${offset}&limit=${limit}`;
        if (filterCategory) url += `&category=${encodeURIComponent(filterCategory)}`;
        if (searchTerm && searchTerm.trim()) url += `&search=${encodeURIComponent(searchTerm.trim())}`;
        
        console.log('Fetching with URL:', url); // Debug log
        
        fetch(url, { headers: authHeader })
            .then(res => {
                if (!res.ok) throw new Error("Unauthorized or server error");
                return res.json();
            })
            .then(data => {
                setRows(data.rows || data);
                setTotalRows(data.total || data.length || 0);
                setDashboard(false);
                setError("");
            })
            .catch(err => {
                setError(err.message);
            });
    }, [authHeader, setRows, setTotalRows, setDashboard, setError]);

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

    const handleSave = useCallback((editRow, fetchRows, setEditRow) => {
        const method = editRow.id ? 'PUT' : 'POST';
        const url = editRow.id ? `/admin/row/${editRow.id}` : `/admin/row`;
        fetch(url, {
            method,
            headers: authHeader,
            body: JSON.stringify(editRow)
        }).then(() => {
            fetchRows();
            if (editRow.id) {
                setEditRow(null);
            } else {
                setEditRow({ categories: '', word: '', translation: '' });
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

    const handleDelete = useCallback((id, fetchRows) => {
        fetch(`/admin/row/${id}`, {
            method: 'DELETE',
            headers: authHeader
        }).then(() => {
            fetchRows();
        }).catch(err => {
            console.error('Error deleting row:', err);
        });
    }, [authHeader]);

    return { fetchRows, handleLogin, handleSave, handleExportTxt, clearDb, handleDelete };
}