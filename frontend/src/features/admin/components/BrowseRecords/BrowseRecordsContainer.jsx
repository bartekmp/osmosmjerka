import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminApi } from '../AdminPanel/useAdminApi';
import BrowseRecordsView from './BrowseRecordsView';
import { STORAGE_KEYS } from '../../../../shared/constants/constants';

export default function BrowseRecordsContainer({
    token,
    currentUser,
    selectedLanguageSetId,
    languageSets,
    setSelectedLanguageSetId,
    categories,
    userIgnoredCategories,
    ignoredCategories,
    onUpdateUserIgnoredCategories,
    setDashboard,
    setToken,
    setIsLogged,
    isControlBarCollapsed,
    isLayoutCompact
}) {
    const { t } = useTranslation();

    // Data State
    const [rows, setRows] = useState([]);
    const [totalRows, setTotalRows] = useState(0);
    const [offset, setOffset] = useState(0);
    const [limit, setLimit] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_PAGE_SIZE);
        return saved ? parseInt(saved) : 20;
    });
    const [error, setError] = useState("");
    const [offsetInput, setOffsetInput] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    // Row Editing State
    const [newRow, setNewRow] = useState(null);
    const [isSavingNewRow, setIsSavingNewRow] = useState(false);

    // Batch Operations State
    const [batchMode, setBatchMode] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [batchDialog, setBatchDialog] = useState({ open: false, operation: null });
    const [batchResult, setBatchResult] = useState({ open: false, operation: null, result: null });
    const [batchLoading, setBatchLoading] = useState(false);

    // Notifications
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

    // API Hook
    const {
        fetchRows,
        handleSave,
        handleExportTxt,
        clearDb,
        handleDelete: deleteRowApi,
        handleBatchDelete,
        handleBatchAddCategory,
        handleBatchRemoveCategory,
        invalidateCategoriesCache,
        isFetchingRows,
    } = useAdminApi({
        token,
        setRows,
        setTotalRows,
        setDashboard,
        setError,
        setToken,
        setIsLogged
    });

    // Initial Fetch & Updates
    useEffect(() => {
        if (selectedLanguageSetId) {
            fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
        }
    }, [offset, limit, filterCategory, searchTerm, selectedLanguageSetId, fetchRows]);

    // Search Handler
    const handleSearchChange = useCallback((value) => {
        setSearchTerm(value);
        setOffset(0);
    }, []);

    // Pagination Handlers
    const handleOffsetInput = (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        if (val > Math.max(totalRows - limit, 0)) val = Math.max(totalRows - limit, 0);
        setOffsetInput(val);
    };

    const goToOffset = () => {
        const val = parseInt(offsetInput, 10);
        if (!isNaN(val) && val >= 0 && val <= Math.max(totalRows - limit, 0)) {
            setOffset(val);
        }
    };

    // Row Operations
    const handleStartAddRow = useCallback(() => {
        if (!selectedLanguageSetId || newRow) return;
        setNewRow({ categories: '', phrase: '', translation: '' });
        setError('');
    }, [selectedLanguageSetId, newRow]);

    const handleNewRowFieldChange = useCallback((field, value) => {
        setNewRow(prev => (prev ? { ...prev, [field]: value } : prev));
    }, []);

    const handleCancelNewRow = useCallback(() => {
        setNewRow(null);
    }, []);



    const handleConfirmNewRow = useCallback(async () => {
        if (!newRow || !selectedLanguageSetId) return;

        const payload = {
            categories: newRow.categories?.trim() || '',
            phrase: newRow.phrase?.trim() || '',
            translation: newRow.translation?.trim() || ''
        };

        if (!payload.categories || !payload.phrase || !payload.translation) return;

        const refreshRows = () => fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);

        try {
            setIsSavingNewRow(true);
            setError('');
            await handleSave(payload, refreshRows, () => {
                setNewRow(null);
                invalidateCategoriesCache();
                setNotification({
                    open: true,
                    message: t('row_added_successfully', 'Row added successfully'),
                    severity: 'success'
                });
            }, selectedLanguageSetId);
        } catch (err) {
            setError(err.message);
            setNotification({
                open: true,
                message: err.message,
                severity: 'error'
            });
        } finally {
            setIsSavingNewRow(false);
        }
    }, [newRow, selectedLanguageSetId, fetchRows, offset, limit, filterCategory, searchTerm, handleSave, invalidateCategoriesCache, t]);

    const handleInlineSave = useCallback((updatedRow) => {
        // Optimistically update
        setRows(prevRows => prevRows.map(row => row.id === updatedRow.id ? { ...row, ...updatedRow } : row));

        // Let handleSave manage the API call
        handleSave(updatedRow, null, null, selectedLanguageSetId).catch(err => {
            console.error('Save failed:', err);
            fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
        });
    }, [offset, limit, filterCategory, searchTerm, selectedLanguageSetId, fetchRows, handleSave]);

    const handleInlineDelete = useCallback((id) => {
        if (window.confirm(t('confirm_delete_phrase'))) {
            setRows(prevRows => prevRows.filter(row => row.id !== id));
            setTotalRows(prev => prev - 1);

            deleteRowApi(id, () => {
                fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
            }, selectedLanguageSetId);
        }
    }, [deleteRowApi, offset, limit, filterCategory, searchTerm, selectedLanguageSetId, fetchRows, t]);

    // Batch Operations
    const handleBatchModeToggle = () => {
        if (batchMode) {
            setBatchMode(false);
            setSelectedRows([]);
        } else {
            setBatchMode(true);
            setSelectedRows([]);
        }
    };

    const handleRowSelectionChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    const handleBatchConfirm = async (categoryName = '') => {
        setBatchLoading(true);
        setBatchDialog({ open: false, operation: null });

        let result;
        const operation = batchDialog.operation;

        try {
            switch (operation) {
                case 'delete':
                    result = await handleBatchDelete(selectedRows, selectedLanguageSetId);
                    break;
                case 'add_category':
                    result = await handleBatchAddCategory(selectedRows, categoryName, selectedLanguageSetId);
                    break;
                case 'remove_category':
                    result = await handleBatchRemoveCategory(selectedRows, categoryName, selectedLanguageSetId);
                    break;
                default:
                    throw new Error('Unknown batch operation');
            }

            setBatchResult({ open: true, operation, result });

            if (result.success) {
                setSelectedRows([]);
                if (selectedLanguageSetId) {
                    fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
                }
            }
        } catch (error) {
            setBatchResult({
                open: true,
                operation,
                result: { success: false, error: error.message }
            });
        } finally {
            setBatchLoading(false);
        }
    };

    // Ignored Categories
    const [showIgnoredCategories, setShowIgnoredCategories] = useState(false);

    const toggleIgnoredCategory = async (category) => {
        if (!currentUser || !selectedLanguageSetId) return;

        try {
            const isCurrentlyIgnored = userIgnoredCategories.includes(category);
            const newIgnoredCategories = isCurrentlyIgnored
                ? userIgnoredCategories.filter(c => c !== category)
                : [...userIgnoredCategories, category];

            // Update backend
            const response = await fetch('/api/user/ignored-categories', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    language_set_id: selectedLanguageSetId,
                    categories: newIgnoredCategories
                })
            });

            if (!response.ok) {
                // Simple auth check - simplified from AdminPanel
                if (response.status === 401 || response.status === 400) {
                    setToken('');
                    setIsLogged(false);
                    setDashboard(true);
                    return;
                }
                const data = await response.json();
                setError(data.error || t('ignored_categories_updated_error'));
                return;
            }

            onUpdateUserIgnoredCategories(newIgnoredCategories);
            // Refresh data
            if (selectedLanguageSetId) {
                fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
            }
        } catch (err) {
            console.error('Failed to update ignored categories:', err);
            setError(t('ignored_categories_updated_error'));
        }
    };

    // Permission checks
    const role = currentUser?.role;
    const canManageAdvanced = ['root_admin', 'administrative'].includes(role);
    const canAddNewRow = true; // Simplified for now, logic was implicit in AdminTable

    return (
        <BrowseRecordsView
            rows={rows}
            totalRows={totalRows}
            loading={isFetchingRows}
            error={error}

            offset={offset}
            limit={limit}
            setOffset={setOffset}
            setLimit={setLimit}
            offsetInput={offsetInput}
            handleOffsetInput={handleOffsetInput}
            goToOffset={goToOffset}
            searchTerm={searchTerm}
            handleSearchChange={handleSearchChange}

            languageSets={languageSets}
            selectedLanguageSetId={selectedLanguageSetId}
            setSelectedLanguageSetId={setSelectedLanguageSetId}
            categories={categories}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}

            currentUser={currentUser}
            userIgnoredCategories={userIgnoredCategories}
            ignoredCategories={ignoredCategories}
            toggleIgnoredCategory={toggleIgnoredCategory} // Pass wrapper or direct function
            ignoredCategoriesCount={ignoredCategories.length + userIgnoredCategories.length}
            showIgnoredCategories={showIgnoredCategories} // Controlled by parent? Or local? Let's make it local or prop. AdminPanel has state.
            setShowIgnoredCategories={setShowIgnoredCategories}

            batchMode={batchMode}
            handleBatchModeToggle={handleBatchModeToggle}
            selectedRows={selectedRows}
            handleRowSelectionChange={handleRowSelectionChange}
            handleBatchDeleteClick={() => setBatchDialog({ open: true, operation: 'delete' })}
            handleBatchAddCategoryClick={() => setBatchDialog({ open: true, operation: 'add_category' })}
            handleBatchRemoveCategoryClick={() => setBatchDialog({ open: true, operation: 'remove_category' })}
            batchLoading={batchLoading}

            batchDialog={batchDialog}
            handleBatchDialogClose={() => setBatchDialog({ open: false, operation: null })}
            handleBatchConfirm={handleBatchConfirm}
            batchResult={batchResult}
            handleBatchResultClose={() => setBatchResult({ open: false, operation: null, result: null })}

            handleInlineSave={handleInlineSave}
            handleInlineDelete={handleInlineDelete}
            handleStartAddRow={handleStartAddRow}
            newRow={newRow}
            handleNewRowFieldChange={handleNewRowFieldChange}
            handleCancelNewRow={handleCancelNewRow}
            handleConfirmNewRow={handleConfirmNewRow}
            isSavingNewRow={isSavingNewRow}
            canAddNewRow={canAddNewRow}

            isControlBarCollapsed={isControlBarCollapsed}
            isLayoutCompact={isLayoutCompact}

            onReloadData={() => fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId)}
            onDownloadPhrases={() => handleExportTxt(filterCategory)}
            onClearDatabase={() => clearDb(() => fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId))}
            canManageAdvanced={canManageAdvanced}

            notification={notification}
            onNotificationClose={() => setNotification({ ...notification, open: false })}
        />
    );
}
