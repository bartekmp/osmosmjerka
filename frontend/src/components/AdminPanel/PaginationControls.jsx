import React from 'react';
import { Box, Button, TextField, Typography, Grid } from '@mui/material';

export default function PaginationControls({
    offset,
    limit,
    totalRows,
    offsetInput,
    handleOffsetInput,
    goToOffset,
    setOffset
}) {
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
                        Previous
                    </Button>
                </Grid>
                <Grid item xs={12} sm="auto">
                    <Typography variant="body2" align="center">
                        Offset: {offset}
                    </Typography>
                </Grid>
                <Grid item xs={12} sm="auto">
                    <Button
                        variant="contained"
                        onClick={() => setOffset(Math.min(offset + limit, Math.max(totalRows - limit, 0)))}
                        disabled={offset + limit >= totalRows}
                        size="small"
                    >
                        Next
                    </Button>
                </Grid>
                <Grid item xs={12} sm="auto">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Typography variant="body2">Go to offset:</Typography>
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
                            Go
                        </Button>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}