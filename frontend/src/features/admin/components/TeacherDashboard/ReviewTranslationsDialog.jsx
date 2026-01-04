import React, { useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Chip,
    Snackbar,
} from '@mui/material';
import {
    CheckCircle as CheckIcon,
    Cancel as CancelIcon,
    ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Dialog for reviewing translation submissions for a specific session
 */
function ReviewTranslationsDialog({ open, onClose, session }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    if (!session) return null;

    const submissions = session.translation_submissions || [];

    const handleCopyToClipboard = () => {
        const correctCount = submissions.filter(s => s.is_correct).length;
        const totalCount = submissions.length;

        // Format the results
        const lines = [
            `Translation Review - ${session.nickname}`,
            `Score: ${correctCount}/${totalCount} correct`,
            '',
            ...submissions.map((s, i) =>
                `${i + 1}. ${s.phrase}` +
                `\n   Correct: ${s.correct}` +
                `\n   Answer: ${s.submitted}` +
                `\n   ${s.is_correct ? '✓ Correct' : '✗ Incorrect'}`
            ),
        ];

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
            setCopied(true);
        });
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {t('teacher.review.title', 'Review Translations')}
                    <Typography variant="body2" color="text.secondary">
                        {t('teacher.review.subtitle', { player: session.nickname, defaultValue: 'Player: {{player}}' })}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {submissions.length === 0 ? (
                        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                            {t('teacher.review.no_submissions', 'No translation submissions found for this session.')}
                        </Typography>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('teacher.review.phrase', 'Phrase')}</TableCell>
                                        <TableCell>{t('teacher.review.correct_translation', 'Correct Translation')}</TableCell>
                                        <TableCell>{t('teacher.review.student_submission', 'Student Submission')}</TableCell>
                                        <TableCell align="center">{t('teacher.review.status', 'Status')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {submissions.map((submission, index) => (
                                        <TableRow key={index} hover>
                                            <TableCell sx={{ fontWeight: 500 }}>{submission.phrase}</TableCell>
                                            <TableCell sx={{ color: 'success.main' }}>{submission.correct}</TableCell>
                                            <TableCell
                                                sx={{
                                                    color: submission.is_correct ? 'success.main' : 'error.main',
                                                    fontWeight: submission.is_correct ? 400 : 500
                                                }}
                                            >
                                                {submission.submitted}
                                            </TableCell>
                                            <TableCell align="center">
                                                {submission.is_correct ? (
                                                    <Chip
                                                        icon={<CheckIcon />}
                                                        label={t('teacher.review.correct', 'Correct')}
                                                        color="success"
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                ) : (
                                                    <Chip
                                                        icon={<CancelIcon />}
                                                        label={t('teacher.review.incorrect', 'Incorrect')}
                                                        color="error"
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <DialogActions>
                    {submissions.length > 0 && (
                        <Button
                            startIcon={<CopyIcon />}
                            onClick={handleCopyToClipboard}
                            sx={{ mr: 'auto' }}
                        >
                            {t('teacher.review.copy', 'Copy Results')}
                        </Button>
                    )}
                    <Button onClick={onClose}>{t('close', 'Close')}</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={copied}
                autoHideDuration={2000}
                onClose={() => setCopied(false)}
                message={t('teacher.review.copied', 'Results copied to clipboard')}
            />
        </>
    );
}

ReviewTranslationsDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    session: PropTypes.shape({
        nickname: PropTypes.string,
        translation_submissions: PropTypes.array,
    }),
};

export default ReviewTranslationsDialog;
