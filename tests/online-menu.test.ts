import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('online-menu links are owner scoped, view-only, and immediately revoked by disable or rotation',async()=>{
 const f=await fixture({guestOrigin:'https://sample.example.test'});try{
 const staff=async(role:string,venue=f.venue.id)=>{const s=await f.store.add('staff_users',{id:randomUUID(),venue_id:venue,role,is_active:true});return {authorization:'Bearer '+await auth(secrets.token).sign({kind:'staff',staff_id:s.id,venue_id:venue,role},3600)};};
 const owner=await staff('OWNER'),kitchen=await staff('KITCHEN');
 const set=(action:string,revision:number,headers=owner)=>f.app.inject({method:'PUT',url:'/v1/owner/online-menu',headers,payload:{action,expected_revision:revision}});
 expect((await set('ENABLE',0,kitchen)).statusCode).toBe(403);
 const enabled=await set('ENABLE',0);expect(enabled.statusCode).toBe(200);const token=new URL(enabled.json().url).searchParams.get('menu')!;
 const read=(value=token)=>f.app.inject({url:'/v1/online-menu?token='+encodeURIComponent(value)});
 const visible=await read();expect(visible.statusCode).toBe(200);expect(visible.json().view_only).toBe(true);expect(visible.json().session_token).toBeUndefined();
 expect((await f.app.inject({method:'POST',url:'/v1/sessions/init',payload:{qr:token,device_id:randomUUID()}})).statusCode).toBeGreaterThanOrEqual(400);
 const entry=(await f.init()).json(),key=randomUUID();expect((await f.app.inject({method:'POST',url:`/v1/sessions/${entry.session.id}/orders`,headers:{authorization:'Bearer '+token,'Idempotency-Key':key},payload:{client_order_id:key,items:[]}})).statusCode).toBeGreaterThanOrEqual(400);
 expect((await read(token.slice(0,-1)+(token.endsWith('a')?'b':'a'))).statusCode).toBe(404);
 expect((await set('ROTATE',1)).statusCode).toBe(200);expect((await read()).statusCode).toBe(404);
 const current=(await f.app.inject({url:'/v1/owner/online-menu',headers:owner})).json(),newToken=new URL(current.url).searchParams.get('menu')!;expect((await read(newToken)).statusCode).toBe(200);
 await set('DISABLE',2);expect((await read(newToken)).statusCode).toBe(404);expect((await f.init()).statusCode).toBeLessThan(300);
 const foreign=await f.store.add('venues',{id:randomUUID(),status:'ACTIVE'});expect((await f.app.inject({url:'/v1/owner/online-menu',headers:await staff('OWNER',foreign.id)})).json().url).toBeNull();
 }finally{await f.app.close();}
});
