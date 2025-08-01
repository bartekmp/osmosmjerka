import React, { useState, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Button,
    Box,
    TableContainer,
    Paper,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper
} from '@tanstack/react-table';
import { measureTextWidth, calculateMinColumnWidths } from './adminTableUtils';

export default function AdminTable({ rows, setEditRow, onSaveRow, onDeleteRow, totalRows, searchTerm, onSearchChange }) {
    const { t } = useTranslation();
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [errors, setErrors] = useState({});
    const [textDialog, setTextDialog] = useState({ open: false, title: '', content: '' });

    // Filter rows based on search term
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const searchLower = searchTerm.toLowerCase();
        return rows.filter(row =>
            row.word.toLowerCase().includes(searchLower) ||
            row.translation.toLowerCase().includes(searchLower)
        );
    }, [rows, searchTerm]);

    // Calculate minimum column widths based on content
    const minColumnWidths = useMemo(() => calculateMinColumnWidths(filteredRows, t), [filteredRows, t]);

    // Helper function to open text dialog
    const openTextDialog = (title, content) => {
        setTextDialog({ open: true, title, content });
    };

    // Helper function to close text dialog
    const closeTextDialog = () => {
        setTextDialog({ open: false, title: '', content: '' });
    };

    // Edit handlers
    const handleEdit = (row) => {
        setEditingId(row.id);
        setEditData({
            categories: row.categories,
            word: row.word,
            translation: row.translation
        });
        setErrors({});
    };

    const handleSave = () => {
        const newErrors = {};
        if (!editData.categories?.trim()) newErrors.categories = t('categories_required');
        if (!editData.word?.trim()) newErrors.word = t('word_required');
        if (!editData.translation?.trim()) newErrors.translation = t('translation_required');

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const updatedRow = {
            id: editingId,
            categories: editData.categories.trim(),
            word: editData.word.trim(),
            translation: editData.translation.trim()
        };

        onSaveRow(updatedRow);
        setEditingId(null);
        setEditData({});
        setErrors({});
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData({});
        setErrors({});
    };

    const handleDelete = (row) => {
        if (window.confirm(t('confirm_delete_word', { word: row.word }))) {
            onDeleteRow(row.id);
        }
    };

    const handleChange = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
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

    // Helper function to render text with click-to-expand functionality
    const renderExpandableText = (text, columnName, t, openTextDialog, maxLength = 50) => {
        if (!text || text.length <= maxLength) {
            return text;
        }
        const truncated = text.substring(0, maxLength) + '...';
        return (
            <Typography
                component="span"
                sx={{
                    cursor: 'pointer',
                    color: 'primary.main',
                    textDecoration: 'underline',
                    '&:hover': {
                        color: 'primary.dark'
                    }
                }}
                onClick={() => openTextDialog(t(columnName), text)}
                title={t('click_to_view_full_text')}
            >
                {truncated}
            </Typography>
        );
    };

    // Column helper for creating columns
    const columnHelper = createColumnHelper();

    // Define table columns with resizing
    const columns = useMemo(() => [
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
            cell: info => {
                const row = info.row.original;
                return editingId === row.id ? (
                    <TextField
                        value={editData.categories || ''}
                        onChange={(e) => handleChange('categories', e.target.value)}
                        size="small"
                        fullWidth
                        error={!!errors.categories}
                        helperText={errors.categories}
                        InputProps={{ className: 'admin-input' }}
                    />
                ) : (
                    renderExpandableText(info.getValue(), 'categories', t, openTextDialog)
                );
            }
        }),
        columnHelper.accessor('word', {
            header: t('word'),
            size: 200,
            minSize: minColumnWidths.word || 150,
            maxSize: 350,
            enableResizing: true,
            cell: info => {
                const row = info.row.original;
                return editingId === row.id ? (
                    <TextField
                        value={editData.word || ''}
                        onChange={(e) => handleChange('word', e.target.value)}
                        size="small"
                        fullWidth
                        error={!!errors.word}
                        helperText={errors.word}
                        InputProps={{ className: 'admin-input' }}
                    />
                ) : (
                    renderExpandableText(info.getValue(), 'word', t, openTextDialog)
                );
            }
        }),
        columnHelper.accessor('translation', {
            header: t('translation'),
            size: 300,
            minSize: minColumnWidths.translation || 180,
            maxSize: 500,
            enableResizing: true,
            cell: info => {
                const row = info.row.original;
                return editingId === row.id ? (
                    <TextField
                        value={editData.translation || ''}
                        onChange={(e) => handleChange('translation', e.target.value)}
                        size="small"
                        fullWidth
                        error={!!errors.translation}
                        helperText={errors.translation}
                        InputProps={{ className: 'admin-input' }}
                    />
                ) : (
                    renderExpandableText(info.getValue(), 'translation', t, openTextDialog)
                );
            }
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
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {editingId === row.id ? (
                            <>
                                <Button
                                    size="small"
                                    onClick={handleSave}
                                    color="primary"
                                    sx={{ minWidth: '60px', fontSize: '0.75rem' }}
                                >
                                    {t('save')}
                                </Button>
                                <Button
                                    size="small"
                                    onClick={handleCancel}
                                    color="secondary"
                                    sx={{ minWidth: '60px', fontSize: '0.75rem' }}
                                >
                                    {t('cancel')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    size="small"
                                    onClick={() => handleEdit(row)}
                                    sx={{ minWidth: '60px', fontSize: '0.75rem' }}
                                >
                                    {t('edit')}
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => handleDelete(row)}
                                    color="error"
                                    sx={{ minWidth: '60px', fontSize: '0.75rem' }}
                                >
                                    {t('delete')}
                                </Button>
                            </>
                        )}
                    </Box>
                );
            }
        })
    ], [t, editingId, editData, errors, minColumnWidths]);

    // Create table instance
    const table = useReactTable({
        data: filteredRows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        columnResizeMode: 'onChange',
        enableColumnResizing: true,
        columnResizeDirection: 'ltr'
    });

    return (
        <>
            {/* Search Box */}
            <Box sx={{
                mt: 2,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
                justifyContent: 'space-between'
            }}>
                <Typography variant="h6">
                    {t('total_rows', { count: totalRows })}
                    {searchTerm && filteredRows.length !== totalRows && (
                        <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                            ({t('filtered_results', { count: filteredRows.length })})
                        </Typography>
                    )}
                </Typography>
                <TextField
                    size="small"
                    placeholder={t('search_words_translations')}
                    value={searchTerm || ''}
                    onChange={(e) => onSearchChange(e.target.value)}
                    disabled={!rows || rows.length === 0}
                    sx={{
                        minWidth: 250,
                        '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                                borderColor: '#b89c4e',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#b89c4e',
                            },
                        }
                    }}
                />
            </Box>

            <TableContainer
                component={Paper}
                sx={{
                    mt: 2,
                    maxWidth: '100%',
                    overflowX: 'auto',
                    '& .MuiTable-root': {
                        minWidth: { xs: 700, md: 'auto' },
                    },
                    // Custom scrollbar styling
                    '&::-webkit-scrollbar': {
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
                    }
                }}
            >
                <Table
                    className="admin-table"
                    size="small"
                    sx={{
                        width: '100%',
                        tableLayout: 'fixed',
                        '& .MuiTableCell-root': {
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': {
                                borderRight: 'none'
                            }
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
                                        className={editingId === row.original.id ? "admin-cell-editable" : "admin-cell"}
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
            </TableContainer>

            {/* Text View Dialog */}
            <Dialog
                open={textDialog.open}
                onClose={closeTextDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '80vh',
                        backgroundColor: 'background.paper'
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                    color: 'text.primary'
                }}>
                    <Typography variant="h6">{textDialog.title}</Typography>
                    <IconButton onClick={closeTextDialog} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Box sx={{
                        backgroundColor: 'background.default',
                        borderRadius: 1,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider'
                    }}>
                        <Typography
                            variant="body1"
                            sx={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'monospace',
                                userSelect: 'text',
                                color: 'text.primary'
                            }}
                        >
                            {textDialog.content}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{
                    p: 2,
                    backgroundColor: 'background.paper',
                    borderTop: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Button onClick={closeTextDialog} variant="contained">
                        {t('close')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}