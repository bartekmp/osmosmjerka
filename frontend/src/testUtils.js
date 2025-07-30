import React from 'react';
import i18n from './i18n';
import { I18nextProvider } from 'react-i18next';

export function withI18n(children, lng = 'en') {
  i18n.changeLanguage(lng);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
