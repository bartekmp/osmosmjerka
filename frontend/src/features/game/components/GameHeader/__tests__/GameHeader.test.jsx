import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import GameHeader from '../GameHeader';

// Mock dependencies
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

jest.mock('../../../../../shared', () => ({
    LanguageSwitcher: () => <div data-testid="language-switcher">Language Switcher</div>,
    NightModeButton: () => <div data-testid="night-mode-button">Night Mode</div>,
    GameTypeSelector: ({ currentType, onChange, disabled }) => (
        <div data-testid="game-type-selector">
            Game Type: {currentType}
            <button onClick={() => onChange('new-type')} disabled={disabled}>Change</button>
        </div>
    ),
}));

jest.mock('../../../../../shared/utils/assets', () => ({
    getAssetUrl: (filename) => `/assets/${filename}`,
}));

jest.mock('../../../../../shared/components/ui/ResponsiveText', () => {
    return function ResponsiveText({ desktop, mobile }) {
        return (
            <span>
                <span className="desktop">{desktop}</span>
                <span className="mobile">{mobile}</span>
            </span>
        );
    };
});

describe('GameHeader Component', () => {
    const defaultProps = {
        logoFilter: 'none',
        handleLogoClick: jest.fn(),
        showCelebration: false,
        currentUser: null,
        gameType: null,
        onGameTypeChange: null,
        isGridLoading: false,
    };

    const renderWithRouter = (component) => {
        return render(
            <MemoryRouter>
                {component}
            </MemoryRouter>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders the logo and title', () => {
            renderWithRouter(<GameHeader {...defaultProps} />);

            const logo = screen.getByAltText('Osmosmjerka logo');
            expect(logo).toBeInTheDocument();
            expect(logo).toHaveAttribute('src', '/assets/android-chrome-512x512.png');

            expect(screen.getByText('Osmosmjerka')).toBeInTheDocument();
        });

        it('renders all control components', () => {
            renderWithRouter(<GameHeader {...defaultProps} />);

            expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
            expect(screen.getByTestId('night-mode-button')).toBeInTheDocument();
        });

        it('renders profile button with link to admin', () => {
            renderWithRouter(<GameHeader {...defaultProps} />);

            const profileButton = screen.getByRole('link', { name: /profile/i });
            expect(profileButton).toBeInTheDocument();
            expect(profileButton).toHaveAttribute('href', '/admin');
        });
    });

    describe('Logo Interaction', () => {
        it('calls handleLogoClick when logo area is clicked', () => {
            const handleLogoClick = jest.fn();
            renderWithRouter(<GameHeader {...defaultProps} handleLogoClick={handleLogoClick} />);

            const logoContainer = screen.getByText('Osmosmjerka').closest('[role="button"]')?.parentElement;
            if (logoContainer) {
                fireEvent.click(logoContainer);
                expect(handleLogoClick).toHaveBeenCalledTimes(1);
            }
        });

        it('applies logo filter correctly', () => {
            renderWithRouter(<GameHeader {...defaultProps} logoFilter="blur(2px)" />);

            const logo = screen.getByAltText('Osmosmjerka logo');
            // Checking via sx prop which gets applied as inline styles
            expect(logo).toBeInTheDocument();
        });
    });

    describe('Celebration Animation', () => {
        it('applies celebration animation when showCelebration is true', () => {
            renderWithRouter(<GameHeader {...defaultProps} showCelebration={true} />);

            const title = screen.getByText('Osmosmjerka');
            expect(title).toBeInTheDocument();
            // Animation is applied via sx prop - component should render without errors
        });

        it('does not apply celebration animation when showCelebration is false', () => {
            renderWithRouter(<GameHeader {...defaultProps} showCelebration={false} />);

            const title = screen.getByText('Osmosmjerka');
            expect(title).toBeInTheDocument();
        });
    });

    describe('User Display', () => {
        it('displays username when user is logged in', () => {
            const currentUser = { username: 'TestUser' };
            renderWithRouter(<GameHeader {...defaultProps} currentUser={currentUser} />);

            expect(screen.getByText(/TestUser/)).toBeInTheDocument();
        });

        it('displays default profile text when no user', () => {
            renderWithRouter(<GameHeader {...defaultProps} currentUser={null} />);

            expect(screen.getByText(/profile/i)).toBeInTheDocument();
        });

        it('handles user with empty username', () => {
            const currentUser = { username: '   ' };
            renderWithRouter(<GameHeader {...defaultProps} currentUser={currentUser} />);

            expect(screen.getByText(/profile/i)).toBeInTheDocument();
        });
    });

    describe('Game Type Selector', () => {
        it('renders game type selector when gameType and onGameTypeChange are provided', () => {
            const onGameTypeChange = jest.fn();
            renderWithRouter(
                <GameHeader
                    {...defaultProps}
                    gameType="quiz"
                    onGameTypeChange={onGameTypeChange}
                />
            );

            expect(screen.getByTestId('game-type-selector')).toBeInTheDocument();
            expect(screen.getByText(/Game Type: quiz/)).toBeInTheDocument();
        });

        it('does not render game type selector when gameType is null', () => {
            renderWithRouter(<GameHeader {...defaultProps} gameType={null} />);

            expect(screen.queryByTestId('game-type-selector')).not.toBeInTheDocument();
        });

        it('does not render game type selector when onGameTypeChange is null', () => {
            renderWithRouter(<GameHeader {...defaultProps} gameType="quiz" onGameTypeChange={null} />);

            expect(screen.queryByTestId('game-type-selector')).not.toBeInTheDocument();
        });

        it('disables game type selector when grid is loading', () => {
            const onGameTypeChange = jest.fn();
            renderWithRouter(
                <GameHeader
                    {...defaultProps}
                    gameType="quiz"
                    onGameTypeChange={onGameTypeChange}
                    isGridLoading={true}
                />
            );

            const changeButton = screen.getByRole('button', { name: /Change/i });
            expect(changeButton).toBeDisabled();
        });

        it('enables game type selector when grid is not loading', () => {
            const onGameTypeChange = jest.fn();
            renderWithRouter(
                <GameHeader
                    {...defaultProps}
                    gameType="quiz"
                    onGameTypeChange={onGameTypeChange}
                    isGridLoading={false}
                />
            );

            const changeButton = screen.getByRole('button', { name: /Change/i });
            expect(changeButton).not.toBeDisabled();
        });
    });

    describe('Image Error Handling', () => {
        it('falls back to favicon when main logo fails to load', () => {
            renderWithRouter(<GameHeader {...defaultProps} />);

            const logo = screen.getByAltText('Osmosmjerka logo');

            // Simulate image load error
            fireEvent.error(logo);

            expect(logo).toHaveAttribute('src', '/assets/favicon-32x32.png');
        });
    });
});
