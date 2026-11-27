import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('staff see current-day history plus unfinished carry-over; owners retain old history',async()=>{
 const f=await fixture();try{const session=(await f.init()).json().session;
 for(const [status,age]of [['SERVED',72],['NEW',72],['SERVED',0]] as const){const o=await f.store.add('orders',{id:randomUUID(),venue_id:f.venue.id,session_id:session.id,status,created_at:new Date(Date.now()-age*3600000).toISOString()});await f.store.add('order_items',{id:randomUUID(),order_id:o.id,station:'KITCHEN',status});}
 const get=async(role:string)=>{const s=await f.store.add('staff_users',{id:randomUUID(),venue_id:f.venue.id,role,is_active:true});return f.app.inject({url:'/v1/staff/orders',headers:{authorization:'Bearer '+await auth(secrets.token).sign({kind:'staff',staff_id:s.id,venue_id:f.venue.id,role},3600)}});};
 const kitchen=await get('KITCHEN');expect(kitchen.statusCode).toBe(200);expect(kitchen.json().orders).toHaveLength(2);expect((await get('OWNER')).json().orders).toHaveLength(3);
 }finally{await f.app.close();}
});
