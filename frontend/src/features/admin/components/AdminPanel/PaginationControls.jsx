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
    setOffset
}) {
    const { t } = useTranslation();
    return (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Grid container spacing={2} alignItems="center" justifyContent="center">
                <Grid item xs={12} sm="auto">
                    <Button
                        variant="contained"
                        onClick={() => setOffset(Math.max(offset - limit, 0))}
                        disabled={offset === 0}
                        size="small"
                    >
                        {t('previous')}
                    </Button>
                </Grid>
                <Grid item xs={12} sm="auto">
                    <Typography variant="body2" align="center">
                        {t('offset')}: {offset}
                    </Typography>
                </Grid>
                <Grid item xs={12} sm="auto">
                    <Button
                        variant="contained"
                        onClick={() => setOffset(Math.min(offset + limit, Math.max(totalRows - limit, 0)))}
                        disabled={offset + limit >= totalRows}
                        size="small"
                    >
                        {t('next')}
                    </Button>
                </Grid>
                <Grid item xs={12} sm="auto">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
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
            </Grid>
        </Box>
    );
}