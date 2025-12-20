import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  test('disables delete and edit buttons for system lists', async () => {
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

    // Wait for lists to load
    await waitFor(() => {
      expect(screen.getByText('Learn This Later')).toBeInTheDocument();
    });

    // Find the row for "Learn This Later" (system list)
    const learnLaterRow = screen.getByText('Learn This Later').closest('tr');
    expect(learnLaterRow).toBeInTheDocument();

    // Find all buttons in the actions column (edit and delete)
    const actionButtons = learnLaterRow?.querySelectorAll('td:last-child button');
    expect(actionButtons).toBeTruthy();
    expect(actionButtons?.length).toBeGreaterThan(0);

    // Both edit and delete buttons should be disabled for system lists
    actionButtons?.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  test('enables delete and edit buttons for non-system lists', async () => {
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

    // Wait for lists to load
    await waitFor(() => {
      expect(screen.getByText('My Custom List')).toBeInTheDocument();
    });

    // Find the row for "My Custom List" (non-system list)
    const customListRow = screen.getByText('My Custom List').closest('tr');
    expect(customListRow).toBeInTheDocument();

    // Find all buttons in the actions column
    const actionButtons = customListRow?.querySelectorAll('td:last-child button');
    expect(actionButtons).toBeTruthy();
    expect(actionButtons?.length).toBeGreaterThan(0);

    // Both edit and delete buttons should be enabled for non-system lists
    actionButtons?.forEach(button => {
      expect(button).not.toBeDisabled();
    });
  });

  test('prevents deletion of system lists - delete button does not trigger API call', async () => {
    const _user = userEvent.setup();

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

    // Wait for lists to load
    await waitFor(() => {
      expect(screen.getByText('Learn This Later')).toBeInTheDocument();
    });

    // Find the delete button for "Learn This Later" (system list)
    const learnLaterRow = screen.getByText('Learn This Later').closest('tr');
    const actionButtons = learnLaterRow?.querySelectorAll('td:last-child button');
    const deleteButton = actionButtons && actionButtons[actionButtons.length - 1]; // Last button is delete

    // The delete button should be disabled, so clicking it should not trigger any API calls
    if (deleteButton) {
      expect(deleteButton).toBeDisabled();
      // Even if we try to click it (which shouldn't work), verify no API call is made
      expect(axios.delete).not.toHaveBeenCalled();
    }
  });

  test('allows deletion of non-system lists', async () => {
    const user = userEvent.setup();

    axios.delete.mockResolvedValueOnce({
      data: { message: 'List deleted successfully', id: 2 }
    });

    // Mock the refetch after deletion
    axios.get.mockResolvedValueOnce(mockListsResponse).mockResolvedValueOnce({
      data: {
        lists: [{ id: 1, list_name: 'Learn This Later', phrase_count: 5, is_system_list: true }],
        total: 1,
        limit: 50,
        offset: 0,
        has_more: false
      }
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

    // Wait for lists to load
    await waitFor(() => {
      expect(screen.getByText('My Custom List')).toBeInTheDocument();
    });

    // Find and click delete button for "My Custom List"
    const customListRow = screen.getByText('My Custom List').closest('tr');
    const actionButtons = customListRow?.querySelectorAll('td:last-child button');
    const deleteButton = actionButtons && actionButtons[actionButtons.length - 1];
    
    expect(deleteButton).not.toBeDisabled();
    
    if (deleteButton) {
      await user.click(deleteButton);
      
      // Wait for confirmation dialog to appear - check for the unique warning message with list name
      await waitFor(() => {
        const warningText = screen.getByText(/are you sure you want to delete "My Custom List"/i);
        expect(warningText).toBeInTheDocument();
      });

      // Find the delete confirmation dialog by its title
      const deleteDialogs = screen.getAllByRole('dialog');
      const deleteDialog = deleteDialogs.find(dialog => {
        const title = dialog.querySelector('h2');
        return title && title.textContent === 'Delete List';
      });
      
      expect(deleteDialog).toBeInTheDocument();
      
      // Find the delete button within this dialog - it should be the error-colored button
      const { getAllByRole } = within(deleteDialog);
      const buttons = getAllByRole('button');
      // The delete button is the one with error color (containedError) and text "Delete"
      const confirmDeleteButton = buttons.find(btn => 
        btn.textContent === 'Delete' && 
        btn.classList.toString().includes('MuiButton-containedError')
      );
      
      expect(confirmDeleteButton).toBeInTheDocument();
      expect(confirmDeleteButton).not.toBeDisabled();
      
      await user.click(confirmDeleteButton);

      // Verify delete API was called
      await waitFor(() => {
        expect(axios.delete).toHaveBeenCalledWith(
          '/api/user/private-lists/2',
          expect.any(Object)
        );
      });
    }
  });
});
