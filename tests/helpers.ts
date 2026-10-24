import { buildApp } from '../apps/api/src/app.ts';
import { signQR } from '../apps/api/src/security.ts';
import { MemoryStore } from './memory-store.ts';
import { randomBytes, randomUUID } from 'node:crypto';
export const secrets = { token: randomBytes(32).toString('hex'), qr: randomBytes(32).toString('hex') };
export async function fixture() {
  const store = new MemoryStore();
  const venue = await store.add('venues', {id:randomUUID(),slug:'demo-masaki',name:'Masaki Lounge [DEMO]',status:'ACTIVE',currency:'TZS',max_participants:20});
  const table = await store.add('dining_tables', {id:randomUUID(),venue_id:venue.id,label:'T12',qr_code:randomUUID(),qr_key_version:1,is_active:true});
  const app = await buildApp({ store, tokenSecret: secrets.token, qrSecret: secrets.qr, logger: false });
  const qr = signQR(table.qr_code, 1, secrets.qr);
  const init = (device_id = randomUUID(), extra = {}) => app.inject({ method: 'POST', url: '/v1/sessions/init', payload: { qr, device_id, locale: 'en', ...extra } });
  return { app, store, venue, table, qr, init };
}
