import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import HintButton from '../HintButton';
import { withI18n } from '../../../../../testUtils';

const renderHintButton = (props = {}, lng = 'en') =>
    render(
        withI18n(
            <ThemeProvider theme={createTheme()}>
                <HintButton onHintRequest={jest.fn()} {...props} />
            </ThemeProvider>,
            lng
        )
    );

describe('HintButton', () => {
    test('shows "No hints" label when no hints remain (default locale)', () => {
        renderHintButton({ remainingHints: 0 });

        const button = screen.getByRole('button', { name: /no hints/i });
        expect(button).toBeDisabled();
    });

    test('shows translated "No hints" label when locale changes', () => {
        renderHintButton({ remainingHints: 0 }, 'hr');

        expect(screen.getByRole('button', { name: /nema savjeta/i })).toBeDisabled();
    });
});
