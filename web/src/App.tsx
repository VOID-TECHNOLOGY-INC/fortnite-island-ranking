import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';

export default function App() {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <div className="app">
      <header className="header">
        <div className="brand"><Link to="/">Fortnite Island Ranking</Link></div>
        <nav className="nav">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>{t('nav.home')}</Link>
          <Link to="/compare" className={location.pathname === '/compare' ? 'active' : ''}>{t('nav.compare')}</Link>
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


