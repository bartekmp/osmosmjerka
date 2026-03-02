import React from 'react';
import { Box, Button, TextField, Typography, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function PaginationControls({
    offset,
    limit,
    totalRows,
    offsetInput,
    handleOffsetInput,
    goToOffset,
    setOffset,
    pageSizeSelector
}) {
    const { t } = useTranslation();
    return (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                <Grid sx={{ width: { xs: '100%', sm: 'auto' }, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                    <Button
                        variant="outlined"
                        onClick={() => setOffset(0)}
                        disabled={offset === 0}
                        size="small"
                    >
                        {t('first_page')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => setOffset(Math.max(offset - limit, 0))}
                        disabled={offset === 0}
                        size="small"
                    >
                        {t('previous')}
                    </Button>
                    <Typography variant="body2" align="center">
                        {t('offset')}: {offset}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => setOffset(Math.min(offset + limit, Math.max(totalRows - limit, 0)))}
                        disabled={offset + limit >= totalRows}
                        size="small"
                    >
                        {t('next')}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setOffset(Math.max(totalRows - limit, 0))}
                        disabled={offset + limit >= totalRows}
                        size="small"
                    >
                        {t('last_page')}
                    </Button>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2">{t('go_to_offset')}:</Typography>
                        <TextField
                            type="number"
                            size="small"
                            inputProps={{
                                min: 0,
                                max: Math.max(totalRows - limit, 0),
                                style: { width: 60 }
                            }}
                            value={offsetInput}
                            onChange={handleOffsetInput}
                        />
                        <Button
                            variant="outlined"
                            onClick={goToOffset}
                            size="small"
                        >
                            {t('go')}
                        </Button>
                    </Box>
                </Grid>
                {pageSizeSelector && (
                    <Grid sx={{ width: { xs: '100%', sm: 'auto' }, display: 'flex', justifyContent: { xs: 'center', sm: 'flex-end' } }}>
                        {pageSizeSelector}
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}