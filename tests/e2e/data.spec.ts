import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  boxOf,
  expectTheme,
  gotoReady,
  h1,
  hasHorizontalScroll,
  mainNav,
  setLanguage,
} from './helpers';

// Spec: docs/spec/data-import-export.md §2 (Part A — the "Datos" / "Data" card).

/** Rows of the card on a new device, in the order of the spec: [es, en, count]. */
const ROWS: readonly (readonly [string, string, string])[] = [
  ['Ejercicios', 'Exercises', '45'],
  ['Rutinas', 'Routines', '6'],
  ['Sesiones', 'Sessions', '0'],
  ['Series', 'Sets', '0'],
  ['Notas de ejercicio', 'Exercise notes', '0'],
  ['Actividades', 'Activities', '0'],
  ['Pesos semanales', 'Weekly body weights', '0'],
  ['Semanas', 'Weeks', '0'],
  ['Bloques opcionales', 'Optional blocks', '2'],
  ['Registros de bloques', 'Block logs', '0'],
  ['Métricas semanales', 'Weekly metrics', '0'],
  ['Pendientes de sincronizar', 'Waiting to sync', '0'],
];

const STORAGE_ES = {
  term: 'Almacenamiento',
  values: [
    'Persistente',
    'El navegador podría borrarlo si falta espacio',
    'Sin información del navegador',
  ],
};
const STORAGE_EN = {
  term: 'Storage',
  values: [
    'Persistent',
    'The browser may delete it if space runs low',
    'No information from the browser',
  ],
};

/** Accessible name of the counts list in Spanish (given by the phase's acceptance criteria). */
const LIST_LABEL_ES = 'Datos guardados en este dispositivo';

type Lang = 'es' | 'en';

function expectedCounts(lang: Lang): [string, string][] {
  return ROWS.map(([es, en, n]) => [lang === 'es' ? es : en, n]);
}

/** The description list of the card. */
function countsList(page: Page, lang: Lang): Locator {
  return lang === 'es'
    ? page.getByLabel(LIST_LABEL_ES, { exact: true })
    : // The spec gives no English label for the list: find it as the one that holds "Exercises".
      page.locator('dl').filter({ has: page.getByRole('term').filter({ hasText: /^Exercises$/ }) });
}

/** Reads the list as [term, value] pairs, once loading has finished. */
async function readRows(list: Locator): Promise<[string, string][]> {
  const terms = list.getByRole('term');
  const defs = list.getByRole('definition');
  const t = (await terms.allInnerTexts()).map((s) => s.trim());
  const d = (await defs.allInnerTexts()).map((s) => s.trim());
  return t.map((term, i) => [term, d[i] ?? '']);
}

/** Waits until the card shows the counts of a new device (storage row excluded). */
async function expectNewDeviceCounts(page: Page, lang: Lang): Promise<void> {
  const list = countsList(page, lang);
  const firstTerm = lang === 'es' ? 'Ejercicios' : 'Exercises';
  // Wait for the real numbers (not a loading placeholder).
  await expect(
    list.getByRole('term').filter({ hasText: new RegExp(`^${firstTerm}$`) }),
  ).toBeVisible();
  await expect(
    page.getByText(lang === 'es' ? 'Cargando…' : 'Loading…', { exact: true }),
  ).toHaveCount(0);
  const storageTerm = lang === 'es' ? STORAGE_ES.term : STORAGE_EN.term;
  await expect
    .poll(async () => (await readRows(list)).filter(([term]) => term !== storageTerm))
    .toEqual(expectedCounts(lang));
}

/** The value shown next to the storage term, wherever the row lives in the card. */
async function storageValue(page: Page, term: string): Promise<string> {
  const dt = page.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) });
  await expect(dt).toHaveCount(1);
  await expect(dt).toBeVisible();
  const dd = dt.locator('xpath=following-sibling::*[1]');
  await expect(dd).toBeVisible();
  return (await dd.innerText()).trim();
}

test.describe('data card', () => {
  test(
    'AC-DATA-01 · a new device shows the built-in data, in order, between Apariencia and Desarrollo',
    { tag: '@all-engines' },
    async ({ page }) => {
      await gotoReady(page, '/settings', 'Ajustes');
      const heading = page.getByRole('heading', { name: 'Datos', exact: true });
      await expect(heading).toBeVisible();
      await expect(
        page.getByText('Todo se guarda primero en este dispositivo.', { exact: true }),
      ).toBeVisible();

      await expectNewDeviceCounts(page, 'es');

      // Placed after "Apariencia" and before "Desarrollo".
      const appearance = await boxOf(page.getByText('Apariencia', { exact: true }).first());
      const data = await boxOf(heading);
      const developer = await boxOf(page.getByText('Desarrollo', { exact: true }).first());
      expect(data.y).toBeGreaterThan(appearance.y);
      expect(data.y).toBeLessThan(developer.y);
    },
  );

  test(
    'AC-DATA-02 · reloading and reopening keeps the counts (no duplicated built-in data)',
    { tag: '@all-engines' },
    async ({ page, context }) => {
      await gotoReady(page, '/settings', 'Ajustes');
      await expectNewDeviceCounts(page, 'es');

      await page.reload();
      await expect(h1(page, 'Ajustes')).toBeVisible();
      await expectNewDeviceCounts(page, 'es');

      // Close the tab and open the app again (same browser profile).
      await page.close();
      const again = await context.newPage();
      await gotoReady(again, '/', 'Hoy');
      await mainNav(again).getByRole('link', { name: 'Ajustes', exact: true }).click();
      await expect(h1(again, 'Ajustes')).toBeVisible();
      await expectNewDeviceCounts(again, 'es');
    },
  );

  test(
    'AC-DATA-03 · the storage row shows one of the three texts',
    { tag: '@all-engines' },
    async ({ page }) => {
      await gotoReady(page, '/settings', 'Ajustes');
      await expectNewDeviceCounts(page, 'es');
      await expect
        .poll(() => storageValue(page, STORAGE_ES.term))
        .toMatch(new RegExp(`^(${STORAGE_ES.values.join('|')})$`));
    },
  );

  test('AC-DATA-04 · in English the card is "Data" with the English labels', async ({ page }) => {
    await setLanguage(page, 'en');
    await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible();
    await expect(
      page.getByText('Everything is saved on this device first.', { exact: true }),
    ).toBeVisible();
    await expectNewDeviceCounts(page, 'en');
    await expect
      .poll(() => storageValue(page, STORAGE_EN.term))
      .toMatch(new RegExp(`^(${STORAGE_EN.values.join('|')})$`));
    // No Spanish row label is left.
    for (const [es] of ROWS) {
      await expect(page.getByRole('term').filter({ hasText: new RegExp(`^${es}$`) })).toHaveCount(
        0,
      );
    }
    await expect(page.getByRole('term').filter({ hasText: /^Almacenamiento$/ })).toHaveCount(0);

    // Reload: still English, same counts.
    await page.reload();
    await expect(h1(page, 'Settings')).toBeVisible();
    await expectNewDeviceCounts(page, 'en');
  });

  // Axe once per theme on /settings. Its results do not depend on the engine, so Chromium only.
  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-DATA-05 · /settings with the card: no serious axe issues, no horizontal scroll (${scheme})`, async ({
      page,
      browserName,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await gotoReady(page, '/settings', 'Ajustes');
      await expectTheme(page, scheme);
      await expectNewDeviceCounts(page, 'es');
      await storageValue(page, STORAGE_ES.term);

      // Readable at 390×844: nothing sticks out sideways.
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      expect(await hasHorizontalScroll(page)).toBe(false);
      const list = countsList(page, 'es');
      await list.scrollIntoViewIfNeeded();
      const box = await boxOf(list);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      // The longest label and its number fit on screen.
      const longest = await boxOf(
        list.getByRole('term').filter({ hasText: /^Pendientes de sincronizar$/ }),
      );
      expect(longest.x + longest.width).toBeLessThanOrEqual(390);

      // axe runs once, in Chromium (WebKit still checks the layout above).
      if (browserName !== 'chromium') return;
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      const summary = serious.map(
        (v) =>
          `${v.id} [${String(v.impact)}]: ${v.help}\n` +
          v.nodes
            .slice(0, 5)
            .map((n) => `   - ${n.target.join(' ')} :: ${n.failureSummary ?? ''}`)
            .join('\n'),
      );
      expect(serious, `/settings (${scheme})\n${summary.join('\n')}`).toEqual([]);
    });
  }

  test(
    'edge · two tabs show the same counts, and the card still works offline',
    { tag: '@all-engines' },
    async ({ page, context }) => {
      await gotoReady(page, '/settings', 'Ajustes');
      const second = await context.newPage();
      await gotoReady(second, '/settings', 'Ajustes');
      await expectNewDeviceCounts(page, 'es');
      await expectNewDeviceCounts(second, 'es');
      await second.close();

      // Offline: nothing comes from the network, so leaving and coming back shows the same card.
      await context.setOffline(true);
      await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
      await expect(h1(page, 'Hoy')).toBeVisible();
      await mainNav(page).getByRole('link', { name: 'Ajustes', exact: true }).click();
      await expect(h1(page, 'Ajustes')).toBeVisible();
      await expectNewDeviceCounts(page, 'es');
      await context.setOffline(false);
    },
  );
});
