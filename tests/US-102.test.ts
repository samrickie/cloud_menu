import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {fixture} from './helpers.ts';
let f:Awaited<ReturnType<typeof fixture>>;
beforeEach(async()=>{f=await fixture();});afterEach(async()=>f.app.close());
describe('US-102 shared table participants',()=>{
 it('Second guest joins existing session and can edit their display name',async()=>{
  const first=(await f.init()).json();const second=await f.init();expect(second.statusCode).toBe(200);const b=second.json();expect(b.session.id).toBe(first.session.id);expect(b.participant.display_name).toBe('Guest 2');
  const r=await f.app.inject({method:'PATCH',url:`/v1/sessions/${b.session.id}/participant`,headers:{authorization:`Bearer ${b.session_token}`},payload:{display_name:'Neema [DEMO]'}});expect(r.statusCode).toBe(200);expect(r.json().participant.display_name).toBe('Neema [DEMO]');
 });
 it('Same device re-scans: participant and token reused with device proof',async()=>{
  const id=crypto.randomUUID();const a=(await f.init(id)).json();const b=(await f.init(id,{device_proof:a.device_proof})).json();expect(b.participant.id).toBe(a.participant.id);expect(b.session_token).toBe(a.session_token);expect(await f.store.rows('session_participants',{})).toHaveLength(1);
 });
 it('Participant limit: twenty participants remain unchanged by the twenty-first',async()=>{
  const responses=await Promise.all(Array.from({length:21},()=>f.init()));expect(responses.filter(r=>r.statusCode===409)).toHaveLength(1);expect(await f.store.rows('session_participants',{})).toHaveLength(20);expect(responses.find(r=>r.statusCode===409)!.json().code).toBe('SESSION_FULL');
 });
 it('A device UUID without its proof cannot recover another guest identity',async()=>{
  const id=crypto.randomUUID();await f.init(id);const r=await f.init(id);expect(r.statusCode).toBe(403);
 });
 it('A session token cannot rename a participant in another session',async()=>{
  const a=(await f.init()).json();const r=await f.app.inject({method:'PATCH',url:`/v1/sessions/${crypto.randomUUID()}/participant`,headers:{authorization:`Bearer ${a.session_token}`},payload:{display_name:'x'}});expect(r.statusCode).toBe(403);
 });
});
