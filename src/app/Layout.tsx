import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useMatches, useNavigation } from 'react-router';
import { useCloseFinishedWeeks } from '../data/useCloseFinishedWeeks';
import { useToday } from '../features/today/useToday';
import { SyncIndicator } from '../features/settings/SyncIndicator';
import { ThemeToggle } from '../theme/ThemeToggle';
import { cx } from '../ui/cx';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import styles from './Layout.module.css';
import { NAV_ITEMS, isNavItemActive, titleKeyOf } from './navigation';
import { UpdatePrompt } from './pwa/UpdatePrompt';

/**
 * App shell: header with the page title, the sync indicator and the theme button, the main navigation (bottom tab
 * bar on phones, top bar on wide screens) and the current page.
 */
export function Layout() {
  const { t } = useTranslation();
  const matches = useMatches();
  const navigation = useNavigation();
  const { pathname, key } = useLocation();
  const title = t(titleKeyOf(matches));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstPage = useRef(true);
  useCloseFinishedWeeks(useToday());

  useEffect(() => {
    document.title = t('app.documentTitle', { page: title });
  }, [t, title]);

  // After navigating, move focus to the new page title so screen readers announce it. It runs
  // before the new page is painted (layout effect): a passive effect could run after the user
  // had already tapped a field of the new page and take the focus (and the typing) away from it.
  useLayoutEffect(() => {
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
      <div className={styles.top}>
        <header className={styles.header}>
          <Logo className={styles.logo} />
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {title}
          </h1>
          <nav className={styles.nav} aria-label={t('nav.label')}>
            <ul className={styles.navList}>
              {NAV_ITEMS.map((item) => (
                <li key={item.to} className={styles.navItem}>
                  <Link
                    to={item.to}
                    className={styles.navLink}
                    aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
                  >
                    <Icon name={item.icon} size={24} />
                    <span>{t(`nav.${item.key}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <SyncIndicator />
          <ThemeToggle />
        </header>
        <UpdatePrompt />
        {/* A tap on a tab never looks ignored: while the next screen's file loads, a line runs. */}
        {navigation.state !== 'idle' && (
          <div role="progressbar" aria-label={t('app.loading')} className={styles.pending} />
        )}
      </div>
      {/* Keyed by path: each section fades in on arrival. The first page does not (its key is
          "default"), so the app opens without an animation. */}
      <main
        key={pathname}
        id="main"
        tabIndex={-1}
        className={cx(styles.main, key !== 'default' && styles.arriving)}
      >
        <Outlet />
      </main>
    </div>
  );
}
