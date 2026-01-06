import React from 'react';
import {
    Box,
    Collapse,
    Stack,
    TextField,
    MenuItem,
    Typography,
    Chip,
    Tooltip,
    InputAdornment
} from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import CategoryIcon from '@mui/icons-material/Category';
import { useTranslation } from 'react-i18next';
import AdminTable from './AdminTable';
import BatchOperationDialog from './BatchOperationDialog';
import BatchOperationsToolbar from './BatchOperationsToolbar';
import BatchResultDialog from './BatchResultDialog';
import PageSizeSelector from './PageSizeSelector';
import PaginationControls from './PaginationControls';
import PropTypes from 'prop-types';
import { STORAGE_KEYS } from '@shared';

const BrowseRecordsView = ({
    rows,
    totalRows,
    loading,
    error,

    // Pagination & Search
    offset,
    limit,
    setOffset,
    setLimit,
    offsetInput,
    handleOffsetInput,
    goToOffset,
    searchTerm,
    handleSearchChange,

    // Filters
    languageSets,
    selectedLanguageSetId,
    setSelectedLanguageSetId,
    categories,
    filterCategory,
    setFilterCategory,

    // Ignored Categories
    currentUser,
    userIgnoredCategories,
    ignoredCategories,
    toggleIgnoredCategory,
    ignoredCategoriesCount,
    showIgnoredCategories,

    // Batch Actions
    batchMode,
    handleBatchModeToggle,
    selectedRows,
    handleRowSelectionChange,
    handleBatchDeleteClick,
    handleBatchAddCategoryClick,
    handleBatchRemoveCategoryClick,
    batchLoading,

    // Batch Dialogs
    batchDialog,
    handleBatchDialogClose,
    handleBatchConfirm,
    batchResult,
    handleBatchResultClose,

    // Row Actions
    handleInlineSave,
    handleInlineDelete,
    handleStartAddRow,
    newRow,
    handleNewRowFieldChange,
    handleCancelNewRow,
    handleConfirmNewRow,
    isSavingNewRow,
    canAddNewRow,

    // Layout
    isControlBarCollapsed,
    isLayoutCompact
}) => {
    const { t } = useTranslation();

    const handlePageSizeChange = (newLimit) => {
        setLimit(newLimit);
        setOffset(0);
        localStorage.setItem(STORAGE_KEYS.ADMIN_PAGE_SIZE, newLimit.toString());
    };

    return (
        <>
            {/* Filter Controls */}
            <Collapse in={!isControlBarCollapsed} timeout="auto">
                <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
                    <TextField
                        select
                        size="small"
                        fullWidth
                        label={t('filter_by_language_set')}
                        value={selectedLanguageSetId || ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            setSelectedLanguageSetId(value);
                            setFilterCategory('');
                            localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, value.toString());
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <TranslateIcon fontSize="small" />
                                </InputAdornment>
                            )
                        }}
                    >
                        {languageSets.map(set => (
                            <MenuItem key={set.id} value={set.id}>
                                {set.display_name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        size="small"
                        fullWidth
                        label={t('filter_by_category')}
                        value={filterCategory}
                        onChange={e => { setFilterCategory(e.target.value); setOffset(0); }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <CategoryIcon fontSize="small" />
                                </InputAdornment>
                            )
                        }}
                    >
                        <MenuItem value="">{`-- ${t('all_categories')} --`}</MenuItem>
                        {categories.map(cat => (
                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                        ))}
                    </TextField>
                </Stack>
            </Collapse>

            {(currentUser && selectedLanguageSetId) || ignoredCategoriesCount > 0 ? (
                <Collapse in={showIgnoredCategories} timeout="auto">
                    <Box sx={{ mt: 1 }}>
                        {currentUser && userIgnoredCategories.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    {t('your_ignored_categories', 'Your Ignored Categories')}
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                    {userIgnoredCategories.map(category => (
                                        <Tooltip key={category} title={t('click_to_remove_ignored', 'Click to remove from ignored categories')}>
                                            <Chip
                                                label={category}
                                                size="small"
                                                color="warning"
                                                variant="filled"
                                                onClick={() => toggleIgnoredCategory(category)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    textDecoration: 'line-through',
                                                    mb: 0.5
                                                }}
                                            />
                                        </Tooltip>
                                    ))}
                                </Stack>
                            </Box>
                        )}
                        {ignoredCategories.length > 0 && (
                            <Box>
                                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    {t('global_ignored_categories', 'Global Ignored Categories')}
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                    {ignoredCategories.map(category => (
                                        <Tooltip key={category} title={t('ignored_category_tooltip')}>
                                            <Chip
                                                label={category}
                                                size="small"
                                                color="default"
                                                variant="outlined"
                                                sx={{
                                                    opacity: 0.7,
                                                    textDecoration: 'line-through',
                                                    mb: 0.5
                                                }}
                                            />
                                        </Tooltip>
                                    ))}
                                </Stack>
                            </Box>
                        )}
                        {currentUser && ignoredCategories.length === 0 && userIgnoredCategories.length === 0 && categories.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                    {t('no_ignored_categories_yet', 'No categories are ignored yet. Click on categories below to ignore them.')}
                                </Typography>
                            </Box>
                        )}
                        {currentUser && categories.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    {t('available_categories', 'Available Categories')} ({t('click_to_ignore', 'click to ignore')})
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                    {categories
                                        .filter(cat => !userIgnoredCategories.includes(cat) && !ignoredCategories.includes(cat))
                                        .map(category => (
                                            <Tooltip key={category} title={t('click_to_add_ignored', 'Click to add to ignored categories')}>
                                                <Chip
                                                    label={category}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    onClick={() => toggleIgnoredCategory(category)}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        mb: 0.5
                                                    }}
                                                />
                                            </Tooltip>
                                        ))}
                                </Stack>
                            </Box>
                        )}
                    </Box>
                </Collapse>
            ) : null}

            {/* Batch Operations Toolbar */}
            {
                batchMode && (
                    <BatchOperationsToolbar
                        selectedCount={selectedRows.length}
                        onBatchDelete={handleBatchDeleteClick}
                        onBatchAddCategory={handleBatchAddCategoryClick}
                        onBatchRemoveCategory={handleBatchRemoveCategoryClick}
                        disabled={batchLoading || selectedRows.length === 0}
                    />
                )
            }
            {/* Data Table */}
            <AdminTable
                rows={rows}
                onSaveRow={handleInlineSave}
                onDeleteRow={handleInlineDelete}
                totalRows={totalRows}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                isLoading={loading}
                batchMode={batchMode}
                selectedRows={selectedRows}
                onRowSelectionChange={handleRowSelectionChange}
                onBatchModeToggle={handleBatchModeToggle}
                onAddNewRow={handleStartAddRow}
                newRow={newRow}
                onNewRowChange={handleNewRowFieldChange}
                onCancelNewRow={handleCancelNewRow}
                onConfirmNewRow={handleConfirmNewRow}
                isSavingNewRow={isSavingNewRow}
                canAddNewRow={canAddNewRow}
                categoryOptions={categories}
                compactMode={isLayoutCompact}
            />
            {/* Pagination */}
            <Box sx={{ mt: 3 }}>
                <PaginationControls
                    offset={offset}
                    limit={limit}
                    totalRows={totalRows}
                    offsetInput={offsetInput}
                    handleOffsetInput={handleOffsetInput}
                    goToOffset={goToOffset}
                    setOffset={setOffset}
                    pageSizeSelector={
                        <PageSizeSelector
                            value={limit}
                            onChange={handlePageSizeChange}
                        />
                    }
                />
            </Box>
            {/* Error Display */}
            {
                error && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                        <Typography color="error.contrastText">{error}</Typography>
                    </Box>
                )
            }

            {/* Batch Operation Dialogs */}
            <BatchOperationDialog
                open={batchDialog.open}
                onClose={handleBatchDialogClose}
                operation={batchDialog.operation}
                selectedCount={selectedRows.length}
                onConfirm={handleBatchConfirm}
                availableCategories={categories}
            />

            <BatchResultDialog
                open={batchResult.open}
                onClose={handleBatchResultClose}
                operation={batchResult.operation}
                result={batchResult.result}
            />
        </>
    );
};

BrowseRecordsView.propTypes = {
    rows: PropTypes.array.isRequired,
    totalRows: PropTypes.number.isRequired,
    loading: PropTypes.bool,
    error: PropTypes.string,

    // Pagination & Search
    offset: PropTypes.number.isRequired,
    limit: PropTypes.number.isRequired,
    setOffset: PropTypes.func.isRequired,
    setLimit: PropTypes.func.isRequired,
    offsetInput: PropTypes.any,
    handleOffsetInput: PropTypes.func.isRequired,
    goToOffset: PropTypes.func.isRequired,
    searchTerm: PropTypes.string,
    handleSearchChange: PropTypes.func.isRequired,

    // Filters
    languageSets: PropTypes.array.isRequired,
    selectedLanguageSetId: PropTypes.any,
    setSelectedLanguageSetId: PropTypes.func.isRequired,
    categories: PropTypes.array.isRequired,
    filterCategory: PropTypes.string,
    setFilterCategory: PropTypes.func.isRequired,

    // Ignored Categories
    currentUser: PropTypes.object,
    userIgnoredCategories: PropTypes.array,
    ignoredCategories: PropTypes.array,
    toggleIgnoredCategory: PropTypes.func,
    ignoredCategoriesCount: PropTypes.number,
    showIgnoredCategories: PropTypes.bool,

    // Batch Actions
    batchMode: PropTypes.bool.isRequired,
    handleBatchModeToggle: PropTypes.func.isRequired,
    selectedRows: PropTypes.array.isRequired,
    handleRowSelectionChange: PropTypes.func.isRequired,
    handleBatchDeleteClick: PropTypes.func.isRequired,
    handleBatchAddCategoryClick: PropTypes.func.isRequired,
    handleBatchRemoveCategoryClick: PropTypes.func.isRequired,
    batchLoading: PropTypes.bool,

    // Batch Dialogs
    batchDialog: PropTypes.object.isRequired,
    handleBatchDialogClose: PropTypes.func.isRequired,
    handleBatchConfirm: PropTypes.func.isRequired,
    batchResult: PropTypes.object.isRequired,
    handleBatchResultClose: PropTypes.func.isRequired,

    // Row Actions
    handleInlineSave: PropTypes.func.isRequired,
    handleInlineDelete: PropTypes.func.isRequired,
    handleStartAddRow: PropTypes.func.isRequired,
    newRow: PropTypes.object,
    handleNewRowFieldChange: PropTypes.func.isRequired,
    handleCancelNewRow: PropTypes.func.isRequired,
    handleConfirmNewRow: PropTypes.func.isRequired,
    isSavingNewRow: PropTypes.bool,
    canAddNewRow: PropTypes.bool,

    // Layout
    isControlBarCollapsed: PropTypes.bool,
    isLayoutCompact: PropTypes.bool
};

export default BrowseRecordsView;
