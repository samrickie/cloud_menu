import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('owner limits are tenant scoped and overdue persists through ready and acknowledgment until served',async()=>{
 const f=await fixture();try{
 const login=async(role:string,venue=f.venue.id)=>{const s=await f.store.add('staff_users',{id:randomUUID(),venue_id:venue,role,is_active:true});return {authorization:'Bearer '+await auth(secrets.token).sign({kind:'staff',staff_id:s.id,venue_id:venue,role},3600)};};
 const owner=await login('OWNER'),kitchen=await login('KITCHEN');const get=async(headers=owner)=>(await f.app.inject({url:'/v1/staff/attention',headers})).json();
 const settings=await f.app.inject({url:'/v1/owner/service-settings',headers:owner});expect(settings.statusCode).toBe(200);expect(settings.json().default_minutes).toBe(20);
 const input={default_minutes:20,kitchen_minutes:1,bar_minutes:10,waiter_minutes:1,business_day_cutoff:'04:00',expected_revision:0};
 expect((await f.app.inject({method:'PUT',url:'/v1/owner/service-settings',headers:kitchen,payload:input})).statusCode).toBe(403);
 expect((await f.app.inject({method:'PUT',url:'/v1/owner/service-settings',headers:owner,payload:input})).statusCode).toBe(200);
 expect((await f.app.inject({method:'PUT',url:'/v1/owner/service-settings',headers:owner,payload:input})).statusCode).toBe(409);
 const session=(await f.init()).json().session,order=await f.store.add('orders',{id:randomUUID(),venue_id:f.venue.id,session_id:session.id,order_no:1,created_at:new Date(Date.now()-120000).toISOString(),status:'NEW'});
 for(const station of ['KITCHEN','BAR'])await f.store.add('order_items',{id:randomUUID(),order_id:order.id,station,status:'NEW',name_snapshot:station,quantity:1});
 const work=(await get()).work;expect(work.find((w:any)=>w.station==='KITCHEN').overdue).toBe(true);expect(work.find((w:any)=>w.station==='BAR').overdue).toBe(false);
 await f.app.inject({method:'POST',url:'/v1/staff/attention/acknowledge',headers:kitchen,payload:{kind:'ORDER',id:order.id}});expect((await get(kitchen)).work[0].overdue).toBe(true);
 await f.store.patch('order_items',{order_id:order.id,station:'KITCHEN'},{status:'READY'});expect((await get(kitchen)).work).toHaveLength(0);expect((await get(await login('WAITER'))).work[0].overdue).toBe(true);
 await f.store.patch('order_items',{order_id:order.id,station:'KITCHEN'},{status:'SERVED'});expect((await get(kitchen)).work).toHaveLength(0);
 const foreign=await f.store.add('venues',{id:randomUUID(),status:'ACTIVE'});expect((await get(await login('OWNER',foreign.id))).work).toHaveLength(0);
 }finally{await f.app.close();}
});
