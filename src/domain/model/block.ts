// Optional blocks (mobility, stretching, rehab), their daily logs and weekly metrics.
import { z } from 'zod';
import { envelopeShape, isoDateSchema, recordIdSchema, textRefSchema } from './envelope';
import { blockTypeSchema, weekdaySchema } from './enums';
import { mondaySchema } from './weekPlan';

/** Id inside a block (items, metrics): short and stable. */
const localIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);

export const blockItemSchema = z.object({
  id: localIdSchema,
  name: textRefSchema,
  /** "2 × 30 s per leg", "3 × 20"… */
  dose: textRefSchema.optional(),
  description: textRefSchema.optional(),
  /** For items not done every day, e.g. '3-5' times a week. */
  timesPerWeek: z
    .string()
    .regex(/^\d(-\d)?$/)
    .optional(),
});
export type BlockItem = z.infer<typeof blockItemSchema>;

/** A value logged each day, e.g. pain going down stairs (0–10). */
export const blockMetricSchema = z
  .object({
    id: localIdSchema,
    name: textRefSchema,
    min: z.number().int(),
    max: z.number().int(),
    /** Reference line on the chart; values above it are a warning (pain > 3/10). */
    threshold: z.number().optional(),
  })
  .refine((m) => m.min < m.max, { message: 'min must be lower than max' });
export type BlockMetric = z.infer<typeof blockMetricSchema>;

/** A value logged once a week, possibly in parts (the wall test: left and right, in cm). */
export const weeklyMetricDefSchema = z.object({
  id: localIdSchema,
  name: textRefSchema,
  unit: z.string().min(1),
  parts: z.array(z.object({ id: localIdSchema, name: textRefSchema })).min(1),
});
export type WeeklyMetricDef = z.infer<typeof weeklyMetricDefSchema>;

export const optionalBlockSchema = z.object({
  ...envelopeShape('block'),
  name: textRefSchema,
  blockType: blockTypeSchema,
  items: z.array(blockItemSchema),
  /** Days the block is proposed on. */
  days: z.array(weekdaySchema),
  metrics: z.array(blockMetricSchema),
  weeklyMetrics: z.array(weeklyMetricDefSchema),
  active: z.boolean(),
  custom: z.boolean(),
  /** When the block started (e.g. the start of a rehab programme). */
  startDate: isoDateSchema.optional(),
  /** Next review, e.g. the physiotherapist appointment. */
  reviewDate: isoDateSchema.optional(),
});
export type OptionalBlock = z.infer<typeof optionalBlockSchema>;

export const blockLogSchema = z.object({
  ...envelopeShape('blockLog'),
  date: isoDateSchema,
  blockId: recordIdSchema,
  done: z.record(z.string(), z.boolean()),
  metrics: z.record(z.string(), z.number()),
  note: z.string(),
});
export type BlockLog = z.infer<typeof blockLogSchema>;

export const weeklyMetricSchema = z.object({
  ...envelopeShape('weeklyMetric'),
  week: mondaySchema,
  blockId: recordIdSchema,
  metricId: localIdSchema,
  values: z.record(z.string(), z.number()),
});
export type WeeklyMetric = z.infer<typeof weeklyMetricSchema>;

/** One log per block and day, one weekly value per block, metric and week. */
export const blockLogId = (blockId: string, date: string) => `blocklog_${blockId}_${date}`;
export const weeklyMetricId = (blockId: string, metricId: string, monday: string) =>
  `wmetric_${blockId}_${metricId}_${monday}`;
