// Netlify Function for the sync v1 API. A thin adapter: all the logic is in server/sync.
import { getStore } from '@netlify/blobs';
import type { Config, Context } from '@netlify/functions';
import { createSyncHandler, type SyncHandler } from '../../server/sync/handler';
import { fromNetlifyStore } from '../../server/sync/netlifyStore';
import { storeNameFor } from '../../server/sync/store';

// One handler per store name, created on first use and reused while the instance lives.
const handlers = new Map<string, SyncHandler>();

// Netlify requires the handler to be the default export.
export default function sync(request: Request, context: Context): Promise<Response> {
  const name = storeNameFor(context.deploy.context);
  let handler = handlers.get(name);
  if (!handler) {
    handler = createSyncHandler({
      store: fromNetlifyStore(getStore({ name, consistency: 'strong' })),
      secret: process.env.CLAVE_SYNC,
    });
    handlers.set(name, handler);
  }
  return handler(request);
}

export const config: Config = {
  path: ['/api/v1/sync', '/api/v1/backups', '/api/v1/backups/:date'],
};
