import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Timer from '../Timer';

describe('Timer Component', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    const defaultProps = {
        isActive: false,
        onTimeUpdate: jest.fn(),
        resetTrigger: 0,
        showTimer: true,
        currentElapsedTime: 0,
        isPaused: false,
        onTogglePause: jest.fn(),
        canPause: false,
    };

    describe('Basic Rendering', () => {
        it('renders timer with initial time', () => {
            render(<Timer {...defaultProps} />);

            expect(screen.getByText(/00:00/)).toBeInTheDocument();
        });

        it('does not render when showTimer is false', () => {
            const { container } = render(<Timer {...defaultProps} showTimer={false} />);

            expect(container.firstChild).toBeNull();
        });

        it('displays elapsed time correctly', () => {
            render(<Timer {...defaultProps} currentElapsedTime={125} />);

            expect(screen.getByText(/02:05/)).toBeInTheDocument();
        });

        it('shows pause icon when paused', () => {
            render(<Timer {...defaultProps} isPaused={true} />);

            expect(screen.getByText(/⏸️/)).toBeInTheDocument();
        });

        it('shows timer icon when not paused', () => {
            render(<Timer {...defaultProps} isPaused={false} />);

            expect(screen.getByText(/⏱️/)).toBeInTheDocument();
        });
    });

    describe('Timer Counting', () => {
        it('increments time when isActive is true', () => {
            const onTimeUpdate = jest.fn();
            render(<Timer {...defaultProps} isActive={true} onTimeUpdate={onTimeUpdate} />);

            act(() => {
                jest.advanceTimersByTime(3000);
            });

            expect(screen.getByText(/00:03/)).toBeInTheDocument();
            expect(onTimeUpdate).toHaveBeenCalledWith(3);
        });

        it('does not increment when isActive is false', () => {
            const onTimeUpdate = jest.fn();
            render(<Timer {...defaultProps} isActive={false} onTimeUpdate={onTimeUpdate} />);

            act(() => {
                jest.advanceTimersByTime(3000);
            });

            expect(screen.getByText(/00:00/)).toBeInTheDocument();
            expect(onTimeUpdate).not.toHaveBeenCalled();
        });

        it('stops counting when showTimer becomes false', () => {
            const { rerender } = render(<Timer {...defaultProps} isActive={true} />);

            act(() => {
                jest.advanceTimersByTime(2000);
            });

            expect(screen.getByText(/00:02/)).toBeInTheDocument();

            rerender(<Timer {...defaultProps} isActive={true} showTimer={false} />);

            act(() => {
                jest.advanceTimersByTime(2000);
            });

            // Timer should not be visible
            expect(screen.queryByText(/00:04/)).not.toBeInTheDocument();
        });
    });

    describe('Timer Reset', () => {
        it('resets timer when resetTrigger changes', () => {
            const { rerender } = render(<Timer {...defaultProps} currentElapsedTime={50} />);

            expect(screen.getByText(/00:50/)).toBeInTheDocument();

            rerender(<Timer {...defaultProps} resetTrigger={1} />);

            expect(screen.getByText(/00:00/)).toBeInTheDocument();
        });

        it('handles multiple resets', () => {
            const { rerender } = render(<Timer {...defaultProps} currentElapsedTime={30} />);

            rerender(<Timer {...defaultProps} resetTrigger={1} />);
            expect(screen.getByText(/00:00/)).toBeInTheDocument();

            rerender(<Timer {...defaultProps} resetTrigger={2} currentElapsedTime={10} />);
            expect(screen.getByText(/00:00/)).toBeInTheDocument();
        });
    });

    describe('Time Formatting', () => {
        it('formats single digit seconds correctly', () => {
            render(<Timer {...defaultProps} currentElapsedTime={5} />);

            expect(screen.getByText(/00:05/)).toBeInTheDocument();
        });

        it('formats double digit seconds correctly', () => {
            render(<Timer {...defaultProps} currentElapsedTime={45} />);

            expect(screen.getByText(/00:45/)).toBeInTheDocument();
        });

        it('formats minutes and seconds correctly', () => {
            render(<Timer {...defaultProps} currentElapsedTime={125} />);

            expect(screen.getByText(/02:05/)).toBeInTheDocument();
        });

        it('handles large time values', () => {
            render(<Timer {...defaultProps} currentElapsedTime={3661} />);

            expect(screen.getByText(/61:01/)).toBeInTheDocument();
        });
    });

    describe('Pause Functionality', () => {
        it('is clickable when canPause is true', () => {
            render(<Timer {...defaultProps} canPause={true} />);

            const timerDisplay = screen.getByRole('button');
            expect(timerDisplay).toBeInTheDocument();
        });

        it('is not clickable when canPause is false', () => {
            render(<Timer {...defaultProps} canPause={false} />);

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('calls onTogglePause when clicked and canPause is true', () => {
            const onTogglePause = jest.fn();
            render(<Timer {...defaultProps} canPause={true} onTogglePause={onTogglePause} />);

            const timerDisplay = screen.getByRole('button');
            fireEvent.click(timerDisplay);

            expect(onTogglePause).toHaveBeenCalledTimes(1);
        });

        it('does not call onTogglePause when canPause is false', () => {
            const onTogglePause = jest.fn();
            render(<Timer {...defaultProps} canPause={false} onTogglePause={onTogglePause} />);

            const timerContainer = screen.getByText(/00:00/).closest('.timer-container');
            if (timerContainer) {
                fireEvent.click(timerContainer);
            }

            expect(onTogglePause).not.toHaveBeenCalled();
        });

        it('handles Enter key press when canPause is true', () => {
            const onTogglePause = jest.fn();
            render(<Timer {...defaultProps} canPause={true} onTogglePause={onTogglePause} />);

            const timerDisplay = screen.getByRole('button');
            fireEvent.keyDown(timerDisplay, { key: 'Enter' });

            expect(onTogglePause).toHaveBeenCalledTimes(1);
        });

        it('handles Space key press when canPause is true', () => {
            const onTogglePause = jest.fn();
            render(<Timer {...defaultProps} canPause={true} onTogglePause={onTogglePause} />);

            const timerDisplay = screen.getByRole('button');
            fireEvent.keyDown(timerDisplay, { key: ' ' });

            expect(onTogglePause).toHaveBeenCalledTimes(1);
        });

        it('does not handle other keys', () => {
            const onTogglePause = jest.fn();
            render(<Timer {...defaultProps} canPause={true} onTogglePause={onTogglePause} />);

            const timerDisplay = screen.getByRole('button');
            fireEvent.keyDown(timerDisplay, { key: 'a' });

            expect(onTogglePause).not.toHaveBeenCalled();
        });
    });

    describe('Current Elapsed Time Sync', () => {
        it('updates displayed time when currentElapsedTime prop changes', () => {
            const { rerender } = render(<Timer {...defaultProps} currentElapsedTime={10} />);

            expect(screen.getByText(/00:10/)).toBeInTheDocument();

            rerender(<Timer {...defaultProps} currentElapsedTime={25} />);

            expect(screen.getByText(/00:25/)).toBeInTheDocument();
        });

        it('continues counting from new currentElapsedTime when active', () => {
            const { rerender } = render(
                <Timer {...defaultProps} isActive={true} currentElapsedTime={10} />
            );

            act(() => {
                jest.advanceTimersByTime(2000);
            });

            expect(screen.getByText(/00:12/)).toBeInTheDocument();

            rerender(<Timer {...defaultProps} isActive={true} currentElapsedTime={20} />);

            act(() => {
                jest.advanceTimersByTime(3000);
            });

            expect(screen.getByText(/00:23/)).toBeInTheDocument();
        });
    });

    describe('Pause State Display', () => {
        it('has aria-pressed attribute when pausable', () => {
            render(<Timer {...defaultProps} canPause={true} isPaused={true} />);

            const timerDisplay = screen.getByRole('button');
            expect(timerDisplay).toHaveAttribute('aria-pressed', 'true');
        });

        it('shows paused class when isPaused is true', () => {
            render(<Timer {...defaultProps} isPaused={true} />);

            const timerDisplay = screen.getByText(/⏸️/).closest('.timer-display');
            expect(timerDisplay).toHaveClass('paused');
        });

        it('shows active class when isActive is true', () => {
            render(<Timer {...defaultProps} isActive={true} />);

            const timerDisplay = screen.getByText(/⏱️/).closest('.timer-display');
            expect(timerDisplay).toHaveClass('active');
        });
    });
});
