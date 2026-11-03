// Importer for the full copy exported by gym_app ("Copia completa (.json)"), v1.5.1.
// Pure: it turns the file into validated Certavi records; saving is done by importRecords.ts.
// Mapping: docs/migration.md. Record shapes come from the gym_app source code, never from data.
import { z } from 'zod';
import {
  ANKLE_REHAB_BLOCK,
  ANKLE_REHAB_BLOCK_ID,
  blockLogId,
  bodyWeightId,
  exerciseNoteId,
  LEGACY_FREE_ROUTINE_ID,
  MUSCLE_GROUPS,
  parseRecord,
  plainText,
  resolveExerciseId,
  rirRangeSchema,
  SEED_EXERCISES_BY_ID,
  SEED_ROUTINES_BY_ID,
  weeklyMetricId,
  weekPlanId,
  type ActivityKind,
  type DomainRecord,
  type MuscleGroup,
  type PlanItem,
  type SchemeBlock,
  type SetKind,
} from '../../domain';
import { dedupeNewest, type ImportFile } from '../importFile';

// ---------------------------------------------------------------- gym_app shapes (tolerant)

const nullableNumber = z.number().nullish();

const legacyItemSchema = z.looseObject({
  ex: z.string().min(1),
  plan: z.array(z.tuple([z.string(), z.string(), z.number().int()])),
  rir: z.string().optional(),
  nota: z.string().optional(),
  opt: z.boolean().optional(),
});
type LegacyItem = z.infer<typeof legacyItemSchema>;

const legacySchemas = {
  session: z.looseObject({
    date: z.string(),
    tpl: z.string().min(1),
    start: nullableNumber,
    end: nullableNumber,
    items: z.array(legacyItemSchema).optional(),
    ready: nullableNumber,
    note: z.string().nullish(),
  }),
  set: z.looseObject({
    sid: z.string().min(1),
    ex: z.string().min(1),
    slot: z.string().regex(/^[pwx]\d+$/),
    kind: z.string(),
    w: z.number(),
    r: z.number(),
    rir: nullableNumber,
    at: nullableNumber,
    straps: z.boolean().nullish(),
    band: z.string().nullish(),
  }),
  note: z.looseObject({ sid: z.string().min(1), ex: z.string().min(1), text: z.string() }),
  act: z.looseObject({
    date: z.string(),
    kind: z.string(),
    min: nullableNumber,
    note: z.string().nullish(),
  }),
  bw: z.looseObject({ week: z.string(), kg: z.number() }),
  week: z.looseObject({
    week: z.string(),
    hiking: z.boolean().optional(),
    deload: z.boolean().optional(),
    plan: z.record(z.string(), z.number()).optional(),
    closedAt: nullableNumber,
  }),
  tpl: z.looseObject({ tpl: z.string().min(1), items: z.array(legacyItemSchema) }),
  excfg: z.looseObject({ ex: z.string().min(1), step: z.number() }),
  rec: z.looseObject({
    date: z.string(),
    mob: z.record(z.string(), z.boolean()).optional(),
    ecc: z.record(z.string(), z.boolean()).optional(),
    stairs: nullableNumber,
    maxPain: nullableNumber,
    pogos: nullableNumber,
    note: z.string().nullish(),
  }),
  wall: z.looseObject({ week: z.string(), left: nullableNumber, right: nullableNumber }),
  cfg: z.looseObject({
    active: z.boolean().optional(),
    start: z.string().nullish(),
    physio: z.string().nullish(),
  }),
} as const;

type LegacyType = keyof typeof legacySchemas;
type LegacyOf<T extends LegacyType> = z.infer<(typeof legacySchemas)[T]>;

const envelopeSchema = z.looseObject({
  id: z.string().min(1),
  t: z.string().min(1),
  u: z.number().nonnegative(),
  del: z.boolean().optional(),
});
type Envelope = z.infer<typeof envelopeSchema>;

/** The full copy: `{ app: 'winter-arc', records: [...] }`, or a bare array of records. */
const fileSchema = z.union([
  z.array(z.unknown()),
  z.looseObject({ app: z.literal('winter-arc'), records: z.array(z.unknown()) }),
]);

// ---------------------------------------------------------------- id and value mappings

const SET_KIND: Readonly<Record<string, SetKind>> = {
  aprox: 'approach',
  top: 'top',
  backoff: 'backoff',
  work: 'straight',
  bilbo: 'bilbo',
  warmup: 'warmup',
  extra: 'extra',
};

const SCHEME_KIND: Readonly<Record<string, SchemeBlock['kind']>> = {
  aprox: 'approach',
  top: 'top',
  backoff: 'backoff',
  work: 'straight',
  bilbo: 'bilbo',
};

const ACTIVITY_KIND: Readonly<Record<string, ActivityKind>> = {
  futbol: 'football',
  natacion: 'swimming',
  senderismo: 'hiking',
  movilidad: 'mobility',
  bici: 'cycling',
  otro: 'other',
};

/** Key of each muscle group in a gym_app week plan. */
const LEGACY_GROUP_KEY: Readonly<Record<MuscleGroup, string>> = {
  chest: 'pecho',
  back: 'espalda',
  shoulders: 'hombro',
  quads: 'cuadriceps',
  'hamstrings-glutes': 'femoral',
  triceps: 'triceps',
  biceps: 'biceps',
  calves: 'gemelo',
  core: 'core',
  forearms: 'antebrazo',
};

/** gym_app recovery checklist keys → items of the seed ankle rehab block. */
const REHAB_ITEM: Readonly<Record<string, string>> = {
  rodillo: 'foam-roll',
  pared: 'wall-ankle',
  sentado: 'ankle-sit',
  goma: 'band-mobilization',
  cajon: 'box-drop',
  talon: 'heel-raise',
  zancada: 'split-heel-raise',
  pogos: 'pogos',
};

const REHAB_METRIC = { stairs: 'stairs', maxPain: 'max-pain', pogos: 'pogos' } as const;

const RECOVERY_CONFIG_ID = 'cfg_recovery';

// ---------------------------------------------------------------- conversions

function convertItem(item: LegacyItem): PlanItem {
  const rir = rirRangeSchema.safeParse(item.rir ?? '');
  return {
    exerciseId: resolveExerciseId(item.ex),
    scheme: {
      blocks: item.plan.map(([kind, reps, count]) => ({
        // An unknown kind stays as is so the record fails validation and is reported.
        kind: SCHEME_KIND[kind] ?? (kind as SchemeBlock['kind']),
        reps,
        count,
      })),
      rir: rir.success ? rir.data : '',
    },
    ...(item.nota ? { note: plainText(item.nota) } : {}),
    optional: item.opt === true,
  };
}

/** Slot strings `p0` (planned, 0-based) and `w1` / `x1` (warm-up / extra, 1-based) → number. */
const slotNumber = (slot: string) => Number(slot.slice(1));

const definedEntries = (values: Record<string, number | null | undefined>) =>
  Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, number] => entry[1] != null),
  );

type Converter<T extends LegacyType> = (record: LegacyOf<T>, env: Envelope) => unknown;

const CONVERTERS: { [T in LegacyType]: Converter<T> } = {
  session: (s, env) => ({
    id: env.id,
    type: 'session',
    updatedAt: env.u,
    date: s.date,
    routineId: s.tpl === LEGACY_FREE_ROUTINE_ID ? null : s.tpl,
    startedAt: s.start ?? null,
    endedAt: s.end ?? null,
    // The first gym_app sessions had no items: they used the routine as it was.
    items: s.items
      ? s.items.map(convertItem)
      : (SEED_ROUTINES_BY_ID.get(s.tpl)?.items.map((i) => ({ ...i })) ?? []),
    note: s.note ?? '',
    readiness: s.ready ?? null,
  }),

  set: (s, env) => ({
    id: env.id,
    type: 'set',
    updatedAt: env.u,
    sessionId: s.sid,
    exerciseId: resolveExerciseId(s.ex),
    kind: SET_KIND[s.kind] ?? s.kind,
    slot: slotNumber(s.slot),
    weight: s.w,
    reps: s.r,
    rir: s.rir ?? null,
    ...(s.straps != null ? { straps: s.straps } : {}),
    ...(s.band ? { band: s.band } : {}),
    completedAt: s.at ?? env.u,
  }),

  note: (n, env) => {
    const exerciseId = resolveExerciseId(n.ex);
    return {
      id: exerciseNoteId(n.sid, exerciseId),
      type: 'note',
      updatedAt: env.u,
      sessionId: n.sid,
      exerciseId,
      text: n.text,
    };
  },

  act: (a, env) => ({
    id: env.id,
    type: 'activity',
    updatedAt: env.u,
    date: a.date,
    kind: ACTIVITY_KIND[a.kind] ?? 'other',
    minutes: a.min ?? 0,
    note: a.note ?? '',
  }),

  bw: (b, env) => ({
    id: bodyWeightId(b.week),
    type: 'bodyWeight',
    updatedAt: env.u,
    week: b.week,
    kg: b.kg,
  }),

  week: (w, env) => {
    const plan = w.plan;
    return {
      id: weekPlanId(w.week),
      type: 'weekPlan',
      updatedAt: env.u,
      week: w.week,
      hiking: w.hiking ?? false,
      deload: w.deload ?? false,
      size: 5,
      ...(plan
        ? {
            plannedSetsByGroup: Object.fromEntries(
              MUSCLE_GROUPS.map((group) => [group, plan[LEGACY_GROUP_KEY[group]] ?? 0]),
            ),
          }
        : {}),
      ...(w.closedAt != null ? { closedAt: w.closedAt } : {}),
    };
  },

  tpl: (t, env) => {
    const base = SEED_ROUTINES_BY_ID.get(t.tpl);
    if (!base) return null;
    return { ...base, updatedAt: env.u, items: t.items.map(convertItem) };
  },

  excfg: (e, env) => {
    const base = SEED_EXERCISES_BY_ID.get(resolveExerciseId(e.ex));
    if (!base) return null;
    return { ...base, updatedAt: env.u, increment: e.step };
  },

  rec: (r, env) => ({
    id: blockLogId(ANKLE_REHAB_BLOCK_ID, r.date),
    type: 'blockLog',
    updatedAt: env.u,
    date: r.date,
    blockId: ANKLE_REHAB_BLOCK_ID,
    done: Object.fromEntries(
      [...Object.entries(r.mob ?? {}), ...Object.entries(r.ecc ?? {})].flatMap(([key, done]) => {
        const item = REHAB_ITEM[key];
        return item ? [[item, done]] : [];
      }),
    ),
    metrics: definedEntries({
      [REHAB_METRIC.stairs]: r.stairs,
      [REHAB_METRIC.maxPain]: r.maxPain,
      [REHAB_METRIC.pogos]: r.pogos,
    }),
    note: r.note ?? '',
  }),

  wall: (w, env) => ({
    id: weeklyMetricId(ANKLE_REHAB_BLOCK_ID, 'wall-test', w.week),
    type: 'weeklyMetric',
    updatedAt: env.u,
    week: w.week,
    blockId: ANKLE_REHAB_BLOCK_ID,
    metricId: 'wall-test',
    values: definedEntries({ left: w.left, right: w.right }),
  }),

  cfg: (c, env) => {
    // Only the recovery settings map to Certavi; the rest (cfg_exp_brazos) is internal.
    if (env.id !== RECOVERY_CONFIG_ID) return null;
    return {
      ...ANKLE_REHAB_BLOCK,
      updatedAt: env.u,
      active: c.active ?? ANKLE_REHAB_BLOCK.active,
      ...(c.start ? { startDate: c.start } : {}),
      ...(c.physio ? { reviewDate: c.physio } : {}),
    };
  },
};

function isLegacyType(t: string): t is LegacyType {
  return Object.hasOwn(legacySchemas, t);
}

function convert(type: LegacyType, raw: unknown, env: Envelope): unknown {
  const parsed = legacySchemas[type].safeParse(raw);
  if (!parsed.success) return undefined;
  // The schema and the converter of `type` match, but TypeScript sees a union of converters.
  return (CONVERTERS[type] as Converter<LegacyType>)(parsed.data, env);
}

/**
 * Reads the text of a gym_app full copy. Records that do not map to Certavi (deleted ones,
 * internal settings, migration markers) are counted as ignored; malformed ones as invalid.
 */
export function readGymAppExport(text: string): ImportFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  const file = fileSchema.safeParse(json);
  if (!file.success) return { ok: false };
  const rawRecords = Array.isArray(file.data) ? file.data : file.data.records;

  const records: DomainRecord[] = [];
  let ignored = 0;
  let invalid = 0;
  for (const raw of rawRecords) {
    const env = envelopeSchema.safeParse(raw);
    if (!env.success) {
      invalid += 1;
      continue;
    }
    if (env.data.del === true || !isLegacyType(env.data.t)) {
      ignored += 1;
      continue;
    }
    const converted = convert(env.data.t, raw, env.data);
    if (converted === null) {
      ignored += 1;
      continue;
    }
    const parsed = parseRecord(converted);
    if (parsed.ok && parsed.record.deleted !== true) records.push(parsed.record);
    else invalid += 1;
  }
  return { ok: true, records: dedupeNewest(records), ignored, invalid };
}
