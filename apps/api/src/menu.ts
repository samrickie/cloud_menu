import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Problem } from './security.ts';
import type { Context } from './context.ts';
export async function menuData(ctx:Context,venue_id:string){
 const menus=await ctx.store.rows('menus',{venue_id,is_active:true});const categories=[];
 for(const m of menus){for(const c of (await ctx.store.rows('categories',{menu_id:m.id,is_active:true})).sort((a,b)=>a.sort_order-b.sort_order)){
  const items=[];for(const item of (await ctx.store.rows('items',{venue_id,category_id:c.id,is_active:true})).sort((a,b)=>a.sort_order-b.sort_order)){
   const groups=[];for(const link of await ctx.store.rows('item_modifier_groups',{item_id:item.id})){
    const [group]=await ctx.store.rows('modifier_groups',{id:link.group_id,venue_id});if(group)groups.push({...group,modifiers:(await ctx.store.rows('modifiers',{group_id:group.id})).map(m=>({...m,price_delta_tzs:Number(m.price_delta_tzs)}))});
   }
   items.push({...item,price_tzs:Number(item.price_tzs),modifier_groups:groups,image_variants:item.image_key?[320,640,960].map(w=>({width:w,url:`/media/${item.image_key}-${w}.webp`})) : []});
  }categories.push({...c,items});
 }}return {venue_id,currency:'TZS',version:menus.reduce((sum,m)=>sum+m.version,0),categories};
}
export function registerMenu(app:FastifyInstance,ctx:Context){
 app.get('/v1/venues/:venue_id/menu',async(request,reply)=>{
  const guest=await ctx.guest(request);const {venue_id}=z.object({venue_id:z.uuid()}).parse(request.params);if(guest.venue_id!==venue_id)throw new Problem(403,'VENUE_FORBIDDEN');
  const data=await menuData(ctx,venue_id);const etag=`"${venue_id}:${data.version}"`;
  reply.header('ETag',etag).header('Cache-Control','private, max-age=60, stale-while-revalidate=300').header('Vary','Authorization');
  if(request.headers['if-none-match']===etag)return reply.code(304).send();return data;
 });
}
