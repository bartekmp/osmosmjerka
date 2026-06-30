import { createTheme } from '@mui/material/styles';

const createAppTheme = (isDarkMode = false) => {
  // Single source of truth for every themed colour, resolved once for the
  // current mode. Both the palette tokens and the component styleOverrides
  // below read from this object, so a value is defined in exactly one place.
  const c = {
    // Brand / primary
    primary: '#b89c4e',
    primaryLight: isDarkMode ? '#444' : '#f9e7b3',
    primaryDark: '#8a7429',
    secondary: isDarkMode ? '#6b5b3a' : '#e6c97a',
    // Surfaces & text
    bgDefault: isDarkMode ? '#2a2a2a' : '#f4efe4',
    bgPaper: isDarkMode ? '#3a3a3a' : '#fff8ec',
    paper: isDarkMode ? '#3a3a3a' : '#fff',
    textPrimary: isDarkMode ? '#e0e0e0' : '#333333',
    textSecondary: isDarkMode ? '#b0b0b0' : '#666666',
    // Grid cells
    cellBorder: isDarkMode ? '#6b5b3a' : '#c7a24f',
    cellBg: isDarkMode ? '#4a4a4a' : '#f2e8d6',
    cellHighlight: isDarkMode ? '#5a5a5a' : '#fdf4e2',
    cellSelected: isDarkMode ? '#2a4a5a' : '#cde8f6',
    cellFound: isDarkMode ? '#6b5b3a' : '#e7ce8a',
    gridContainer: isDarkMode ? '#23272e' : '#f5f5f5',
    // Scrabble-style buttons / selects
    scrabbleBg: isDarkMode ? '#4a4a4a' : '#f9e7b3',
    scrabbleBorder: isDarkMode ? '#6b5b3a' : '#b89c4e',
    scrabbleInset: isDarkMode ? '#5a5a5a' : '#fff',
    scrabbleHover: isDarkMode ? '#5a5a5a' : '#f0d99a',
    scrabbleActive: isDarkMode ? '#6b5b3a' : '#e6c97a',
    scrabbleDisabledBg: isDarkMode ? '#3a3a3a' : '#eee6c7',
    scrabbleDisabledText: isDarkMode ? '#666' : '#aaa',
    scrabbleDisabledBorder: isDarkMode ? '#555' : '#d1c18a',
    // Hint button gradient (purple)
    hintGradient: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 100%)',
    hintGradientHover: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
    hintGradientActive: 'linear-gradient(135deg, #7b1fa2 0%, #512da8 100%)',
    // Admin tables
    adminSurface: isDarkMode ? '#3a3a3a' : '#fff8f0',
    adminCellBorder: isDarkMode ? '#555' : '#ddd',
    adminShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
    inputErrorBg: isDarkMode ? '#5a3a3a' : '#ffe6e6',
  };

  const scrabbleBoxShadow = `1px 2px 0 ${c.scrabbleBorder}, 0 1px 0 ${c.scrabbleInset} inset`;

  return createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: c.primary,
        light: c.primaryLight,
        dark: c.primaryDark,
      },
      secondary: {
        main: c.secondary,
      },
      background: {
        default: c.bgDefault,
        paper: c.bgPaper,
      },
      text: {
        primary: c.textPrimary,
        secondary: c.textSecondary,
      },
      // Custom palette entries for grid cells
      grid: {
        cell: {
          border: c.cellBorder,
          background: c.cellBg,
          highlight: c.cellHighlight,
          selected: c.cellSelected,
          found: c.cellFound,
        },
        container: {
          background: c.gridContainer,
        },
      },
      // Custom palette entries for scrabble-style buttons. These are the single
      // source consumed by both the MuiButton override and MobileFloatingActions.
      scrabble: {
        main: c.scrabbleBg,
        border: c.scrabbleBorder,
        inset: c.scrabbleInset,
        hover: c.scrabbleHover,
        active: c.scrabbleActive,
        text: c.textPrimary,
        boxShadow: scrabbleBoxShadow,
        disabled: {
          background: c.scrabbleDisabledBg,
          text: c.scrabbleDisabledText,
          border: c.scrabbleDisabledBorder,
        },
        hint: {
          gradient: c.hintGradient,
          gradientHover: c.hintGradientHover,
          gradientActive: c.hintGradientActive,
        },
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
            background: c.scrabbleBg,
            border: `2px solid ${c.scrabbleBorder}`,
            borderRadius: '7px',
            boxShadow: scrabbleBoxShadow,
            color: c.textPrimary,
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: '1.1em',
            fontWeight: 'bold',
            padding: '0.45em 1.2em',
            margin: '0.2em',
            letterSpacing: '0.04em',
            transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
            textTransform: 'none',
            '&:hover': {
              background: c.scrabbleHover,
              boxShadow: scrabbleBoxShadow,
            },
            '&:active': {
              background: c.scrabbleActive,
              boxShadow: `0 1px 0 ${c.scrabbleBorder} inset`,
              transform: 'translateY(2px)',
            },
            '&:disabled': {
              background: c.scrabbleDisabledBg,
              color: c.scrabbleDisabledText,
              borderColor: c.scrabbleDisabledBorder,
              boxShadow: 'none',
            },
          },
        },
      },
      // Custom scrabble-style select
      MuiSelect: {
        styleOverrides: {
          root: {
            background: c.scrabbleBg,
            border: `2px solid ${c.scrabbleBorder}`,
            borderRadius: '7px',
            boxShadow: scrabbleBoxShadow,
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
            color: c.textPrimary,
            '&.Mui-focused': {
              color: c.textPrimary,
            },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
            '&:hover': {
              background: c.scrabbleHover,
            },
            '&.Mui-selected': {
              background: c.scrabbleActive,
              '&:hover': {
                background: c.scrabbleActive,
              },
            },
          },
        },
      },
      // Note: Grid styles moved to Grid.css for better organization
      // Custom scrabble-style table
      MuiTable: {
        styleOverrides: {
          root: {
            '&.admin-table': {
              borderCollapse: 'separate',
              borderSpacing: 0,
              background: c.adminSurface,
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: c.adminShadow,
            },
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              backgroundColor: c.scrabbleBg,
              border: `2px solid ${c.scrabbleBorder}`,
              borderBottom: `3px solid ${c.scrabbleBorder}`,
              fontWeight: 'bold',
              fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
              color: c.textPrimary,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            '&.admin-cell': {
              border: `1px solid ${c.adminCellBorder}`,
              fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
              backgroundColor: c.adminSurface,
              color: c.textPrimary,
              padding: '8px 12px',
            },
            '&.admin-cell-editable': {
              border: `1px solid ${c.scrabbleBorder}`,
              backgroundColor: c.scrabbleBg,
              fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
              color: c.textPrimary,
              padding: '4px',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: c.paper,
            color: c.textPrimary,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '&.admin-input': {
                background: c.scrabbleBg,
                border: `2px solid ${c.scrabbleBorder}`,
                borderRadius: '4px',
                fontFamily: '"Clear Sans", "Trebuchet MS", "Arial", sans-serif',
                color: c.textPrimary,
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
                  background: c.inputErrorBg,
                  border: '2px solid #ff4444',
                },
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
};

export default createAppTheme;
