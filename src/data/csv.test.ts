import { describe, expect, it } from 'vitest';
import sample from '../../tests/fixtures/gym-app-sample.json?raw';
import { makeSession, makeSet } from '../domain/testing/builders';
import type { TextRef } from '../domain';
import { openTestDatabase } from '../test/render';
import { exportActivityWeightCsv, exportSetsCsv, toCsv, type CsvLabels } from './csv';
import { applyImport } from './importRecords';
import { readGymAppExport } from './legacy/gymApp';
import { createRepositories } from './repository';
import { ensureSeed } from './seed';

const NOW = new Date('2026-11-03T10:00:00');
const BOM = '\uFEFF';

const labels: CsvLabels = {
  yes: 'sí',
  no: 'no',
  text: (ref: TextRef) => ('text' in ref ? ref.text : `[${ref.key}]`),
  setKind: (kind) => kind.toUpperCase(),
  activityKind: (kind) => `act:${kind}`,
  freeSession: 'Sesión libre',
  setsHeader: ['fecha', 'sesion', 'ejercicio', 'tipo_serie', 'orden', 'peso_kg', 'reps', 'rir'],
  activityHeader: ['fecha', 'tipo', 'actividad', 'minutos', 'peso_kg', 'nota'],
  activityRow: 'actividad',
  weightRow: 'peso_medio_semana',
};

const lines = (content: string) => content.slice(1).split('\r\n');

async function importedDb() {
  const db = openTestDatabase();
  await ensureSeed(db);
  const legacy = readGymAppExport(sample);
  if (!legacy.ok) throw new Error('sample did not read');
  await applyImport(db, legacy.records);
  return db;
}

describe('toCsv', () => {
  it('writes Excel-in-Spanish CSV: BOM, semicolons, decimal comma, CRLF, quotes', () => {
    const csv = toCsv(
      [
        ['a', 27.5, 0, true, false, null, undefined],
        ['x;y', 'dice "hola"', 'línea\nnueva', 'ok\r'],
      ],
      labels,
    );
    expect(csv).toBe(`${BOM}a;27,5;0;sí;no;;\r\n"x;y";"dice ""hola""";"línea\nnueva";"ok\r"`);
  });
});

describe('sets CSV', () => {
  it('has one row per set, in session and exercise order, with Excel number format', async () => {
    const file = await exportSetsCsv(await importedDb(), labels, NOW);

    expect(file.fileName).toBe('certavi-sets-2026-11-03.csv');
    expect(file.mimeType).toBe('text/csv;charset=utf-8');
    expect(file.content.startsWith(BOM)).toBe(true);
    const [header, ...rows] = lines(file.content);
    expect(header).toBe('fecha;sesion;ejercicio;tipo_serie;orden;peso_kg;reps;rir');
    expect(rows).toHaveLength(11);
    const press = '[exercises.names.press-inclinado-mancuernas]';
    const crunch = '[exercises.names.crunch-maquina]';
    expect(rows).toEqual([
      `2026-10-07;[routines.names.lowerB];[exercises.names.rdl-maquina];TOP;1;80;8;2;;;101,3;sí;;`,
      `2026-10-19;[routines.names.push];${press};WARMUP;1;10;10;;;;;no;Hombro bien;"Buena sesión; con energía"`,
      `2026-10-19;[routines.names.push];${press};APPROACH;2;20;6;;;;;sí;Hombro bien;`,
      `2026-10-19;[routines.names.push];${press};TOP;3;30;8;1;;;38;sí;Hombro bien;`,
      `2026-10-19;[routines.names.push];${press};BACKOFF;4;27,5;10;2;;;36,7;sí;Hombro bien;`,
      `2026-10-19;[routines.names.push];${press};BACKOFF;5;27,5;9;;;;35,8;sí;Hombro bien;`,
      `2026-10-19;[routines.names.push];${crunch};STRAIGHT;1;40;15;2;;;60;sí;"Lento, ""sin tirones""";`,
      `2026-10-19;[routines.names.push];${crunch};EXTRA;2;40;12;1;;;56;sí;"Lento, ""sin tirones""";`,
      `2026-10-21;Sesión libre;[exercises.names.remo-t];STRAIGHT;1;60;10;2;sí;;80;sí;;`,
      `2026-10-21;Sesión libre;[exercises.names.remo-t];STRAIGHT;2;60;9;1;no;;78;sí;;`,
      `2026-10-21;Sesión libre;[exercises.names.dominadas];EXTRA;1;0;8;2;;morada;;sí;;`,
    ]);
  });

  it('falls back to ids, orders unplanned exercises by time and skips deleted records', async () => {
    const db = openTestDatabase();
    const repos = createRepositories(db);
    await repos.session.put(makeSession({ id: 's', date: '2026-11-02', routineId: 'gone' }));
    const sets = await repos.set.putMany([
      makeSet({ sessionId: 's', exerciseId: 'b-own', completedAt: 20 }),
      makeSet({ sessionId: 's', exerciseId: 'a-own', completedAt: 10, reps: 0 }),
      makeSet({ sessionId: 's', exerciseId: 'a-own', completedAt: 30, slot: 1 }),
    ]);
    await repos.set.remove(sets[2]?.id ?? '');

    const rows = lines((await exportSetsCsv(db, labels, NOW)).content).slice(1);

    expect(rows).toEqual([
      '2026-11-02;gone;a-own;STRAIGHT;1;50;0;2;;;;no;;',
      '2026-11-02;gone;b-own;STRAIGHT;1;50;10;2;;;66,7;sí;;',
    ]);
  });
});

describe('activity and weight CSV', () => {
  it('lists activities, then weekly body weights', async () => {
    const file = await exportActivityWeightCsv(await importedDb(), labels, NOW);

    expect(file.fileName).toBe('certavi-activity-weight-2026-11-03.csv');
    expect(lines(file.content)).toEqual([
      'fecha;tipo;actividad;minutos;peso_kg;nota',
      '2026-10-20;actividad;act:football;60;;Pachanga',
      '2026-10-25;actividad;act:hiking;0;;',
      '2026-10-12;peso_medio_semana;;;81;',
      '2026-10-19;peso_medio_semana;;;80,5;',
    ]);
  });
});
