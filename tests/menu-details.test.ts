import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('menu details persist bilingual specs and reject oversized metadata',async()=>{
 const f=await fixture();try{const staff=await f.store.add('staff_users',{id:randomUUID(),venue_id:f.venue.id,role:'OWNER',is_active:true}),headers={authorization:'Bearer '+await auth(secrets.token).sign({kind:'staff',staff_id:staff.id,venue_id:f.venue.id,role:'OWNER'},3600)},menu=await f.store.add('menus',{id:randomUUID(),venue_id:f.venue.id,is_active:true,version:1}),category=await f.store.add('categories',{id:randomUUID(),menu_id:menu.id,is_active:true,sort_order:0});
 const payload={category_id:category.id,name_en:'Sample meal',price_tzs:5000,details_en:{ingredients:'Rice, fish',size:'One serving',allergens:'Fish',notes:'Made fresh'},details_sw:{size:'Sahani moja'}};
 const result=await f.app.inject({method:'POST',url:'/v1/admin/items',headers,payload});expect(result.statusCode).toBe(201);
 const entry=(await f.init()).json(),visible=await f.app.inject({url:`/v1/venues/${f.venue.id}/menu`,headers:{authorization:'Bearer '+entry.session_token}});
 expect(visible.json().categories[0].items[0].details_en).toEqual(payload.details_en);expect(visible.json().categories[0].items[0].details_sw.size).toBe('Sahani moja');
 expect((await f.app.inject({method:'POST',url:'/v1/admin/items',headers,payload:{...payload,details_en:{notes:'x'.repeat(501)}}})).statusCode).toBe(422);
 }finally{await f.app.close();}
});
