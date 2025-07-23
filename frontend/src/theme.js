import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#b89c4e',
      light: '#f9e7b3',
      dark: '#8a7429',
    },
    secondary: {
      main: '#e6c97a',
    },
    background: {
      default: '#fafafa',
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
          background: '#f9e7b3',
          border: '2px solid #b89c4e',
          borderRadius: '7px',
          boxShadow: '1px 2px 0 #b89c4e, 0 1px 0 #fff inset',
          color: '#333',
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '1.1em',
          fontWeight: 'bold',
          padding: '0.45em 1.2em',
          margin: '0.2em',
          letterSpacing: '0.04em',
          transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
          textTransform: 'none',
          '&:hover': {
            background: '#f0d99a',
            boxShadow: '1px 2px 0 #b89c4e, 0 1px 0 #fff inset',
          },
          '&:active': {
            background: '#e6c97a',
            boxShadow: '0 1px 0 #b89c4e inset',
            transform: 'translateY(2px)',
          },
          '&:disabled': {
            background: '#eee6c7',
            color: '#aaa',
            borderColor: '#d1c18a',
            boxShadow: 'none',
          },
        },
      },
    },
    // Custom scrabble-style select
    MuiSelect: {
      styleOverrides: {
        root: {
          background: '#f9e7b3',
          border: '2px solid #b89c4e',
          borderRadius: '7px',
          boxShadow: '1px 2px 0 #b89c4e, 0 1px 0 #fff inset',
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
          color: '#333',
          '&.Mui-focused': {
            color: '#333',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
          '&:hover': {
            background: '#f0d99a',
          },
          '&.Mui-selected': {
            background: '#e6c97a',
            '&:hover': {
              background: '#e6c97a',
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
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            padding: '4px',
            touchAction: 'none',
          },
          '&.grid-cell': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #b89c4e',
            borderRadius: '4px',
            boxShadow: '1px 2px 0 #b89c4e, 0 1px 0 #fff inset',
            cursor: 'pointer',
            fontWeight: 500,
            background: '#EDEDED',
            color: '#333',
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            letterSpacing: '0.03em',
            transition: 'background 0.2s, box-shadow 0.2s',
            userSelect: 'none',
            lineHeight: 1,
            fontWeight: 'bold',
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
    // Custom scrabble-style table
    MuiTable: {
      styleOverrides: {
        root: {
          '&.admin-table': {
            borderCollapse: 'separate',
            borderSpacing: 0,
            background: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: '#f9e7b3',
            border: '2px solid #b89c4e',
            borderBottom: '3px solid #b89c4e',
            fontWeight: 'bold',
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            color: '#333',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          '&.admin-cell': {
            border: '1px solid #e0e0e0',
            padding: '8px 12px',
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
          },
          '&.admin-cell-editable': {
            padding: '4px',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&.admin-input': {
              background: '#f9e7b3',
              border: '2px solid #b89c4e',
              borderRadius: '4px',
              fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
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
                background: '#ffe6e6',
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

export default theme;
