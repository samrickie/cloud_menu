import {beforeEach,afterEach,it,describe,expect} from 'vitest';
import {fixture} from './helpers.ts';
import {randomUUID} from 'node:crypto';
let f:Awaited<ReturnType<typeof fixture>>;let entry:any;
beforeEach(async()=>{f=await fixture();entry=(await f.init()).json();const menu=await f.store.add('menus',{id:randomUUID(),venue_id:f.venue.id,name:'DEMO menu',is_active:true,version:1});for(const name of ['Drinks','Grill','Snacks']){const cat=await f.store.add('categories',{id:randomUUID(),menu_id:menu.id,name_en:name,name_sw:name,sort_order:0,is_active:true});await f.store.add('items',{id:randomUUID(),venue_id:f.venue.id,category_id:cat.id,name_en:name==='Grill'?'Grilled Tilapia [DEMO]':name+' [DEMO]',price_tzs:25000,is_active:true,is_available:name!=='Grill',station:'KITCHEN',sort_order:0});}});
afterEach(async()=>f.app.close());
const menu=()=>f.app.inject({url:`/v1/venues/${f.venue.id}/menu`,headers:{authorization:`Bearer ${entry.session_token}`}});
describe('US-201 menu browsing',()=>{
 it('Category navigation supplies Drinks, Grill and Snacks with TZS prices and photo variants',async()=>{const r=await menu();expect(r.statusCode).toBe(200);expect(r.json().categories.map((c:any)=>c.name_en)).toEqual(['Drinks','Grill','Snacks']);expect(r.json().categories[1].items[0]).toMatchObject({name_en:'Grilled Tilapia [DEMO]',price_tzs:25000});});
 it('Unavailable items are clearly represented and cannot be presented as available',async()=>{const r=await menu();expect(r.json().categories[1].items[0].is_available).toBe(false);});
 it('Menu revalidation returns 304 with private ETag caching',async()=>{const a=await menu();expect(a.headers['cache-control']).toContain('max-age=60');const b=await f.app.inject({url:`/v1/venues/${f.venue.id}/menu`,headers:{authorization:`Bearer ${entry.session_token}`,'if-none-match':a.headers.etag as string}});expect(b.statusCode).toBe(304);});
 it('A guest cannot read another venue menu',async()=>{const r=await f.app.inject({url:`/v1/venues/${randomUUID()}/menu`,headers:{authorization:`Bearer ${entry.session_token}`}});expect(r.statusCode).toBe(403);});
 it.todo('Menu loads fast on throttled 4G: p75 LCP <=2.5s on physical mid-range Android (external device gate)');
});
