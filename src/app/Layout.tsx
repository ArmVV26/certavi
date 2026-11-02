import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useMatches } from 'react-router';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Icon } from '../ui/Icon';
import styles from './Layout.module.css';
import { NAV_ITEMS, titleKeyOf } from './navigation';

/**
 * App shell: header with the page title and the theme button, the main navigation (bottom tab
 * bar on phones, top bar on wide screens) and the current page.
 */
export function Layout() {
  const { t } = useTranslation();
  const matches = useMatches();
  const { pathname } = useLocation();
  const title = t(titleKeyOf(matches));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstPage = useRef(true);

  useEffect(() => {
    document.title = t('app.documentTitle', { page: title });
  }, [t, title]);

  // After navigating, move focus to the new page title so screen readers announce it.
  useEffect(() => {
    if (isFirstPage.current) {
      isFirstPage.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        {t('app.skipToContent')}
      </a>
      <header className={styles.header}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <nav className={styles.nav} aria-label={t('nav.label')}>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to} className={styles.navItem}>
                <NavLink to={item.to} end={item.to === '/'} className={styles.navLink}>
                  <Icon name={item.icon} size={24} />
                  <span>{t(`nav.${item.key}`)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
