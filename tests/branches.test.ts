import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('owner lists only their branches and cannot copy another owner’s menu',async()=>{
 const f=await fixture();try{
 const a=await f.store.add('owner_accounts',{id:randomUUID(),email:'sample-owner@example.test',is_active:true,auth_version:1});await f.store.patch('venues',{id:f.venue.id},{owner_account_id:a.id});
 const headers={authorization:'Bearer '+await auth(secrets.token).sign({kind:'account',account_id:a.id,auth_version:1},3600)};
 const other=await f.store.add('venues',{id:randomUUID(),name:'Sample foreign branch',status:'ACTIVE',owner_account_id:randomUUID()});
 const list=await f.app.inject({url:'/v1/owner/branches',headers});expect(list.statusCode).toBe(200);expect(list.json().branches.map((b:any)=>b.id)).toEqual([f.venue.id]);
 expect((await f.app.inject({method:'POST',url:'/v1/owner/branches/'+f.venue.id+'/copy-menu',headers,payload:{source_branch_id:other.id,confirm_name:f.venue.name}})).statusCode).toBe(404);
 }finally{await f.app.close();}
});

it('copying a menu creates independent IDs and specs while resetting stock and ratings',async()=>{
 const f=await fixture();try{
 const a=await f.store.add('owner_accounts',{id:randomUUID(),email:'sample-copy@example.test',is_active:true,auth_version:1});
 await f.store.patch('venues',{id:f.venue.id},{owner_account_id:a.id});
 const target=await f.store.add('venues',{id:randomUUID(),name:'Sample destination',status:'ACTIVE',owner_account_id:a.id});
 const m=await f.store.add('menus',{id:randomUUID(),venue_id:f.venue.id,name:'Sample menu',is_active:true,version:1});
 const c=await f.store.add('categories',{id:randomUUID(),menu_id:m.id,name_en:'Sample food',is_active:true});
 const i=await f.store.add('items',{id:randomUUID(),venue_id:f.venue.id,category_id:c.id,name_en:'Sample meal',is_active:true,is_available:true,stock_quantity:15,food_rating_count:7,food_rating_sum:35,details_en:{allergens:'Sample nuts'},price_tzs:4000});
 const g=await f.store.add('modifier_groups',{id:randomUUID(),venue_id:f.venue.id,name_en:'Sample sizes'});
 await f.store.add('modifiers',{id:randomUUID(),group_id:g.id,name_en:'Sample large',price_delta_tzs:500});
 await f.store.add('item_modifier_groups',{item_id:i.id,group_id:g.id});
 const headers={authorization:'Bearer '+await auth(secrets.token).sign({kind:'account',account_id:a.id,auth_version:1},3600)};
 const response=await f.app.inject({method:'POST',url:'/v1/owner/branches/'+target.id+'/copy-menu',headers,payload:{source_branch_id:f.venue.id,confirm_name:target.name}});
 expect(response.statusCode).toBe(200);
 const [copy]=await f.store.rows('items',{venue_id:target.id});
 expect(copy.id).not.toBe(i.id);expect(copy.details_en).toEqual(i.details_en);expect(copy.stock_quantity).toBe(0);expect(copy.food_rating_count).toBe(0);expect(copy.is_available).toBe(false);
 const [link]=await f.store.rows('item_modifier_groups',{item_id:copy.id});expect(link.group_id).not.toBe(g.id);
 expect((await f.store.rows('modifiers',{group_id:link.group_id}))[0].price_delta_tzs).toBe(500);
 expect((await f.store.rows('items',{id:i.id}))[0].stock_quantity).toBe(15);
 }finally{await f.app.close();}
});
