import type {FastifyInstance} from 'fastify';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Context} from './context.ts';
import type {Row} from './store.ts';
import {Problem,signQR,checkQR} from './security.ts';
import {menuData} from './menu.ts';
export function registerOnlineMenu(app:FastifyInstance,ctx:Context,secret:string,origin:string,limit:(key:string,max:number)=>Promise<void>){
 const scope=(r:Row)=>JSON.stringify(['online-menu',r.venue_id]);
 const view=(r?:Row)=>{const url=r?new URL('/',origin):null;if(url&&r)url.searchParams.set('menu',signQR(r.share_id,1,secret,scope(r)));return {enabled:r?.enabled??false,revision:r?.revision??0,url:url?.toString()??null};};
 app.get('/v1/owner/online-menu',async req=>{const s=await ctx.staff(req,['OWNER']);return view((await ctx.store.rows('venue_online_menu',{venue_id:s.venue_id}))[0]);});
 app.put('/v1/owner/online-menu',async req=>{
  const s=await ctx.staff(req,['OWNER']);await limit(`online-menu-owner:${s.id}`,30);
  const input=z.object({action:z.enum(['ENABLE','DISABLE','ROTATE']),expected_revision:z.number().int().nonnegative()}).strict().parse(req.body);
  return ctx.store.tx(`venue:${s.venue_id}`,async tx=>{
   const key={venue_id:s.venue_id},[old]=await tx.rows('venue_online_menu',key);if((old?.revision??0)!==input.expected_revision)throw new Problem(409,'ONLINE_MENU_CHANGED');
   const next={...key,share_id:!old||input.action==='ROTATE'?randomUUID():old.share_id,enabled:input.action==='ENABLE'?true:input.action==='DISABLE'?false:old?.enabled??false,revision:(old?.revision??0)+1};
   if(old)await tx.patch('venue_online_menu',key,next);else await tx.add('venue_online_menu',next);
   await tx.add('audit_log',{venue_id:s.venue_id,actor_type:'STAFF',actor_id:s.id,action:'ONLINE_MENU_'+input.action,entity_type:'venue',entity_id:s.venue_id});return view(next);
  });
 });
 app.get('/v1/online-menu',async(req,reply)=>{
  await limit(`online-menu-public:${req.ip}`,120);reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');
  const {token}=z.object({token:z.string().min(1).max(200)}).strict().parse(req.query),id=token.split('.')[0];
  if(!z.uuid().safeParse(id).success)throw new Problem(404,'ONLINE_MENU_UNAVAILABLE');
  const [link]=await ctx.store.rows('venue_online_menu',{share_id:id,enabled:true});
  if(!link||!checkQR(token,link.share_id,1,secret,scope(link))||!await ctx.store.venueAccess(link.venue_id))throw new Problem(404,'ONLINE_MENU_UNAVAILABLE');
  const [venue]=await ctx.store.rows('venues',{id:link.venue_id}),[profile]=await ctx.store.rows('venue_profiles',{venue_id:link.venue_id});
  return {view_only:true,venue:{id:venue.id,name:venue.name,is_sample:!!venue.is_sample,theme:profile?.theme??'noir',brand_colour:profile?.brand_colour??null,primary_text:profile?.primary_text??null},menu:await menuData(ctx,link.venue_id)};
 });
}
