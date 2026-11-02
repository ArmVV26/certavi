import { useEffect, useEffectEvent } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Open modals, topmost last: only the top one reacts to Escape and Tab. */
const openModals: symbol[] = [];

interface UseModalOptions {
  /** The dialog panel. Its closest [data-modal-layer] ancestor stays interactive. */
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Element to focus on open; defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Modal behaviour shared by Dialog and Sheet, while mounted:
 * - focus moves inside and Tab / Shift+Tab cycle within it (focus trap);
 * - Escape closes it;
 * - everything else on the page is `inert` (no clicks, no focus, hidden from readers);
 * - the page does not scroll behind it;
 * - on close, focus returns to the element that opened it.
 */
export function useModal({ containerRef, onClose, initialFocusRef }: UseModalOptions): void {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const id = Symbol('modal');
    openModals.push(id);
    const isTopmost = () => openModals.at(-1) === id;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const layer = container.closest('[data-modal-layer]') ?? container;
    const madeInert = [...document.body.children].filter(
      (element) => element !== layer && !element.hasAttribute('inert'),
    );
    for (const element of madeInert) element.setAttribute('inert', '');

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    (initialFocusRef?.current ?? focusableIn(container)[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusableIn(container);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        container.focus();
        return;
      }
      const active = document.activeElement;
      const outside = !container.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(id), 1);
      for (const element of madeInert) element.removeAttribute('inert');
      body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [containerRef, initialFocusRef]);
}
