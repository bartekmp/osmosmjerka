import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import axios from 'axios';
import PrivateListSelector from '../PrivateListSelector';
import { withI18n } from '../../../../testUtils';
import { STORAGE_KEYS } from '../../../../shared/constants/constants';

jest.mock('axios');

const theme = createTheme();

const mockLists = [
  { id: 1, list_name: 'Learn This Later', phrase_count: 5, is_system_list: true },
  { id: 2, list_name: 'My Custom List', phrase_count: 3, is_system_list: false },
];

describe('PrivateListSelector', () => {
  // Store original console.error
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'test-token');
  });
  
  afterEach(() => {
    // Restore console.error after each test
    console.error = originalConsoleError;
  });

  test('does not render when user is not logged in', () => {
    const { container } = render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={() => {}}
            currentUser={null}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders loading state initially', () => {
    axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={() => {}}
            currentUser={{ id: 1, username: 'testuser' }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('fetches and displays private lists', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { lists: mockLists }
      })
      .mockResolvedValueOnce({
        data: { lists: [] }
      });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={() => {}}
            currentUser={{ id: 1, username: 'testuser' }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/user/private-lists?language_set_id=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      );
    });

    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Open the dropdown to see the menu items
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      // The list items may have emoji prefixes, so use substring matching
      expect(screen.getByText(/Learn This Later/)).toBeInTheDocument();
      expect(screen.getByText(/My Custom List/)).toBeInTheDocument();
    });
  });

  test('calls onListChange when list is selected', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { lists: mockLists }
      })
      .mockResolvedValueOnce({
        data: { lists: [] }
      });

    const onListChange = jest.fn();

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={onListChange}
            currentUser={{ id: 1, username: 'testuser' }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Open the dropdown
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(screen.getByText('My Custom List')).toBeInTheDocument();
    });

    const option = screen.getByText('My Custom List');
    fireEvent.click(option);

    await waitFor(() => {
      expect(onListChange).toHaveBeenCalledWith(2);
    });
  });

  test('shows "Public Categories" as default option', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { lists: mockLists }
      })
      .mockResolvedValueOnce({
        data: { lists: [] }
      });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={() => {}}
            currentUser={{ id: 1, username: 'testuser' }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/public categories/i)).toBeInTheDocument();
    });
  });

  test('displays phrase counts for lists', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { lists: mockLists }
      })
      .mockResolvedValueOnce({
        data: { lists: [] }
      });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={() => {}}
            currentUser={{ id: 1, username: 'testuser' }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Open the dropdown to see the menu items
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(screen.getByText(/\(5\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
  });

  test('shows error message on fetch failure', async () => {
    // Suppress expected console.error for this test
    console.error = jest.fn();
    
    // Both requests must fail for the error to be shown
    // The component uses Promise.all with catch handlers, so individual failures are caught
    // To trigger the outer catch block (which shows error), we need the Promise.all itself to fail
    axios.get.mockImplementation(() => {
      throw new Error('Network error');
    });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={() => {}}
            currentUser={{ id: 1, username: 'testuser' }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  test('shows "no lists yet" when user has no lists', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { lists: [] }
      })
      .mockResolvedValueOnce({
        data: { lists: [] }
      });

    render(
      withI18n(
        <ThemeProvider theme={theme}>
          <PrivateListSelector
            selectedListId={null}
            onListChange={() => {}}
            currentUser={{ id: 1, username: 'testuser' }}
            languageSetId={1}
          />
        </ThemeProvider>
      )
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Open the dropdown to see the menu items
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      // Use the exact text from the translation
      expect(screen.getByText(/No private lists yet/i)).toBeInTheDocument();
    });
  });
});
