import React from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, Select, FormControl, Box } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import PropTypes from 'prop-types';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hr', label: 'Hrvatski' },
  { code: 'pl', label: 'Polski' },
];

export default function LanguageSwitcher({ sx = {}, ...props }) {
  const { i18n } = useTranslation();
  const current = i18n.language || 'en';
  const currentCode = (LANGS.find(l => l.code === current)?.code || current || 'en').toUpperCase();

  const handleChange = (e) => {
    i18n.changeLanguage(e.target.value);
    localStorage.setItem('lng', e.target.value);
  };

  return (
    <FormControl
      size="small"
      variant="outlined"
      sx={{
        minWidth: 48,
        minHeight: 40,
        ...sx
      }}
      {...props}
    >
      <Select
        value={current}
        onChange={handleChange}
        displayEmpty
        sx={{
          height: '100%',
          fontSize: { xs: '0.7rem', sm: '0.875rem' }, // Responsive font size
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: { xs: '4px 8px', sm: '8px 12px' }, // Responsive padding
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderWidth: { xs: '1px', sm: '2px' } // Thinner border on mobile
          }
        }}
        renderValue={() => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <LanguageIcon fontSize="small" />
            <span>{currentCode}</span>
          </Box>
        )}
      >
        {LANGS.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ fontWeight: 600, minWidth: 28 }}>{lang.code.toUpperCase()}</span>
              <span>{lang.label}</span>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}


LanguageSwitcher.propTypes = {
  sx: PropTypes.object,
};