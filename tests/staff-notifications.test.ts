import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('bells are venue and station scoped; read state belongs to each staff member and survives reconnect',async()=>{
 const f=await fixture();
 try{
 const login=async(role:string,venue=f.venue.id)=>{const s=await f.store.add('staff_users',{id:randomUUID(),venue_id:venue,role,is_active:true});return {authorization:'Bearer '+await auth(secrets.token).sign({kind:'staff',staff_id:s.id,venue_id:venue,role},3600)};};
 const kitchen=await login('KITCHEN'),bar=await login('BAR'),waiter=await login('WAITER'),otherWaiter=await login('WAITER');
 const foreign=await f.store.add('venues',{id:randomUUID(),name:'Other sample venue',status:'ACTIVE'}),foreignStaff=await login('WAITER',foreign.id);
 const add=(event_type:string,payload:object,venue_id=f.venue.id)=>f.store.add('realtime_events',{venue_id,event_type,payload,created_at:new Date().toISOString()});
 await add('order.created',{id:randomUUID(),order_no:1,items:[{station:'KITCHEN',name:'Meal'}]});
 await add('order.created',{id:randomUUID(),order_no:2,items:[{station:'BAR',name:'Drink'}]});
 await add('order.status_changed',{order_id:randomUUID(),item_status:'READY',station:'BAR'});
 await add('waiter.called',{call_id:randomUUID(),reason:'WATER'});
 const list=(headers:Record<string,string>)=>f.app.inject({url:'/v1/staff/notifications',headers});
 expect((await list(kitchen)).json().unread).toBe(1);expect((await list(bar)).json().unread).toBe(1);
 expect((await list(foreignStaff)).json().unread).toBe(0);
 const before=(await list(waiter)).json();expect(before.unread).toBe(2);
 await add('order.created',{id:randomUUID(),order_no:3,items:[{station:'KITCHEN',name:'New meal'}]});
 const read=await f.app.inject({method:'POST',url:'/v1/staff/notifications/read',headers:waiter,payload:{through:before.through}});expect(read.statusCode).toBe(200);
 expect((await list(waiter)).json().unread).toBe(0);expect((await list(otherWaiter)).json().unread).toBe(2);
 expect((await f.app.inject({method:'POST',url:'/v1/staff/notifications/read',headers:waiter,payload:{through:99999}})).statusCode).toBe(422);
 expect((await f.app.inject({url:'/v1/staff/notifications?venue_id='+foreign.id,headers:waiter})).statusCode).toBe(422);
 }finally{await f.app.close();}
});
