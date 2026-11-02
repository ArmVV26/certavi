import type { UIMatch } from 'react-router';
import type { IconName } from '../ui/Icon';

export type NavKey = 'today' | 'calendar' | 'routines' | 'progress' | 'settings';

export const NAV_ITEMS: readonly { to: string; key: NavKey; icon: IconName }[] = [
  { to: '/', key: 'today', icon: 'today' },
  { to: '/calendar', key: 'calendar', icon: 'calendar' },
  { to: '/routines', key: 'routines', icon: 'routines' },
  { to: '/progress', key: 'progress', icon: 'progress' },
  { to: '/settings', key: 'settings', icon: 'settings' },
];

/** i18n key of a page title. Each route declares one in its `handle`. */
export type TitleKey = `nav.${NavKey}` | 'devUi.title' | 'notFound.title';

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
