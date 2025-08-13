import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';

export default function App() {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Link to="/" className="rowlink" aria-label="Fortnite Island Ranking">
            <img src="/top_banner.svg" alt="Fortnite Island Ranking" className="brand-logo" />
          </Link>
        </div>
        <nav className="nav">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>{t('nav.home')}</Link>
        </nav>
        <LanguageSwitcher />
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <span>{t('footer.note')}</span>
      </footer>
    </div>
  );
}


