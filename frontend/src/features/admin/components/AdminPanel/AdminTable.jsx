import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
    Stack
} from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useTranslation } from 'react-i18next';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper
} from '@tanstack/react-table';
import { measureTextWidth, calculateMinColumnWidths } from './adminTableUtils';
import EditPhraseDialog from './EditPhraseDialog';
import TextViewDialog from './TextViewDialog';
import SearchBar from './SearchBar';
import TableRowActions from './TableRowActions';
import TableNoRowsOverlay from './TableNoRowsOverlay';
import { renderExpandableText } from './utils/renderHelpers';
import { containsHTML, stripHTML } from './utils/validationUtils';

export default function AdminTable({ 
    rows, 
    setEditRow, 
    onSaveRow, 
    onDeleteRow, 
    totalRows, 
    searchTerm, 
    onSearchChange, 
    isLoading = false,
    batchMode = false,
    selectedRows = [],
    onRowSelectionChange,
    onBatchModeToggle
}) {
    const { t } = useTranslation();
    const [editDialog, setEditDialog] = useState({ open: false, row: null });
    const [textDialog, setTextDialog] = useState({ open: false, title: '', content: '' });
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');

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

    const isAllSelected = useMemo(() => {
        return rows.length > 0 && selectedRows.length === rows.length;
    }, [rows.length, selectedRows.length]);

    const isIndeterminate = useMemo(() => {
        return selectedRows.length > 0 && selectedRows.length < rows.length;
    }, [selectedRows.length, rows.length]);

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
                size: 80,
                minSize: minColumnWidths.id || 60,
                maxSize: 120,
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
                size: 140,
                minSize: 140,
                maxSize: 140,
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
                justifyContent: 'space-between'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6">
                        {t('total_rows', { count: totalRows })}
                        {searchTerm && (
                            <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                                ({t('filtered_results', { count: rows.length })})
                            </Typography>
                        )}
                    </Typography>
                    {onBatchModeToggle && (
                        <Button
                            variant={batchMode ? "contained" : "outlined"}
                            color={batchMode ? "warning" : "info"}
                            size="small"
                            onClick={onBatchModeToggle}
                            startIcon={<CheckBoxIcon />}
                            sx={{ ml: 2 }}
                        >
                            {batchMode ? t('exit_batch_mode') : t('enter_batch_mode')}
                        </Button>
                    )}
                </Box>
                <SearchBar
                    value={localSearchTerm}
                    onChange={handleSearchChange}
                    placeholder={t('search_phrases_translations')}
                    sx={{
                        minWidth: { xs: 200, sm: 300, md: 400 },
                        maxWidth: { xs: '100%', sm: 400 },
                        flexGrow: { xs: 1, sm: 0 },
                    }}
                />
            </Box>

            <TableContainer
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