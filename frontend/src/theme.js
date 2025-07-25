import { createTheme } from '@mui/material/styles';

const createAppTheme = (isDarkMode = false) => createTheme({
  palette: {
    mode: isDarkMode ? 'dark' : 'light',
    primary: {
      main: '#b89c4e',
      light: isDarkMode ? '#444' : '#f9e7b3',
      dark: '#8a7429',
    },
    secondary: {
      main: isDarkMode ? '#6b5b3a' : '#e6c97a',
    },
    background: {
      default: isDarkMode ? '#2a2a2a' : '#fafafa',
      paper: isDarkMode ? '#3a3a3a' : '#ffffff',
    },
    text: {
      primary: isDarkMode ? '#e0e0e0' : '#333333',
      secondary: isDarkMode ? '#b0b0b0' : '#666666',
    },
  },
  typography: {
    fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
    h1: {
      fontFamily: '"Roboto Mono", "Clear Sans", monospace, sans-serif',
      fontWeight: 700,
      letterSpacing: '2px',
    },
  },
  components: {
    // Custom scrabble-style button
    MuiButton: {
      styleOverrides: {
        root: {
          background: isDarkMode ? '#4a4a4a' : '#f9e7b3',
          border: `2px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
          borderRadius: '7px',
          boxShadow: `1px 2px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'}, 0 1px 0 ${isDarkMode ? '#5a5a5a' : '#fff'} inset`,
          color: isDarkMode ? '#e0e0e0' : '#333',
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '1.1em',
          fontWeight: 'bold',
          padding: '0.45em 1.2em',
          margin: '0.2em',
          letterSpacing: '0.04em',
          transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
          textTransform: 'none',
          '&:hover': {
            background: isDarkMode ? '#5a5a5a' : '#f0d99a',
            boxShadow: `1px 2px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'}, 0 1px 0 ${isDarkMode ? '#5a5a5a' : '#fff'} inset`,
          },
          '&:active': {
            background: isDarkMode ? '#6b5b3a' : '#e6c97a',
            boxShadow: `0 1px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'} inset`,
            transform: 'translateY(2px)',
          },
          '&:disabled': {
            background: isDarkMode ? '#3a3a3a' : '#eee6c7',
            color: isDarkMode ? '#666' : '#aaa',
            borderColor: isDarkMode ? '#555' : '#d1c18a',
            boxShadow: 'none',
          },
        },
      },
    },
    // Custom scrabble-style select
    MuiSelect: {
      styleOverrides: {
        root: {
          background: isDarkMode ? '#4a4a4a' : '#f9e7b3',
          border: `2px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
          borderRadius: '7px',
          boxShadow: `1px 2px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'}, 0 1px 0 ${isDarkMode ? '#5a5a5a' : '#fff'} inset`,
          fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
          fontWeight: 500,
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
          fontWeight: 600,
          color: isDarkMode ? '#e0e0e0' : '#333',
          '&.Mui-focused': {
            color: isDarkMode ? '#e0e0e0' : '#333',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
          '&:hover': {
            background: isDarkMode ? '#5a5a5a' : '#f0d99a',
          },
          '&.Mui-selected': {
            background: isDarkMode ? '#6b5b3a' : '#e6c97a',
            '&:hover': {
              background: isDarkMode ? '#6b5b3a' : '#e6c97a',
            },
          },
        },
      },
    },
    // Custom scrabble-style grid container
    MuiBox: {
      styleOverrides: {
        root: {
          '&.grid-container': {
            backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f5f5',
            borderRadius: '8px',
            boxShadow: isDarkMode ? '0 4px 8px rgba(0,0,0,0.3)' : '0 4px 8px rgba(0,0,0,0.1)',
            padding: '4px',
            touchAction: 'none',
          },
          '&.grid-cell': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
            borderRadius: '4px',
            boxShadow: `1px 2px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'}, 0 1px 0 ${isDarkMode ? '#5a5a5a' : '#fff'} inset`,
            cursor: 'pointer',
            fontWeight: 500,
            background: isDarkMode ? '#4a4a4a' : '#EDEDED',
            color: isDarkMode ? '#e0e0e0' : '#333',
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            letterSpacing: '0.03em',
            transition: 'background 0.2s, box-shadow 0.2s',
            userSelect: 'none',
            lineHeight: 1,
            fontWeight: 'bold',
            '&.selected': {
              background: isDarkMode ? '#5a6b8a' : '#b3e5ff',
            },
            '&.found': {
              background: isDarkMode ? '#6b5b3a' : '#e6c97a',
            },
          },
        },
      },
    },
    // Custom scrabble-style table
    MuiTable: {
      styleOverrides: {
        root: {
          '&.admin-table': {
            borderCollapse: 'separate',
            borderSpacing: 0,
            background: isDarkMode ? '#3a3a3a' : '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: isDarkMode ? '#4a4a4a' : '#f9e7b3',
            border: `2px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
            borderBottom: `3px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
            fontWeight: 'bold',
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            color: isDarkMode ? '#e0e0e0' : '#333',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          '&.admin-cell': {
            border: `1px solid ${isDarkMode ? '#555' : '#ddd'}`,
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            backgroundColor: isDarkMode ? '#3a3a3a' : '#fff',
            color: isDarkMode ? '#e0e0e0' : '#333',
            padding: '8px 12px',
          },
          '&.admin-cell-editable': {
            border: `1px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
            backgroundColor: isDarkMode ? '#4a4a4a' : '#f9e7b3',
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            color: isDarkMode ? '#e0e0e0' : '#333',
            padding: '4px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: isDarkMode ? '#3a3a3a' : '#fff',
          color: isDarkMode ? '#e0e0e0' : '#333',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&.admin-input': {
              background: isDarkMode ? '#4a4a4a' : '#f9e7b3',
              border: `2px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
              borderRadius: '4px',
              fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
              color: isDarkMode ? '#e0e0e0' : '#333',
              '& fieldset': {
                border: 'none',
              },
              '&:hover fieldset': {
                border: 'none',
              },
              '&.Mui-focused fieldset': {
                border: 'none',
              },
              '&.Mui-error': {
                background: isDarkMode ? '#5a3a3a' : '#ffe6e6',
                border: '2px solid #ff4444',
              },
            },
          },
        },
      },
    },
    // Grid cell styling
    MuiGrid: {
      styleOverrides: {
        item: {
          '&.grid-cell': {
            border: '2px solid #b89c4e',
            aspectRatio: '1 / 1',
            textAlign: 'center',
            borderRadius: '4px',
            boxShadow: '1px 2px 0 #b89c4e, 0 1px 0 #fff inset',
            cursor: 'pointer',
            fontWeight: 500,
            background: '#EDEDED',
            color: '#333',
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            fontSize: '1.35em',
            letterSpacing: '0.03em',
            transition: 'background 0.2s, box-shadow 0.2s',
            userSelect: 'none',
            padding: '0.4em',
            lineHeight: 1,
            '&.selected': {
              background: '#b3e5ff',
            },
            '&.found': {
              background: '#e6c97a',
            },
          },
        },
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
});

export default createAppTheme;
