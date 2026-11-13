import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { expectTheme, gotoReady, h1, setLanguage } from './helpers';

// Spec: docs/spec/data-import-export.md §3 (Part B — import and export).

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures');
const GYM_SAMPLE = path.join(FIXTURES, 'gym-app-sample.json');
const TEXT_FILE = path.join(FIXTURES, 'not-a-backup.txt');

type Lang = 'es' | 'en';
type Rows = [string, string][];

/** Card rows: [es, en, on a new device, after importing the sample file]. */
const COUNTS: readonly (readonly [string, string, string, string])[] = [
  ['Ejercicios', 'Exercises', '45', '45'],
  ['Rutinas', 'Routines', '6', '6'],
  ['Sesiones', 'Sessions', '0', '3'],
  ['Series', 'Sets', '0', '11'],
  ['Notas de ejercicio', 'Exercise notes', '0', '2'],
  ['Actividades', 'Activities', '0', '2'],
  ['Pesos semanales', 'Weekly body weights', '0', '2'],
  ['Semanas', 'Weeks', '0', '2'],
  ['Bloques opcionales', 'Optional blocks', '2', '2'],
  ['Registros de bloques', 'Block logs', '0', '2'],
  ['Métricas semanales', 'Weekly metrics', '0', '1'],
  ['Pendientes de sincronizar', 'Waiting to sync', '0', '29'],
];

/** Preview of the sample file on a new device: [es, en, count]. */
const PREVIEW: readonly (readonly [string, string, string])[] = [
  ['Ejercicios', 'Exercises', '2'],
  ['Rutinas', 'Routines', '1'],
  ['Sesiones', 'Sessions', '3'],
  ['Series', 'Sets', '11'],
  ['Notas de ejercicio', 'Exercise notes', '2'],
  ['Actividades', 'Activities', '2'],
  ['Pesos semanales', 'Weekly body weights', '2'],
  ['Semanas', 'Weeks', '2'],
  ['Bloques opcionales', 'Optional blocks', '1'],
  ['Registros de bloques', 'Block logs', '2'],
  ['Métricas semanales', 'Weekly metrics', '1'],
  ['Ignorados (borrados o ajustes internos)', 'Ignored (deleted or internal settings)', '5'],
];

const T = {
  es: {
    settings: 'Ajustes',
    importHeading: 'Importar',
    exportHeading: 'Exportar',
    importGym: 'Importar desde la app anterior',
    importCertavi: 'Importar copia de Certavi',
    exportJson: 'Exportar copia completa (.json)',
    exportSets: 'Exportar series (.csv)',
    exportActivity: 'Exportar actividad y peso (.csv)',
    willSave: 'Se guardará en este dispositivo:',
    summary: 'Resumen de la importación',
    cancel: 'Cancelar',
    confirm: 'Importar',
    close: 'Cerrar',
    nothingNew: 'No hay nada nuevo que importar.',
    unchanged: 'Sin cambios (ya estaban)',
    imported: (n: number | string) => `Registros importados: ${String(n)}`,
    notGym: 'Este archivo no es una copia completa de la app anterior.',
    notCertavi: 'Este archivo no es una copia de Certavi.',
    loading: 'Cargando…',
    storage: 'Almacenamiento',
    pending: 'Pendientes de sincronizar',
  },
  en: {
    settings: 'Settings',
    importHeading: 'Import',
    exportHeading: 'Export',
    importGym: 'Import from the previous app',
    importCertavi: 'Import a Certavi backup',
    exportJson: 'Export full backup (.json)',
    exportSets: 'Export sets (.csv)',
    exportActivity: 'Export activity and weight (.csv)',
    willSave: 'This will be saved on this device:',
    summary: 'Import summary',
    cancel: 'Cancel',
    confirm: 'Import',
    close: 'Close',
    nothingNew: 'There is nothing new to import.',
    unchanged: 'Unchanged (already here)',
    imported: (n: number | string) => `Records imported: ${String(n)}`,
    notGym: 'This file is not a full backup of the previous app.',
    notCertavi: 'This file is not a Certavi backup.',
    loading: 'Loading…',
    storage: 'Storage',
    pending: 'Waiting to sync',
  },
} as const;

const SETS_HEADER_ES =
  'fecha;sesion;ejercicio;tipo_serie;orden;peso_kg;reps;rir;straps;banda;e1rm_kg;cuenta_como_efectiva;nota_ejercicio;nota_sesion';
const ACTIVITY_HEADER_ES = 'fecha;tipo;actividad;minutos;peso_kg;nota';

function countsFor(lang: Lang, when: 'new' | 'after'): Rows {
  return COUNTS.map(([es, en, n, a]) => [lang === 'es' ? es : en, when === 'new' ? n : a]);
}

function previewFor(lang: Lang): Rows {
  return PREVIEW.map(([es, en, n]) => [lang === 'es' ? es : en, n]);
}

/** The counts list of the card (the one with the "waiting to sync" row, never the preview). */
function countsList(page: Page, lang: Lang): Locator {
  return page.locator('dl').filter({
    has: page
      .getByRole('term', { includeHidden: true })
      .filter({ hasText: new RegExp(`^${T[lang].pending}$`) }),
  });
}

/** Reads a description list as [term, value] pairs (also while a modal dialog covers it). */
async function readDl(list: Locator): Promise<Rows> {
  const t = (await list.getByRole('term', { includeHidden: true }).allInnerTexts()).map((s) =>
    s.trim(),
  );
  const d = (await list.getByRole('definition', { includeHidden: true }).allInnerTexts()).map((s) =>
    s.trim(),
  );
  return t.map((term, i) => [term, d[i] ?? '']);
}

/** Card counts, without the storage row. */
async function readCounts(page: Page, lang: Lang): Promise<Rows> {
  return (await readDl(countsList(page, lang))).filter(([term]) => term !== T[lang].storage);
}

async function expectCounts(page: Page, lang: Lang, expected: Rows): Promise<void> {
  await expect(page.getByText(T[lang].loading, { exact: true })).toHaveCount(0);
  await expect.poll(() => readCounts(page, lang)).toEqual(expected);
}

/** Rows of the "Import summary" list, whether it is a <dl> or a list of items. */
async function readSummary(dialog: Locator, lang: Lang): Promise<Rows> {
  const list = dialog.getByLabel(T[lang].summary, { exact: true });
  if ((await list.getByRole('term').count()) > 0) return readDl(list);
  const items = await list.getByRole('listitem').allInnerTexts();
  return items.map((s) => {
    const m = /^([\s\S]*?)\s*(\d[\d.,]*)$/.exec(s.trim());
    return m ? [(m[1] ?? '').trim(), m[2] ?? ''] : [s.trim(), ''];
  });
}

function toast(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

/** The import preview. The spec says "a dialog"; it may be exposed as dialog or alertdialog. */
function dialogOf(page: Page, name: string): Locator {
  return page
    .getByRole('dialog', { name, exact: true })
    .or(page.getByRole('alertdialog', { name, exact: true }));
}

/** Any open dialog (dialog or alertdialog). */
function anyDialog(page: Page): Locator {
  return page.getByRole('dialog').or(page.getByRole('alertdialog'));
}

/** Taps an import button and chooses a file in the picker. */
async function chooseFile(
  page: Page,
  button: string,
  file: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: button, exact: true }).click();
  await (await chooser).setFiles(file);
}

/** Taps an export button and saves the downloaded file in the test output folder. */
async function download(
  page: Page,
  button: string,
  testInfo: TestInfo,
): Promise<{ name: string; file: string }> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const dl = await pending;
  const name = dl.suggestedFilename();
  const file = testInfo.outputPath(name);
  await dl.saveAs(file);
  return { name, file };
}

/** Local date as YYYY-MM-DD, computed in the browser. */
async function today(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

/** Minimal parser for the `;` CSV of the spec (quotes, doubled quotes, CRLF rows). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (quoted) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') {
      row.push(field);
      field = '';
    } else if (c === '\r' && text.charAt(i + 1) === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Reads a downloaded CSV: checks the UTF-8 BOM and returns the text after it. */
function readCsv(file: string): string {
  const buf = readFileSync(file);
  expect([...buf.subarray(0, 3)], 'UTF-8 BOM').toEqual([0xef, 0xbb, 0xbf]);
  return buf.subarray(3).toString('utf8');
}

async function axeDialog(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include('[role="dialog"], [role="alertdialog"], dialog')
    .analyze();
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
  expect(serious, `${label}\n${summary.join('\n')}`).toEqual([]);
}

/** Opens Ajustes on a new device and imports the sample file (AC-IMPORT-01 as a setup step). */
async function importSample(page: Page): Promise<void> {
  await gotoReady(page, '/settings', 'Ajustes');
  await expectCounts(page, 'es', countsFor('es', 'new'));
  await chooseFile(page, T.es.importGym, GYM_SAMPLE);
  const dialog = dialogOf(page, T.es.importGym);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: T.es.confirm, exact: true }).click();
  await expect(toast(page, T.es.imported(29))).toBeVisible();
  await expect(dialog).toBeHidden();
  await expectCounts(page, 'es', countsFor('es', 'after'));
}

test.describe('import and export', () => {
  test(
    'AC-IMPORT-01 · gym_app preview shows the summary, saves nothing until "Importar", then 29 records',
    { tag: '@all-engines' },
    async ({ page, browserName }) => {
      await gotoReady(page, '/settings', 'Ajustes');
      await expectCounts(page, 'es', countsFor('es', 'new'));

      // The two groups and their five buttons.
      await expect(
        page.getByRole('heading', { level: 3, name: T.es.importHeading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 3, name: T.es.exportHeading, exact: true }),
      ).toBeVisible();
      for (const b of [
        T.es.importGym,
        T.es.importCertavi,
        T.es.exportJson,
        T.es.exportSets,
        T.es.exportActivity,
      ]) {
        await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
      }

      await chooseFile(page, T.es.importGym, GYM_SAMPLE);
      const dialog = dialogOf(page, T.es.importGym);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(T.es.willSave, { exact: true })).toBeVisible();
      await expect.poll(() => readSummary(dialog, 'es')).toEqual(previewFor('es'));
      const cancel = dialog.getByRole('button', { name: T.es.cancel, exact: true });
      await expect(cancel).toBeFocused();
      await expect(dialog.getByRole('button', { name: T.es.confirm, exact: true })).toBeVisible();

      // Nothing saved yet.
      await expectCounts(page, 'es', countsFor('es', 'new'));

      if (browserName === 'chromium') await axeDialog(page, 'import preview (light)');

      await dialog.getByRole('button', { name: T.es.confirm, exact: true }).click();
      await expect(toast(page, T.es.imported(29))).toBeVisible();
      await expect(dialog).toBeHidden();
      await expectCounts(page, 'es', countsFor('es', 'after'));
    },
  );

  test('AC-IMPORT-02 · "Cancelar" and Escape close the preview and change nothing (dark)', async ({
    page,
    browserName,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoReady(page, '/settings', 'Ajustes');
    await expectTheme(page, 'dark');
    await expectCounts(page, 'es', countsFor('es', 'new'));
    const dialog = dialogOf(page, T.es.importGym);

    await chooseFile(page, T.es.importGym, GYM_SAMPLE);
    await expect(dialog).toBeVisible();
    await expect.poll(() => readSummary(dialog, 'es')).toEqual(previewFor('es'));
    if (browserName === 'chromium') await axeDialog(page, 'import preview (dark)');
    await dialog.getByRole('button', { name: T.es.cancel, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expectCounts(page, 'es', countsFor('es', 'new'));

    await chooseFile(page, T.es.importGym, GYM_SAMPLE);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expectCounts(page, 'es', countsFor('es', 'new'));
    await expect(page.getByText(/^Registros importados/)).toHaveCount(0);

    // Still nothing after a reload.
    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expectCounts(page, 'es', countsFor('es', 'new'));
  });

  test(
    'AC-IMPORT-03 · wrong files in both import buttons show a message, no dialog, no change',
    { tag: '@all-engines' },
    async ({ page }, testInfo) => {
      await gotoReady(page, '/settings', 'Ajustes');
      await expectCounts(page, 'es', countsFor('es', 'new'));
      // A real Certavi backup (of a new device) to feed to the gym_app button.
      const backup = await download(page, T.es.exportJson, testInfo);

      const cases: [button: string, file: string, message: string][] = [
        [T.es.importGym, TEXT_FILE, T.es.notGym],
        [T.es.importGym, backup.file, T.es.notGym],
        [T.es.importCertavi, TEXT_FILE, T.es.notCertavi],
        [T.es.importCertavi, GYM_SAMPLE, T.es.notCertavi],
      ];
      for (const [button, file, message] of cases) {
        // A fresh page per case, so each message is the one this file produced.
        await page.reload();
        await expect(h1(page, 'Ajustes')).toBeVisible();
        await expectCounts(page, 'es', countsFor('es', 'new'));
        await chooseFile(page, button, file);
        await expect(toast(page, message), `${button} + ${path.basename(file)}`).toBeVisible();
        await expect(anyDialog(page)).toHaveCount(0);
        await expectCounts(page, 'es', countsFor('es', 'new'));
      }
    },
  );

  test(
    'AC-IMPORT-03b · empty and binary files give the wrong-file message and the picker still works afterwards',
    { tag: '@all-engines' },
    async ({ page }) => {
      await gotoReady(page, '/settings', 'Ajustes');
      await expectCounts(page, 'es', countsFor('es', 'new'));

      const empty = { name: 'vacio.json', mimeType: 'application/json', buffer: Buffer.alloc(0) };
      const binary = {
        name: 'binario.json',
        mimeType: 'application/json',
        buffer: Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x80, 0x81, 0xc3, 0x28, 0x00, 0xff]),
      };
      const cases: [button: string, file: typeof empty, message: string][] = [
        [T.es.importGym, empty, T.es.notGym],
        [T.es.importGym, binary, T.es.notGym],
        [T.es.importCertavi, empty, T.es.notCertavi],
        [T.es.importCertavi, binary, T.es.notCertavi],
      ];
      for (const [button, file, message] of cases) {
        await page.reload();
        await expect(h1(page, 'Ajustes')).toBeVisible();
        await expectCounts(page, 'es', countsFor('es', 'new'));
        await chooseFile(page, button, file);
        await expect(toast(page, message), `${button} + ${file.name}`).toBeVisible();
        await expect(anyDialog(page)).toHaveCount(0);
        await expectCounts(page, 'es', countsFor('es', 'new'));
      }

      // After an error the picker is usable: a valid file opens the preview, and Cancel saves nothing.
      await chooseFile(page, T.es.importGym, GYM_SAMPLE);
      const dialog = dialogOf(page, T.es.importGym);
      await expect(dialog).toBeVisible();
      await expect.poll(() => readSummary(dialog, 'es')).toEqual(previewFor('es'));
      await dialog.getByRole('button', { name: T.es.cancel, exact: true }).click();
      await expect(dialog).toBeHidden();
      await expectCounts(page, 'es', countsFor('es', 'new'));
    },
  );

  test('AC-IMPORT-03b · while the import runs, Escape does not close the dialog and "Cancelar" / "Importar" are disabled; then it closes with the message', async ({
    page,
  }) => {
    await gotoReady(page, '/settings', 'Ajustes');
    await expectCounts(page, 'es', countsFor('es', 'new'));
    await chooseFile(page, T.es.importGym, GYM_SAMPLE);
    const dialog = dialogOf(page, T.es.importGym);
    await expect(dialog).toBeVisible();
    await expect.poll(() => readSummary(dialog, 'es')).toEqual(previewFor('es'));

    // The import writes to IndexedDB (asynchronous), so in the same task as the tap the dialog is
    // still open and "importing". Everything is read and an Escape is sent inside that one task,
    // because a Playwright call between them would take longer than the import itself.
    const state = await dialog
      .getByRole('button', { name: T.es.confirm, exact: true })
      .evaluate(async (btn) => {
        const root = btn.closest('[role="dialog"], [role="alertdialog"], dialog');
        if (!root) throw new Error('no dialog around the Importar button');
        const isOpen = () =>
          root.isConnected && (!(root instanceof HTMLDialogElement) || root.open);
        const buttons = () =>
          Array.from(root.querySelectorAll('button')).map((b) => ({
            text: (b.getAttribute('aria-label') ?? b.textContent).trim(),
            disabled: b.disabled || b.getAttribute('aria-disabled') === 'true',
          }));
        (btn as HTMLElement).click();
        // React redraws in a microtask; the IndexedDB write needs a later task, so it still runs.
        for (let i = 0; i < 5; i++) await Promise.resolve();
        const afterTap = buttons();
        const keydown = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
          cancelable: true,
        });
        (document.activeElement ?? root).dispatchEvent(keydown);
        root.dispatchEvent(new Event('cancel', { cancelable: true }));
        return { afterTap, openAfterEscape: isOpen() };
      });
    const named = (re: RegExp) => state.afterTap.find((b) => re.test(b.text));
    expect(named(/^Cancelar/), JSON.stringify(state.afterTap)).toMatchObject({ disabled: true });
    expect(named(/^Importa/), JSON.stringify(state.afterTap)).toMatchObject({ disabled: true });
    expect(state.openAfterEscape, 'Escape while importing').toBe(true);

    // It ends: message with the number, dialog closed, counts updated.
    await expect(toast(page, T.es.imported(29))).toBeVisible();
    await expect(dialog).toBeHidden();
    await expectCounts(page, 'es', countsFor('es', 'after'));
  });

  test('AC-IMPORT-04 · importing the same file twice: nothing new, "Sin cambios (ya estaban) 29", "Cerrar"', async ({
    page,
  }) => {
    await importSample(page);

    await chooseFile(page, T.es.importGym, GYM_SAMPLE);
    const dialog = dialogOf(page, T.es.importGym);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(T.es.nothingNew, { exact: true })).toBeVisible();
    const rows = await readSummary(dialog, 'es');
    expect(rows).toContainEqual([T.es.unchanged, '29']);
    // No kind of record is listed as "will be written".
    const kinds = COUNTS.map(([es]) => es);
    expect(rows.filter(([term]) => kinds.includes(term))).toEqual([]);

    await expect(dialog.getByRole('button', { name: T.es.confirm, exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: T.es.cancel, exact: true })).toHaveCount(0);
    const close = dialog.getByRole('button', { name: T.es.close, exact: true });
    await expect(close.first()).toBeVisible();
    await close.first().click();
    await expect(dialog).toBeHidden();
    await expectCounts(page, 'es', countsFor('es', 'after'));
  });

  test(
    'AC-IMPORT-05 · import works offline and the counts survive a reload',
    { tag: '@all-engines' },
    async ({ page, context }) => {
      await gotoReady(page, '/settings', 'Ajustes');
      await expectCounts(page, 'es', countsFor('es', 'new'));

      await context.setOffline(true);
      await chooseFile(page, T.es.importGym, GYM_SAMPLE);
      const dialog = dialogOf(page, T.es.importGym);
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: T.es.confirm, exact: true }).click();
      await expect(toast(page, T.es.imported(29))).toBeVisible();
      await expectCounts(page, 'es', countsFor('es', 'after'));
      await context.setOffline(false);

      await page.reload();
      await expect(h1(page, 'Ajustes')).toBeVisible();
      // Starting the app closes the finished weeks that have data and no frozen plan yet
      // (calendar.md): one more week, which is also one more change waiting to sync.
      await expectCounts(
        page,
        'es',
        countsFor('es', 'after').map(([label, n]) =>
          label === 'Semanas'
            ? [label, '3']
            : label === 'Pendientes de sincronizar'
              ? [label, '30']
              : [label, n],
        ),
      );
    },
  );

  test(
    'AC-EXPORT-01 · full backup downloads as certavi-backup-<today>.json and restores on a new device',
    { tag: '@all-engines' },
    async ({ page, browser }, testInfo) => {
      await importSample(page);
      const firstDevice = await readCounts(page, 'es');

      const backup = await download(page, T.es.exportJson, testInfo);
      expect(backup.name).toBe(`certavi-backup-${await today(page)}.json`);
      expect(() => JSON.parse(readFileSync(backup.file, 'utf8')) as unknown).not.toThrow();

      // A new device: a fresh browser context with its own empty storage.
      const other = await browser.newContext({
        baseURL: testInfo.project.use.baseURL,
        viewport: { width: 390, height: 844 },
      });
      try {
        const page2 = await other.newPage();
        await gotoReady(page2, '/settings', 'Ajustes');
        await expectCounts(page2, 'es', countsFor('es', 'new'));

        await chooseFile(page2, T.es.importCertavi, backup.file);
        const dialog = dialogOf(page2, T.es.importCertavi);
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(T.es.willSave, { exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: T.es.confirm, exact: true }).click();
        await expect(
          page2.getByText(/^Registros importados: \d+$/).filter({ visible: true }),
        ).toBeVisible();
        await expect(dialog).toBeHidden();
        await expectCounts(page2, 'es', firstDevice);
      } finally {
        await other.close();
      }
    },
  );

  test(
    'AC-EXPORT-02 · the sets and activity CSVs are ready for Spanish Excel',
    { tag: '@all-engines' },
    async ({ page }, testInfo) => {
      await importSample(page);
      const day = await today(page);

      // Sets.
      const sets = await download(page, T.es.exportSets, testInfo);
      expect(sets.name).toBe(`certavi-sets-${day}.csv`);
      const setsText = readCsv(sets.file);
      expect(setsText.startsWith(`${SETS_HEADER_ES}\r\n`), 'Spanish header + CRLF').toBe(true);
      const [setsHeader, ...setRows] = parseCsv(setsText);
      expect(setsHeader).toEqual(SETS_HEADER_ES.split(';'));
      expect(setRows).toHaveLength(11);
      for (const r of setRows) expect(r, r.join(';')).toHaveLength(14);
      const weight = SETS_HEADER_ES.split(';').indexOf('peso_kg');
      expect(setRows.filter((r) => r[weight] === '27,5')).toHaveLength(2);
      expect(setsText).not.toContain('27.5');
      // The free session and the quoted session note (it contains ";"), only on its first row.
      expect(setRows.some((r) => r[1] === 'Sesión libre')).toBe(true);
      expect(setRows.filter((r) => r[13] === 'Buena sesión; con energía')).toHaveLength(1);

      // Activity and weight.
      const act = await download(page, T.es.exportActivity, testInfo);
      expect(act.name).toBe(`certavi-activity-weight-${day}.csv`);
      const actText = readCsv(act.file);
      expect(actText.startsWith(`${ACTIVITY_HEADER_ES}\r\n`), 'Spanish header + CRLF').toBe(true);
      const [actHeader, ...actRows] = parseCsv(actText);
      expect(actHeader).toEqual(ACTIVITY_HEADER_ES.split(';'));
      expect(actRows.map((r) => r[1])).toEqual([
        'actividad',
        'actividad',
        'peso_medio_semana',
        'peso_medio_semana',
      ]);
      expect(
        actRows
          .slice(2)
          .map((r) => r[4] ?? '')
          .sort(),
      ).toEqual(['80,5', '81']);
    },
  );

  test('AC-IMPORT-06 · in English the buttons, the preview and the messages are English', async ({
    page,
  }) => {
    const en = T.en;
    await setLanguage(page, 'en');
    await expectCounts(page, 'en', countsFor('en', 'new'));
    await expect(
      page.getByRole('heading', { level: 3, name: en.importHeading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: en.exportHeading, exact: true }),
    ).toBeVisible();
    for (const b of [
      en.importGym,
      en.importCertavi,
      en.exportJson,
      en.exportSets,
      en.exportActivity,
    ]) {
      await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
    }

    // Wrong files.
    await chooseFile(page, en.importCertavi, GYM_SAMPLE);
    await expect(toast(page, en.notCertavi)).toBeVisible();
    await page.reload();
    await expect(h1(page, en.settings)).toBeVisible();
    await chooseFile(page, en.importGym, TEXT_FILE);
    await expect(toast(page, en.notGym)).toBeVisible();
    await expect(anyDialog(page)).toHaveCount(0);

    // Preview and confirm.
    await chooseFile(page, en.importGym, GYM_SAMPLE);
    const dialog = dialogOf(page, en.importGym);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(en.willSave, { exact: true })).toBeVisible();
    await expect.poll(() => readSummary(dialog, 'en')).toEqual(previewFor('en'));
    await expect(dialog.getByRole('button', { name: en.cancel, exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: en.confirm, exact: true }).click();
    await expect(toast(page, en.imported(29))).toBeVisible();
    await expectCounts(page, 'en', countsFor('en', 'after'));

    // Nothing new the second time.
    await chooseFile(page, en.importGym, GYM_SAMPLE);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(en.nothingNew, { exact: true })).toBeVisible();
    expect(await readSummary(dialog, 'en')).toContainEqual([en.unchanged, '29']);
    await dialog.getByRole('button', { name: en.close, exact: true }).first().click();
    await expect(dialog).toBeHidden();
  });
});
