import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    Box,
    TableContainer,
    Paper,
    Typography,
    Checkbox,
    Chip,
    Stack,
    TextField,
    Tooltip
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useTranslation } from 'react-i18next';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper
} from '@tanstack/react-table';
import { keyframes } from '@mui/system';
import { lighten } from '@mui/material/styles';
import { calculateMinColumnWidths } from './adminTableUtils';
import EditPhraseDialog from './EditPhraseDialog';
import TextViewDialog from './TextViewDialog';
import SearchBar from './SearchBar';
import TableRowActions from './TableRowActions';
import TableNoRowsOverlay from './TableNoRowsOverlay';
import { renderExpandableText } from './utils/renderHelpers';
import PropTypes from 'prop-types';

const newRowExpand = keyframes`
    0% {
        transform: scaleY(0.6);
        opacity: 0;
    }
    60% {
        transform: scaleY(1.02);
        opacity: 1;
    }
    100% {
        transform: scaleY(1);
        opacity: 1;
    }
`;

const cancelPop = keyframes`
    0% {
        transform: scale(1);
        opacity: 1;
    }
    35% {
        transform: scale(1.05);
    }
    100% {
        transform: scale(0.82);
        opacity: 0;
    }
`;

const confirmFade = keyframes`
    0% {
        transform: scale(1);
        opacity: 1;
    }
    28% {
        transform: scale(1.04);
        opacity: 1;
    }
    100% {
        transform: scale(0.86);
        opacity: 0;
    }
`;
const EXIT_FADE_DURATION = 220;

export default function AdminTable({
    rows,
    onSaveRow,
    onDeleteRow,
    totalRows,
    searchTerm,
    onSearchChange,
    isLoading = false,
    batchMode = false,
    selectedRows = [],
    onRowSelectionChange,
    onBatchModeToggle,
    onAddNewRow = () => {},
    newRow = null,
    onNewRowChange = () => {},
    onCancelNewRow = () => {},
    onConfirmNewRow = () => {},
    isSavingNewRow = false,
    canAddNewRow = true,
    categoryOptions = [],
    compactMode = false
}) {
    const { t } = useTranslation();
    const [editDialog, setEditDialog] = useState({ open: false, row: null });
    const [textDialog, setTextDialog] = useState({ open: false, title: '', content: '' });
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
    const [categoryInputValue, setCategoryInputValue] = useState('');
    const [newRowPhase, setNewRowPhase] = useState(newRow ? 'editing' : 'idle');
    const [shouldRenderNewRow, setShouldRenderNewRow] = useState(Boolean(newRow));
    const [newRowSnapshot, setNewRowSnapshot] = useState(newRow);
    const tableContainerRef = useRef(null);
    const exitAnimationTimeoutRef = useRef(null);

    const clearExitTimeout = useCallback(() => {
        if (exitAnimationTimeoutRef.current) {
            clearTimeout(exitAnimationTimeoutRef.current);
            exitAnimationTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!newRow) {
            return;
        }

        clearExitTimeout();
        setNewRowSnapshot(newRow);
        setShouldRenderNewRow(true);

        if (newRowPhase === 'idle') {
            setNewRowPhase('editing');
        }
    }, [newRow, newRowPhase, clearExitTimeout]);

    useEffect(() => {
        if (newRow) {
            return;
        }

        setCategoryInputValue('');

        if (!shouldRenderNewRow) {
            if (newRowPhase !== 'idle') {
                setNewRowPhase('idle');
            }
            setNewRowSnapshot(null);
            return;
        }

        if (newRowPhase === 'confirming' || newRowPhase === 'cancelling') {
            clearExitTimeout();
            exitAnimationTimeoutRef.current = setTimeout(() => {
                setShouldRenderNewRow(false);
                setNewRowPhase('idle');
                setNewRowSnapshot(null);
                exitAnimationTimeoutRef.current = null;
            }, EXIT_FADE_DURATION);
            return;
        }

        setShouldRenderNewRow(false);
        setNewRowPhase('idle');
        setNewRowSnapshot(null);
    }, [newRow, newRowPhase, shouldRenderNewRow, clearExitTimeout]);

    useEffect(() => () => {
        clearExitTimeout();
    }, [clearExitTimeout]);

    const normalizedCategoryOptions = useMemo(
        () => [...new Set((categoryOptions || []).filter(Boolean).map((cat) => cat.trim()))],
        [categoryOptions]
    );

    const displayedRow = newRow ?? newRowSnapshot ?? { categories: '', phrase: '', translation: '' };

    const newRowCategories = useMemo(() => {
        if (!displayedRow.categories) return [];
        return displayedRow.categories
            .split(/\s+/)
            .map((cat) => cat.trim())
            .filter(Boolean);
    }, [displayedRow.categories]);

    const commitCategory = useCallback(
        (rawCategory) => {
            if (!newRow) {
                return;
            }
            const normalized = (rawCategory || '').trim();
            if (!normalized) {
                return;
            }
            const current = newRowCategories;
            if (current.includes(normalized)) {
                return;
            }
            onNewRowChange('categories', [...current, normalized].join(' '));
        },
        [newRow, newRowCategories, onNewRowChange]
    );

    const isNewRowValid = Boolean(
        newRow?.categories?.trim() &&
        newRow?.phrase?.trim() &&
        newRow?.translation?.trim()
    );

    // Handle search term changes - delegated to SearchBar component
    const handleSearchChange = useCallback((value) => {
        setLocalSearchTerm(value);
        onSearchChange(value);
    }, [onSearchChange]);

    // Batch selection handlers
    const handleRowCheckboxChange = useCallback((rowId, checked) => {
        if (!onRowSelectionChange) return;
        
        const newSelectedRows = checked 
            ? [...selectedRows, rowId]
            : selectedRows.filter(id => id !== rowId);
        
        onRowSelectionChange(newSelectedRows);
    }, [selectedRows, onRowSelectionChange]);

    const handleSelectAll = useCallback((checked) => {
        if (!onRowSelectionChange) return;

        const newSelectedRows = checked ? rows.map(row => row.id) : [];
        onRowSelectionChange(newSelectedRows);
    }, [rows, onRowSelectionChange]);

    const handleConfirmClick = useCallback(() => {
        if (!newRow || !isNewRowValid || isSavingNewRow || newRowPhase !== 'editing') {
            return;
        }

        clearExitTimeout();
        setNewRowPhase('confirming');
        setNewRowSnapshot(newRow);
        onConfirmNewRow();
    }, [newRow, isNewRowValid, isSavingNewRow, newRowPhase, onConfirmNewRow, clearExitTimeout]);

    const handleCancelClick = useCallback(() => {
        if (!newRow || isSavingNewRow) {
            return;
        }

        clearExitTimeout();
        setNewRowPhase('cancelling');
        setNewRowSnapshot(newRow);
        onCancelNewRow();
    }, [newRow, isSavingNewRow, onCancelNewRow, clearExitTimeout]);

    const isAllSelected = useMemo(() => {
        return rows.length > 0 && selectedRows.length === rows.length;
    }, [rows.length, selectedRows.length]);

    const isIndeterminate = useMemo(() => {
        return selectedRows.length > 0 && selectedRows.length < rows.length;
    }, [selectedRows.length, rows.length]);

    const batchModeLabel = batchMode ? t('exit_batch_mode') : t('enter_batch_mode');
    const batchModeEmoji = batchMode ? '✅' : '🛠️';
    const addRowLabel = t('add_row');
    const addRowEmoji = '➕';

    const withCompactTooltip = useCallback((element, title) => {
        if (!compactMode) {
            return element;
        }
        return (
            <Tooltip title={title} enterDelay={200} placement="bottom">
                <span style={{ display: 'inline-flex' }}>
                    {element}
                </span>
            </Tooltip>
        );
    }, [compactMode]);

    // Remove client-side filtering since we're now doing server-side search
    // The rows prop should already contain the filtered results from the server

    // Calculate minimum column widths based on content
    const minColumnWidths = useMemo(() => calculateMinColumnWidths(rows, t), [rows, t]);

    // Helper function to open text dialog
    const openTextDialog = (title, content) => {
        setTextDialog({ open: true, title, content });
    };

    // Helper function to close text dialog
    const closeTextDialog = () => {
        setTextDialog({ open: false, title: '', content: '' });
    };



    // Edit dialog handlers
    const handleOpenEditDialog = (row) => {
        setEditDialog({ open: true, row });
    };

    const handleCloseEditDialog = () => {
        setEditDialog({ open: false, row: null });
    };

    const handleSaveEdit = (updatedRow) => {
        onSaveRow(updatedRow);
        handleCloseEditDialog();
    };

    const handleDelete = (row) => {
        if (window.confirm(t('confirm_delete_phrase', { phrase: row.phrase }))) {
            onDeleteRow(row.id);
        }
    };



    // Function to auto-fit column to content width
    const autoFitColumn = (columnId) => {
        // Don't allow auto-fitting the actions column as it has fixed width
        if (columnId === 'actions') return;

        const minWidth = minColumnWidths[columnId];
        if (minWidth) {
            table.setColumnSizing(prev => ({
                ...prev,
                [columnId]: minWidth
            }));
        }
    };



    // Column helper for creating columns
    const columnHelper = createColumnHelper();

    // Define table columns with resizing
    const columns = useMemo(() => {
        const baseColumns = [
            columnHelper.accessor('id', {
                header: 'ID',
                size: 70,
                minSize: 50,
                maxSize: 90,
                enableResizing: true,
                cell: info => info.getValue()
            }),
            columnHelper.accessor('categories', {
                header: t('categories'),
                size: 180,
                minSize: minColumnWidths.categories || 120,
                maxSize: 300,
                enableResizing: true,
                cell: info => renderExpandableText(info.getValue(), 'categories', t, openTextDialog)
            }),
            columnHelper.accessor('phrase', {
                header: t('phrase'),
                size: 200,
                minSize: minColumnWidths.phrase || 150,
                maxSize: 350,
                enableResizing: true,
                cell: info => renderExpandableText(info.getValue(), 'phrase', t, openTextDialog)
            }),
            columnHelper.accessor('translation', {
                header: t('translation'),
                size: 300,
                minSize: minColumnWidths.translation || 180,
                maxSize: 500,
                enableResizing: true,
                cell: info => renderExpandableText(info.getValue(), 'translation', t, openTextDialog)
            }),
            columnHelper.display({
                id: 'actions',
                header: t('actions'),
                size: 110,
                minSize: 100,
                maxSize: 120,
                enableResizing: false,
                cell: info => {
                    const row = info.row.original;
                    return (
                        <TableRowActions 
                            row={row}
                            onEdit={handleOpenEditDialog}
                            onDelete={handleDelete}
                        />
                    );
                }
            })
        ];

        // Add checkbox column at the beginning if in batch mode
        if (batchMode) {
            const checkboxColumn = columnHelper.display({
                id: 'select',
                header: () => (
                    <Checkbox
                        checked={isAllSelected}
                        indeterminate={isIndeterminate}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        size="small"
                    />
                ),
                size: 50,
                minSize: 50,
                maxSize: 50,
                enableResizing: false,
                cell: info => {
                    const rowId = info.row.original.id;
                    const isSelected = selectedRows.includes(rowId);
                    return (
                        <Checkbox
                            checked={isSelected}
                            onChange={(e) => handleRowCheckboxChange(rowId, e.target.checked)}
                            size="small"
                        />
                    );
                }
            });
            return [checkboxColumn, ...baseColumns];
        }

        return baseColumns;
    }, [t, minColumnWidths, batchMode, isAllSelected, isIndeterminate, handleSelectAll, 
        selectedRows, handleRowCheckboxChange]);

    // Create table instance
    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        columnResizeMode: 'onChange',
        enableColumnResizing: true,
        columnResizeDirection: 'ltr'
    });

    return (
        <>
            {/* Batch Mode Status Bar */}
            {batchMode && (
                <Box sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: 'primary.light',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap'
                }}>
                    <Chip 
                        label={t('batch_mode')} 
                        color="primary" 
                        size="small" 
                        variant="filled"
                    />
                    {selectedRows.length > 0 && (
                        <Chip 
                            label={t('selected_count', { count: selectedRows.length })} 
                            color="secondary" 
                            size="small" 
                            variant="filled"
                        />
                    )}
                    <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSelectAll(true)}
                            disabled={isAllSelected}
                        >
                            {t('select_all')}
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSelectAll(false)}
                            disabled={selectedRows.length === 0}
                        >
                            {t('deselect_all')}
                        </Button>
                    </Stack>
                </Box>
            )}

            {/* Search Box */}
            <Box sx={{
                mt: 2,
                mb: 2,
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2,
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                flexWrap: 'wrap'
            }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: 2,
                        flexDirection: { xs: 'column', sm: 'row' },
                        flexGrow: 1,
                        width: '100%'
                    }}
                >
                    <Typography variant="h6" sx={{ flexShrink: 0 }}>
                        {t('total_rows', { count: totalRows })}
                        {searchTerm && (
                            <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                                ({t('filtered_results', { count: rows.length })})
                            </Typography>
                        )}
                    </Typography>
                    {(onBatchModeToggle || onAddNewRow) && (
                        <Stack
                            direction="row"
                            spacing={compactMode ? 1 : 1.5}
                            sx={{ flexWrap: compactMode ? 'nowrap' : 'wrap', alignItems: 'center' }}
                        >
                            {onBatchModeToggle && withCompactTooltip(
                                <Button
                                    variant={batchMode ? "contained" : "outlined"}
                                    color={batchMode ? "warning" : "info"}
                                    size="small"
                                    onClick={onBatchModeToggle}
                                    startIcon={compactMode ? undefined : <CheckBoxIcon />}
                                    aria-label={batchModeLabel}
                                    title={batchModeLabel}
                                >
                                    {compactMode ? (
                                        <span aria-hidden="true">{batchModeEmoji}</span>
                                    ) : batchModeLabel}
                                </Button>,
                                batchModeLabel
                            )}
                            {onAddNewRow && withCompactTooltip(
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    size="small"
                                    aria-label={addRowLabel}
                                    title={addRowLabel}
                                    startIcon={compactMode ? undefined : <span aria-hidden="true">{addRowEmoji}</span>}
                                    onClick={() => {
                                        if (!canAddNewRow || Boolean(newRow)) {
                                            return;
                                        }
                                        onAddNewRow();
                                        if (tableContainerRef.current) {
                                            const container = tableContainerRef.current;
                                            if (typeof container.scrollTo === 'function') {
                                                container.scrollTo({ top: 0, behavior: 'smooth' });
                                            } else {
                                                container.scrollTop = 0;
                                            }
                                        }
                                    }}
                                    disabled={!canAddNewRow || Boolean(newRow)}
                                >
                                    {compactMode ? (
                                        <span aria-hidden="true">{addRowEmoji}</span>
                                    ) : addRowLabel}
                                </Button>,
                                addRowLabel
                            )}
                        </Stack>
                    )}
                </Box>
                <SearchBar
                    value={localSearchTerm}
                    onChange={handleSearchChange}
                    placeholder={t('search_phrases_translations')}
                    sx={{
                        minWidth: { xs: 200, sm: 300, md: 400 },
                        maxWidth: { xs: '100%', sm: 400 },
                        width: { xs: '100%', sm: 'auto' },
                        flexGrow: { xs: 1, sm: 0 },
                    }}
                />
            </Box>

            <TableContainer
                ref={tableContainerRef}
                component={Paper}
                sx={{
                    mt: 2,
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 300px)', // Dynamic height based on viewport
                    minHeight: '400px',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    position: 'relative', // For overlay positioning
                    '& .MuiTable-root': {
                        minWidth: { xs: 700, md: 'auto' },
                    },
                    // Custom scrollbar styling for both horizontal and vertical
                    '&::-webkit-scrollbar': {
                        width: 8,
                        height: 8,
                    },
                    '&::-webkit-scrollbar-track': {
                        backgroundColor: '#f1f1f1',
                        borderRadius: 4,
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#b89c4e',
                        borderRadius: 4,
                        '&:hover': {
                            backgroundColor: '#8a7429',
                        }
                    },
                    '&::-webkit-scrollbar-corner': {
                        backgroundColor: '#f1f1f1',
                    },
                    // Firefox scrollbar styling
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#b89c4e #f1f1f1',
                }}
            >
                <Table
                    className="admin-table"
                    size="small"
                    stickyHeader
                    sx={{
                        width: '100%',
                        tableLayout: 'fixed',
                        '& .MuiTableCell-root': {
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': {
                                borderRight: 'none'
                            }
                        },
                        '& .MuiTableHead-root .MuiTableCell-root': {
                            backgroundColor: 'background.paper',
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }
                    }}
                >
                    <TableHead>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableCell
                                        key={header.id}
                                        sx={{
                                            width: `${(header.getSize() / table.getCenterTotalSize()) * 100}%`,
                                            position: 'relative',
                                            userSelect: 'none',
                                            background: 'background.paper'
                                        }}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        {header.column.getCanResize() && (
                                            <Box
                                                onMouseDown={header.getResizeHandler()}
                                                onTouchStart={header.getResizeHandler()}
                                                onDoubleClick={() => autoFitColumn(header.column.id)}
                                                sx={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    top: 0,
                                                    height: '100%',
                                                    width: '5px',
                                                    background: 'rgba(0, 0, 0, 0.5)',
                                                    cursor: 'col-resize',
                                                    userSelect: 'none',
                                                    touchAction: 'none',
                                                    opacity: header.column.getIsResizing() ? 1 : 0,
                                                    '&:hover': {
                                                        opacity: 1
                                                    },
                                                    transform: header.column.getIsResizing()
                                                        ? `translateX(${table.getState().columnSizingInfo.deltaOffset}px)`
                                                        : ''
                                                }}
                                                title={t('drag_to_resize_double_click_auto_fit')}
                                            />
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableHead>
                    <TableBody>
                        {shouldRenderNewRow && (
                            <TableRow
                                key="new-row"
                                sx={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    backgroundColor: (theme) => {
                                        if (newRowPhase === 'confirming') {
                                            return lighten(theme.palette.success.main, 0.75);
                                        }
                                        if (newRowPhase === 'cancelling') {
                                            return lighten(theme.palette.error.main, 0.8);
                                        }
                                        return theme.palette.action.hover;
                                    },
                                    transformOrigin: 'top',
                                    animation: (() => {
                                        if (newRowPhase === 'cancelling') {
                                            return `${cancelPop} ${EXIT_FADE_DURATION}ms ease-in forwards`;
                                        }
                                        if (newRowPhase === 'confirming') {
                                            return `${confirmFade} ${EXIT_FADE_DURATION}ms ease-in forwards`;
                                        }
                                        if (newRowPhase === 'editing') {
                                            return `${newRowExpand} 320ms ease-out`;
                                        }
                                        return 'none';
                                    })(),
                                    pointerEvents: newRowPhase === 'editing' ? 'auto' : 'none',
                                    transition: 'background-color 200ms ease-out',
                                    '& .MuiTableCell-root': {
                                        borderBottom: '1px solid',
                                        borderColor: 'divider'
                                    }
                                }}
                            >
                                {table.getVisibleFlatColumns().map(column => {
                                    const columnId = column.id;
                                    const widthPercentage = `${(column.getSize() / (table.getCenterTotalSize() || 1)) * 100}%`;

                                    if (columnId === 'select') {
                                        return (
                                            <TableCell
                                                key={`new-${columnId}`}
                                                sx={{ width: widthPercentage }}
                                            />
                                        );
                                    }

                                    if (columnId === 'id') {
                                        return (
                                            <TableCell
                                                key={`new-${columnId}`}
                                                sx={{ width: widthPercentage }}
                                            >
                                                <TextField
                                                    value={t('auto_generated', 'Auto')}
                                                    disabled
                                                    size="small"
                                                    fullWidth
                                                    InputProps={{ readOnly: true }}
                                                />
                                            </TableCell>
                                        );
                                    }

                                    if (columnId === 'categories') {
                                        return (
                                            <TableCell
                                                key={`new-${columnId}`}
                                                sx={{ width: widthPercentage }}
                                            >
                                                <Autocomplete
                                                    multiple
                                                    freeSolo
                                                    fullWidth
                                                    options={normalizedCategoryOptions}
                                                    value={newRowCategories}
                                                    inputValue={categoryInputValue}
                                                    onInputChange={(event, newInputValue, reason) => {
                                                        if (reason === 'input') {
                                                            setCategoryInputValue(newInputValue);
                                                        }
                                                        if (reason === 'clear' || reason === 'reset') {
                                                            setCategoryInputValue('');
                                                        }
                                                    }}
                                                    onChange={(event, newValue) => {
                                                        const sanitized = [...new Set(newValue.map((cat) => (cat || '').trim()).filter(Boolean))];
                                                        if (newRow) {
                                                            onNewRowChange('categories', sanitized.join(' '));
                                                        }
                                                        setCategoryInputValue('');
                                                    }}
                                                    renderTags={(value, getTagProps) =>
                                                        value.map((option, index) => (
                                                            <Chip
                                                                {...getTagProps({ index })}
                                                                key={`${option}-${index}`}
                                                                label={option}
                                                                size="small"
                                                            />
                                                        ))
                                                    }
                                                    renderInput={(params) => {
                                                        const { inputProps } = params;
                                                        const handleKeyDown = (event) => {
                                                            if (inputProps?.onKeyDown) {
                                                                inputProps.onKeyDown(event);
                                                            }
                                                            if (event.key === ' ' && categoryInputValue.trim()) {
                                                                event.preventDefault();
                                                                commitCategory(categoryInputValue);
                                                                setCategoryInputValue('');
                                                            }
                                                        };

                                                        return (
                                                            <TextField
                                                                {...params}
                                                                placeholder={t('categories')}
                                                                size="small"
                                                                autoComplete="off"
                                                                inputProps={{
                                                                    ...inputProps,
                                                                    'aria-label': t('categories'),
                                                                    onKeyDown: handleKeyDown,
                                                                }}
                                                            />
                                                        );
                                                    }}
                                                />
                                            </TableCell>
                                        );
                                    }

                                    if (columnId === 'phrase') {
                                        return (
                                            <TableCell
                                                key={`new-${columnId}`}
                                                sx={{ width: widthPercentage }}
                                            >
                                                <TextField
                                                    value={displayedRow?.phrase ?? ''}
                                                    onChange={e => {
                                                        if (newRow) {
                                                            onNewRowChange('phrase', e.target.value);
                                                        }
                                                    }}
                                                    placeholder={t('phrase')}
                                                    size="small"
                                                    fullWidth
                                                    autoComplete="off"
                                                    inputProps={{ 'aria-label': t('phrase') }}
                                                />
                                            </TableCell>
                                        );
                                    }

                                    if (columnId === 'translation') {
                                        return (
                                            <TableCell
                                                key={`new-${columnId}`}
                                                sx={{ width: widthPercentage }}
                                            >
                                                <TextField
                                                    value={displayedRow?.translation ?? ''}
                                                    onChange={e => {
                                                        if (newRow) {
                                                            onNewRowChange('translation', e.target.value);
                                                        }
                                                    }}
                                                    placeholder={t('translation')}
                                                    size="small"
                                                    fullWidth
                                                    autoComplete="off"
                                                    multiline
                                                    minRows={1}
                                                    maxRows={4}
                                                    inputProps={{ 'aria-label': t('translation') }}
                                                />
                                            </TableCell>
                                        );
                                    }

                                    if (columnId === 'actions') {
                                        return (
                                            <TableCell
                                                key={`new-${columnId}`}
                                                sx={{ width: widthPercentage }}
                                            >
                                                <Stack direction="row" spacing={1.5} justifyContent="center">
                                                    <Button
                                                        size="small"
                                                        variant="text"
                                                        color="success"
                                                        aria-label={t('add')}
                                                        title={t('add')}
                                                        sx={{
                                                            minWidth: 0,
                                                            width: 36,
                                                            height: 36,
                                                            px: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '1.1rem',
                                                            lineHeight: 1
                                                        }}
                                                        onClick={handleConfirmClick}
                                                        disabled={!isNewRowValid || isSavingNewRow || !newRow || newRowPhase !== 'editing'}
                                                    >
                                                        <span aria-hidden="true">✅</span>
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="text"
                                                        color="error"
                                                        aria-label={t('cancel')}
                                                        title={t('cancel')}
                                                        sx={{
                                                            minWidth: 0,
                                                            width: 36,
                                                            height: 36,
                                                            px: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '1.1rem',
                                                            lineHeight: 1
                                                        }}
                                                        onClick={handleCancelClick}
                                                        disabled={isSavingNewRow || !newRow}
                                                    >
                                                        <span aria-hidden="true">❌</span>
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        );
                                    }

                                    return (
                                        <TableCell
                                            key={`new-${columnId}`}
                                            sx={{ width: widthPercentage }}
                                        />
                                    );
                                })}
                            </TableRow>
                        )}
                        {table.getRowModel().rows.map(row => (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                    <TableCell
                                        key={cell.id}
                                        className="admin-cell"
                                        sx={{
                                            width: `${(cell.column.getSize() / table.getCenterTotalSize()) * 100}%`,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Empty State Overlay */}
                <TableNoRowsOverlay
                    isEmpty={!rows || rows.length === 0}
                    isLoading={isLoading}
                    searchTerm={searchTerm}
                    onClearSearch={() => handleSearchChange('')}
                    translationFn={t}
                />
            </TableContainer>

            {/* Text View Dialog */}
            <TextViewDialog
                open={textDialog.open}
                title={textDialog.title}
                content={textDialog.content}
                onClose={closeTextDialog}
            />

            {/* Edit Phrase Dialog */}
            <EditPhraseDialog
                open={editDialog.open}
                row={editDialog.row}
                onClose={handleCloseEditDialog}
                onSave={handleSaveEdit}
            />
        </>
    );
}

AdminTable.propTypes = {
    rows: PropTypes.array.isRequired,
    onSaveRow: PropTypes.func.isRequired,
    onDeleteRow: PropTypes.func.isRequired,
    totalRows: PropTypes.number.isRequired,
    searchTerm: PropTypes.string,
    onSearchChange: PropTypes.func.isRequired,
    isLoading: PropTypes.bool,
    batchMode: PropTypes.bool,
    selectedRows: PropTypes.array,
    onRowSelectionChange: PropTypes.func.isRequired,
    onBatchModeToggle: PropTypes.func.isRequired,
    onAddNewRow: PropTypes.func,
    newRow: PropTypes.shape({
        categories: PropTypes.string,
        phrase: PropTypes.string,
        translation: PropTypes.string
    }),
    onNewRowChange: PropTypes.func,
    onCancelNewRow: PropTypes.func,
    onConfirmNewRow: PropTypes.func,
    isSavingNewRow: PropTypes.bool,
    canAddNewRow: PropTypes.bool,
    categoryOptions: PropTypes.arrayOf(PropTypes.string),
    compactMode: PropTypes.bool,
};