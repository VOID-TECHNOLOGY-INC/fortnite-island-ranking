import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const change = (lng: 'en' | 'ja') => {
    i18n.changeLanguage(lng);
    localStorage.setItem('lang', lng);
    // update html lang
    document.documentElement.lang = lng;
  };
  const lng = i18n.language.startsWith('ja') ? 'ja' : 'en';
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => change('ja')} aria-pressed={lng === 'ja'}>日本語</button>
      <button onClick={() => change('en')} aria-pressed={lng === 'en'}>EN</button>
    </div>
  );
}


