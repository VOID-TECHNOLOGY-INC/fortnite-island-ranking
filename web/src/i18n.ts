import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';
import ja from './locales/ja/common.json';

const stored = localStorage.getItem('lang');
const lng = stored || (navigator.language.startsWith('ja') ? 'ja' : 'en');

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ja: { translation: ja } },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;


