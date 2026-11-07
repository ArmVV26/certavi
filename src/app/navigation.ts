import type { UIMatch } from 'react-router';
import type { IconName } from '../ui/Icon';

export type NavKey = 'today' | 'calendar' | 'routines' | 'progress' | 'settings';

interface NavItem {
  to: string;
  key: NavKey;
  icon: IconName;
  /** Other sections that belong to this tab (the exercises live inside Routines). */
  also?: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', key: 'today', icon: 'today' },
  { to: '/calendar', key: 'calendar', icon: 'calendar' },
  { to: '/routines', key: 'routines', icon: 'routines', also: ['/exercises'] },
  { to: '/progress', key: 'progress', icon: 'progress' },
  { to: '/settings', key: 'settings', icon: 'settings' },
];

/** The tab is the current one: the path is its own or inside one of its sections. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/';
  return [item.to, ...(item.also ?? [])].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/** i18n key of a page title. Each route declares one in its `handle`. */
export type TitleKey =
  | `nav.${NavKey}`
  | 'session.title'
  | 'settings.sync.title'
  | 'blocksPage.title'
  | 'blocksPage.trackingTitle'
  | 'blocksPage.newTitle'
  | 'blocksPage.editTitle'
  | 'devUi.title'
  | 'notFound.title'
  | 'exercises.title'
  | 'exercises.detail.title'
  | 'exercises.form.createTitle'
  | 'exercises.form.editTitle'
  | 'routines.view.title'
  | 'routines.edit.title';

export interface RouteHandle {
  titleKey: TitleKey;
}

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === 'object' && handle !== null && 'titleKey' in handle;
}

/** Title of the deepest matched route that declares one. */
export function titleKeyOf(matches: readonly UIMatch[]): TitleKey {
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const handle = matches[i]?.handle;
    if (isRouteHandle(handle)) return handle.titleKey;
  }
  return 'nav.today';
}
