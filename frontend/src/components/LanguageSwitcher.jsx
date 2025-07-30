import React from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, Select, FormControl, Box } from '@mui/material';

const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hr', label: 'Hrvatski', flag: '🇭🇷' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language || 'en';
  const currentFlag = LANGS.find(l => l.code === current)?.flag || '🌐';

  const handleChange = (e) => {
    i18n.changeLanguage(e.target.value);
    localStorage.setItem('lng', e.target.value);
  };

  return (
    <FormControl size="small" variant="outlined" sx={{ minWidth: 72, minHeight: 48 }}>
      <Select
        value={current}
        onChange={handleChange}
        displayEmpty
        renderValue={() => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 22 }}>{currentFlag}</span>
          </Box>
        )}
      >
        {LANGS.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 22 }}>{lang.flag}</span>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
