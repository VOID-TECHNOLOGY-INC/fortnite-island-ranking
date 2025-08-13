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
    <select aria-label="Language" value={lng} onChange={(e) => change(e.target.value as any)}>
      <option value="ja">日本語</option>
      <option value="en">EN</option>
    </select>
  );
}


