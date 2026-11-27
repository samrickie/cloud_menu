import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('new attention is station-scoped, acknowledges per staff, and starting a ticket clears new without removing work',async()=>{
 const f=await fixture();try{
 const login=async(role:string)=>{const s=await f.store.add('staff_users',{id:randomUUID(),venue_id:f.venue.id,role,is_active:true});return {authorization:'Bearer '+await auth(secrets.token).sign({kind:'staff',staff_id:s.id,venue_id:f.venue.id,role},3600)};};
 const kitchen=await login('KITCHEN'),chef2=await login('KITCHEN'),bar=await login('BAR'),waiter=await login('WAITER');
 const session=(await f.init()).json().session;
 const order=await f.store.add('orders',{id:randomUUID(),venue_id:f.venue.id,session_id:session.id,order_no:1,created_at:new Date().toISOString(),status:'NEW'});
 for(const station of ['KITCHEN','BAR'])await f.store.add('order_items',{id:randomUUID(),order_id:order.id,station,status:'NEW',name_snapshot:station,quantity:1});
 const get=async(headers:Record<string,string>)=>(await f.app.inject({url:'/v1/staff/attention',headers})).json();
 const items=(await get(kitchen)).work;expect(items).toHaveLength(1);expect(items[0].items[0].name).toBe('KITCHEN');expect(items[0].is_new).toBe(true);
 expect((await get(bar)).work[0].items[0].name).toBe('BAR');expect((await get(waiter)).work).toHaveLength(0);
 expect((await f.app.inject({method:'POST',url:'/v1/staff/attention/acknowledge',headers:kitchen,payload:{kind:'ORDER',id:order.id}})).statusCode).toBe(200);
 expect((await get(kitchen)).work[0].is_new).toBe(false);expect((await get(chef2)).work[0].is_new).toBe(true);
 await f.store.patch('order_items',{order_id:order.id,station:'KITCHEN'},{status:'PREPARING'});expect((await get(chef2)).work[0].is_new).toBe(false);expect((await get(chef2)).work).toHaveLength(1);
 expect((await f.app.inject({method:'POST',url:'/v1/staff/attention/acknowledge',headers:kitchen,payload:{kind:'ORDER',id:randomUUID()}})).statusCode).toBe(404);
 expect((await f.app.inject({method:'PUT',url:'/v1/staff/attention/preferences',headers:kitchen,payload:{muted:false}})).statusCode).toBe(200);expect((await get(kitchen)).muted).toBe(false);expect((await get(chef2)).muted).toBe(true);
 }finally{await f.app.close();}
});
