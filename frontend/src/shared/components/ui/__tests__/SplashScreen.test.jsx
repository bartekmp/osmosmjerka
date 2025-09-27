import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SplashScreen from '../SplashScreen';
import { withI18n } from '../../../../testUtils';

const renderWithProviders = (ui, lng = 'en') => render(
    withI18n(
        <ThemeProvider theme={createTheme()}>
            {ui}
        </ThemeProvider>,
        lng
    )
);

describe('SplashScreen', () => {
    test('renders localized message in English by default', async () => {
        renderWithProviders(<SplashScreen open />);

        expect(await screen.findByText('Loading Osmosmjerka...')).toBeInTheDocument();
        expect(screen.getByRole('presentation')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('renders localized message when language changes', async () => {
        renderWithProviders(<SplashScreen open />, 'hr');

        expect(await screen.findByText('Učitavanje Osmosmjerke...')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
        renderWithProviders(<SplashScreen open={false} />);

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
});
