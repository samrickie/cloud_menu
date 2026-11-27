import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers.ts';
let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => { f = await fixture(); });
afterEach(async () => { await f?.app.close(); });
describe('US-101 QR table entry', () => {
  it('First scan opens a new table session with a scoped token and no signup', async () => {
    const r = await f.init(); expect(r.statusCode).toBe(201);
    expect(r.json().session.status).toBe('ACTIVE'); expect(r.json().table.label).toBe('T12'); expect(r.json().session_token).toBeTruthy();
    const rows = await f.store.rows('table_sessions',{}); expect(rows).toHaveLength(1); expect(rows[0].table_id).toBe(f.table.id);
  });
  it('Tampered or unknown QR token is rejected as problem+json', async () => {
    for (const qr of [f.qr + 'x', 'unknown.signature']) {
      const r = await f.app.inject({ method: 'POST', url: '/v1/sessions/init', payload: { qr, device_id: crypto.randomUUID() } });
      expect([404,422]).toContain(r.statusCode); expect(r.headers['content-type']).toContain('application/problem+json'); expect(r.json().code).toMatch(/^QR_/);
    }
    expect(await f.store.rows('table_sessions',{})).toHaveLength(0);
  });
  it('Venue is inactive: suspended venue creates no session', async () => {
    await f.store.patch('venues',{id:f.venue.id},{status:'SUSPENDED'}); const r = await f.init(); expect(r.statusCode).toBe(403); expect(r.json().code).toBe('VENUE_SUSPENDED');
    expect(await f.store.rows('table_sessions',{})).toHaveLength(0);
  });
});
