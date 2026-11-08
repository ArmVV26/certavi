// The sync v1 contract as zod schemas and constants, shared by the client and the server.
// It mirrors docs/api/sync-v1.md: change both together (server/sync/contract.test.ts checks it).
import { z } from 'zod';
import { isoDateSchema, recordIdSchema, timestampSchema } from '../model/envelope';

/** Base path of every route. */
export const SYNC_API_BASE = '/api/v1';
export const SYNC_PATH = `${SYNC_API_BASE}/sync`;
export const BACKUPS_PATH = `${SYNC_API_BASE}/backups`;

// Server rules (§3, §5, §6, §7).
export const MIN_SECRET_LENGTH = 32;
export const AUTH_FAILURE_DELAY_MS = 400;
export const MAX_WRITE_ATTEMPTS = 5;
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
export const BACKUPS_KEPT = 14;
export const BACKUP_TIME_ZONE = 'Europe/Madrid';

// Client obligations (§8).
export const MAX_BATCH_RECORDS = 300;
export const REQUEST_TIMEOUT_MS = 15_000;
export const RETRY_BACKOFF_SECONDS = [4, 8, 15, 30, 60] as const;
export const PENDING_SYNC_INTERVAL_MS = 45_000;
export const KEEPALIVE_MAX_BYTES = 55_000;
export const KEEPALIVE_TIMEOUT_MS = 30_000;
export const ATTEMPT_LOG_SIZE = 40;

/**
 * A record as it travels (§4): the envelope the server checks plus an opaque, flat payload.
 * `type` is any non-empty string here — the server does not know the client's record types.
 */
export const wireRecordSchema = z.looseObject({
  id: recordIdSchema,
  type: z.string().min(1),
  updatedAt: timestampSchema,
});
export type WireRecord = z.infer<typeof wireRecordSchema>;

/** A record as the server stores and returns it: always with its `serverSeq`. */
export const storedWireRecordSchema = wireRecordSchema.extend({
  serverSeq: z.number().int().positive(),
});
export type StoredWireRecord = z.infer<typeof storedWireRecordSchema>;

/** What a well-behaved client sends to `POST /api/v1/sync` (§5). */
export const syncRequestSchema = z.object({
  since: z.number().int().nonnegative(),
  records: z.array(wireRecordSchema).max(MAX_BATCH_RECORDS),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

/**
 * What the server accepts as a request shape. Records are checked one by one afterwards, so an
 * invalid record ends up in `rejected` instead of failing the whole request.
 */
export const syncRequestShapeSchema = z.object({
  since: z.number().int().nonnegative(),
  records: z.array(z.unknown()),
});

export const syncResponseSchema = z.object({
  serverSeq: z.number().int().nonnegative(),
  records: z.array(storedWireRecordSchema),
  rejected: z.array(z.string()),
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;

export const backupSummarySchema = z.object({
  date: isoDateSchema,
  count: z.number().int().nonnegative().nullable(),
  createdAt: timestampSchema.nullable(),
});
export type BackupSummary = z.infer<typeof backupSummarySchema>;

/** `GET /api/v1/backups` (§6), newest first. */
export const backupListSchema = z.object({ backups: z.array(backupSummarySchema) });
export type BackupList = z.infer<typeof backupListSchema>;

/** `GET /api/v1/backups/{date}` (§6). */
export const backupFileSchema = z.object({
  date: isoDateSchema,
  records: z.array(storedWireRecordSchema),
});
export type BackupFile = z.infer<typeof backupFileSchema>;

/** Error codes and their HTTP status (§7). */
export const ERROR_STATUS = {
  'invalid-json': 400,
  'invalid-request': 400,
  'invalid-date': 400,
  unauthorized: 401,
  'not-found': 404,
  'method-not-allowed': 405,
  conflict: 409,
  'payload-too-large': 413,
  'server-misconfigured': 500,
  'internal-error': 500,
} as const satisfies Record<string, number>;
export type ErrorCode = keyof typeof ERROR_STATUS;
export const ERROR_CODES = Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]];

export const errorBodySchema = z.object({ error: z.enum(ERROR_CODES) });
/** @public Error body of docs/api/sync-v1.md; kept next to its schema for other backends. */
export type ErrorBody = z.infer<typeof errorBodySchema>;
