import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import axios from 'axios';
import PrivateListManager from '../PrivateListManager';
import { withI18n } from '../../../../testUtils';
import { STORAGE_KEYS } from '../../../../shared/constants/constants';

jest.mock('axios');

const theme = createTheme();

const mockLists = [
  { id: 1, list_name: 'Learn This Later', phrase_count: 5, is_system_list: true },
  { id: 2, list_name: 'My Custom List', phrase_count: 3, is_system_list: false },
];

const mockListsResponse = {
  data: {
    lists: mockLists,
    total: 2,
    limit: 50,
    offset: 0,
    has_more: false
  }
};

const mockEmptyListsResponse = {
  data: {
    lists: [],
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  }
};

describe('PrivateListManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'test-token');
    // Default mock for the lists fetch that runs on mount
    axios.get.mockResolvedValue(mockListsResponse);
  });

  test('renders dialog when open', async () => {
    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListManager
            open={true}
            onClose={() => { }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Wait for async fetch to complete
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
  });

  test('does not render when closed', () => {
    const { _ } = render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListManager
            open={false}
            onClose={() => { }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('fetches lists on mount', async () => {
    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListManager
            open={true}
            onClose={() => { }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/private-lists'),
        expect.any(Object)
      );
    });
  });

  test('displays lists in Lists tab', async () => {
    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListManager
            open={true}
            onClose={() => { }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Learn This Later')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText('My Custom List')).toBeInTheDocument();
  });

  test('allows creating a new list', async () => {
    const user = userEvent.setup();

    axios.get.mockResolvedValue(mockEmptyListsResponse);

    axios.post.mockResolvedValueOnce({
      data: { id: 3, list_name: 'New List', language_set_id: 1 }
    });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListManager
            open={true}
            onClose={() => { }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });

    // Find and click the "Create New List" button
    const createButton = await screen.findByRole('button', { name: /create new list/i });
    await user.click(createButton);

    // Wait for the create dialog to open and find the input
    const nameInput = await screen.findByRole('textbox', { name: /list name/i });
    await user.type(nameInput, 'New List');

    // Find and click the Create button in the dialog
    const createDialogButton = await screen.findByRole('button', { name: /^create$/i });
    await user.click(createDialogButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/user/private-lists',
        expect.objectContaining({
          list_name: 'New List',
          language_set_id: 1
        }),
        expect.any(Object)
      );
    });
  });

  test('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn();

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListManager
            open={true}
            onClose={onClose}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    // Wait for async fetch to complete first
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });

    const closeButton = screen.getByText(/close/i);
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
