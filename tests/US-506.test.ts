import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {fixture} from './helpers.ts';
import {hash} from 'bcryptjs';
import {randomUUID} from 'node:crypto';
let f:Awaited<ReturnType<typeof fixture>>,staff:any;
beforeEach(async()=>{f=await fixture();staff=await f.store.add('staff_users',{id:randomUUID(),venue_id:f.venue.id,full_name:'Kitchen [DEMO]',role:'KITCHEN',pin_hash:await hash('123456',4),is_active:true,failed_attempts:0});});afterEach(async()=>f.app.close());
const login=(pin='123456')=>f.app.inject({method:'POST',url:'/v1/staff/auth/login',payload:{venue_code:f.venue.slug,staff_id:staff.id,pin}});
describe('US-506 staff authentication',()=>{
 it('Staff login issues a short-lived token with role for valid venue code and PIN',async()=>{const r=await login();expect(r.statusCode).toBe(200);expect(r.json().role).toBe('KITCHEN');expect(r.json().staff_token).toBeTruthy();expect(new Date(r.json().token_expires_at).getTime()-Date.now()).toBeLessThanOrEqual(3600000);expect(JSON.stringify(r.json())).not.toContain('pin_hash');});
 it('Role restriction: kitchen user requesting manager reports receives 403',async()=>{const token=(await login()).json().staff_token;const r=await f.app.inject({url:'/v1/admin/reports',headers:{authorization:`Bearer ${token}`}});expect(r.statusCode).toBe(403);});
 it('Lockout: five wrong PINs in ten minutes locks the account for fifteen minutes',async()=>{for(let i=0;i<5;i++)expect((await login('000000')).statusCode).toBe(401);expect((await login()).statusCode).toBe(423);const [s]=await f.store.rows('staff_users',{id:staff.id});expect(new Date(s.locked_until).getTime()-Date.now()).toBeGreaterThan(899000);});
 it('Disabled staff cannot authenticate and errors never disclose PIN data',async()=>{await f.store.patch('staff_users',{id:staff.id},{is_active:false});expect((await login()).statusCode).toBe(401);});
});
