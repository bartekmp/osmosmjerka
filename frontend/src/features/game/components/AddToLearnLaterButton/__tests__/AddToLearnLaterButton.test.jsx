import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import axios from 'axios';
import AddToLearnLaterButton from '../../AddToLearnLaterButton';
import { withI18n } from '../../../../../testUtils';
import { STORAGE_KEYS } from '../../../../../shared/constants/constants';

jest.mock('axios');

const theme = createTheme();

const mockPhrases = [
  { id: 1, phrase: 'hello', translation: 'hola' },
  { id: 2, phrase: 'goodbye', translation: 'adiós' },
  { id: 3, phrase: 'thank you', translation: 'gracias' },
];

describe('AddToLearnLaterButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'test-token');
    // Default mock for checkPhrasesInList that runs on mount
    axios.post.mockResolvedValue({ data: { in_list: [] } });
  });

  test('does not render when user is not logged in', () => {
    const { container } = render(
      withI18n(
        <ThemeProvider theme={theme}>
          <AddToLearnLaterButton
            phrases={mockPhrases}
            languageSetId={1}
            currentUser={null}
          />
        </ThemeProvider>
      )
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders button when user is logged in', async () => {
    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <AddToLearnLaterButton
            phrases={mockPhrases}
            languageSetId={1}
            currentUser={{ id: 1, username: 'testuser' }}
          />
        </ThemeProvider>
      )
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    
    // Wait for async checkPhrasesInList to complete
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });
  });

  test('checks which phrases are already in list on mount', async () => {
    axios.post.mockResolvedValueOnce({
      data: { in_list: [1, 2] }
    });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <AddToLearnLaterButton
            phrases={mockPhrases}
            languageSetId={1}
            currentUser={{ id: 1, username: 'testuser' }}
          />
        </ThemeProvider>
      )
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/user/learn-later/check',
        {
          language_set_id: 1,
          phrase_ids: [1, 2, 3]
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      );
    });
  });

  test('adds phrases to Learn This Later when clicked', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { in_list: [] } }) // Check call
      .mockResolvedValueOnce({ data: { added_count: 3 } }); // Bulk add call

    const onSuccess = jest.fn();

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <AddToLearnLaterButton
            type="all"
            phrases={mockPhrases}
            languageSetId={1}
            currentUser={{ id: 1, username: 'testuser' }}
            onSuccess={onSuccess}
          />
        </ThemeProvider>
      )
    );

    const button = screen.getByRole('button');

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/user/learn-later/bulk',
        {
          language_set_id: 1,
          phrase_ids: [1, 2, 3]
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      );
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  test('disables button when all phrases are already added', async () => {
    axios.post.mockResolvedValueOnce({
      data: { in_list: [1, 2, 3] }
    });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <AddToLearnLaterButton
            phrases={mockPhrases}
            languageSetId={1}
            currentUser={{ id: 1, username: 'testuser' }}
          />
        </ThemeProvider>
      )
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  test('disables button when no phrases provided', async () => {
    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <AddToLearnLaterButton
            phrases={[]}
            languageSetId={1}
            currentUser={{ id: 1, username: 'testuser' }}
          />
        </ThemeProvider>
      )
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    // No phrases means no API call, but wait a tick for any potential async effects
    await waitFor(() => {
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  test('shows error notification on API failure', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { in_list: [] } })
      .mockRejectedValueOnce({
        response: { data: { error: 'Failed to add phrases' } }
      });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <AddToLearnLaterButton
            phrases={mockPhrases}
            languageSetId={1}
            currentUser={{ id: 1, username: 'testuser' }}
          />
        </ThemeProvider>
      )
    );

    const button = screen.getByRole('button');

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });
});
