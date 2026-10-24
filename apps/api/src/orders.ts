import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {hash,Problem} from './security.ts';
import {context,idParams,type Context} from './context.ts';
import {menuData} from './menu.ts';
import {priceLine,PricingError,tzs} from '../../../packages/shared/src/pricing.ts';
import type {MenuItem} from '../../../packages/shared/src/index.ts';
import type {Row} from './store.ts';
const inputSchema=z.object({client_order_id:z.uuid(),note:z.string().max(500).optional(),items:z.array(z.object({item_id:z.uuid(),quantity:z.number().int().min(1).max(99),modifiers:z.array(z.object({modifier_id:z.uuid()})).max(30).default([]),note:z.string().max(500).optional()})).min(1).max(99),quote_token:z.string().max(4000).optional()});
async function priced(ctx:Context,venue:string,input:z.infer<typeof inputSchema>){
 const menu=await menuData(ctx,venue);const items=menu.categories.flatMap(c=>c.items);const lines=[];
 for(const line of input.items){
  const item=items.find(i=>i.id===line.item_id) as MenuItem|undefined;if(!item||!item.is_available)throw new Problem(409,'ITEM_UNAVAILABLE','Item unavailable',{item_ids:[line.item_id]});
  const selected=line.modifiers.map(m=>m.modifier_id);let total:number;
  try{total=priceLine(item,selected,line.quantity);}catch(e){if(e instanceof PricingError)throw new Problem(422,e.code,e.message);throw e;}
  const modifiers=item.modifier_groups.flatMap(g=>g.modifiers).filter(m=>selected.includes(m.id));
  lines.push({item_id:item.id,name:item.name_en,quantity:line.quantity,unit_price_tzs:item.price_tzs,modifiers_total_tzs:modifiers.reduce((sum,m)=>sum+m.price_delta_tzs,0),line_total_tzs:total,station:(item as any).station,note:line.note??null,modifiers});
 }
 return {lines,subtotal_tzs:tzs(lines.reduce((sum,line)=>sum+line.line_total_tzs,0))};
}
export function registerOrders(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,publish?:(venue:string,seq:number)=>Promise<void>){
 app.post('/v1/sessions/:id/order-quote',async request=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`quote:${sid}`,30);const input=inputSchema.parse(request.body);
  return ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{const p=await priced(context(tx,''),guest.venue_id,input);return {...p,quote_token:await ctx.tokens.sign({kind:'quote',session_id:sid,request_hash:hash(JSON.stringify({...input,quote_token:undefined})),price_hash:hash(JSON.stringify(p))},300)};});
 });
 app.post('/v1/sessions/:id/orders',async(request,reply)=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`orders:${sid}`,10);const key=z.uuid().parse(request.headers['idempotency-key']);const input=inputSchema.parse(request.body);
  const bodyHash=hash(JSON.stringify(input)),clientHash=hash(JSON.stringify({...input,quote_token:undefined})),scope=`orders:create:${sid}`;
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const [session]=await tx.rows('table_sessions',{id:sid,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');
   const [saved]=await tx.rows('idempotency_keys',{scope,key});
   if(saved&&new Date(saved.expires_at).getTime()>Date.now()){if(saved.request_hash!==bodyHash)throw new Problem(422,'IDEMPOTENCY_CONFLICT');return {body:saved.response_body,replay:true};}
   const [existing]=await tx.rows('orders',{session_id:sid,client_order_id:input.client_order_id});
   if(existing){if(existing.request_hash!==clientHash)throw new Problem(422,'IDEMPOTENCY_CONFLICT');const lines=await tx.rows('order_items',{order_id:existing.id});return {body:{order:{...existing,items:lines.map(l=>({...l,name:l.name_snapshot}))},repriced:false},replay:true};}
   const p=await priced(context(tx,''),guest.venue_id,input);
   if(input.quote_token){const quote=await ctx.tokens.verify(input.quote_token);if(quote.kind!=='quote'||quote.session_id!==sid||quote.request_hash!==clientHash||quote.price_hash!==hash(JSON.stringify(p)))throw new Problem(409,'PRICE_CHANGED','Review the updated total before confirming.');}
   const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const previous=(await tx.rows('orders',{venue_id:guest.venue_id})).filter(o=>o.business_date===date);
   const order=await tx.add('orders',{id:randomUUID(),venue_id:guest.venue_id,session_id:sid,placed_by:guest.participant_id,order_no:previous.reduce((n,o)=>Math.max(n,o.order_no),0)+1,business_date:date,client_order_id:input.client_order_id,request_hash:clientHash,status:'NEW',subtotal_tzs:p.subtotal_tzs,note:input.note??null,created_at:new Date().toISOString()});
   const lines:Row[]=[];for(const l of p.lines){const line=await tx.add('order_items',{id:randomUUID(),order_id:order.id,item_id:l.item_id,participant_id:guest.participant_id,name_snapshot:l.name,unit_price_tzs:l.unit_price_tzs,modifiers_total_tzs:l.modifiers_total_tzs,quantity:l.quantity,line_total_tzs:l.line_total_tzs,note:l.note,station:l.station,status:'NEW'});for(const m of l.modifiers)await tx.add('order_item_modifiers',{id:randomUUID(),order_item_id:line.id,modifier_id:m.id,name_snapshot:m.name_en,price_delta_tzs:m.price_delta_tzs});lines.push({...line,name:l.name});}
   const response={order:{...order,items:lines},repriced:false};const event=await tx.add('realtime_events',{venue_id:guest.venue_id,session_id:sid,event_type:'order.created',payload:response.order});
   const idem={scope,key,request_hash:bodyHash,response_code:201,response_body:response,expires_at:new Date(Date.now()+86400000).toISOString()};if(saved)await tx.patch('idempotency_keys',{scope,key},idem);else await tx.add('idempotency_keys',idem);
   await tx.patch('table_sessions',{id:sid},{last_activity_at:new Date().toISOString()});return {body:response,replay:false,seq:event.seq};
  });
  if(result.seq&&publish)await publish(guest.venue_id,Number(result.seq)).catch(()=>{});reply.code(result.replay?200:201);return result.body;
 });
 app.get('/v1/staff/orders',async request=>{
  const staff=await ctx.staff(request);
  const query=z.object({status:z.literal('NEW').optional(),station:z.enum(['KITCHEN','BAR']).optional(),since_seq:z.coerce.number().int().min(0).default(0)}).parse(request.query);
  const station=['KITCHEN','BAR'].includes(staff.role as string)?staff.role:query.station;
  const orders=[];for(const o of await ctx.store.rows('orders',{venue_id:staff.venue_id})){const lines=(await ctx.store.rows('order_items',{order_id:o.id})).filter(l=>!station||l.station===station);if(lines.length)orders.push({...o,items:lines});}
  const seq=(await ctx.store.rows('realtime_events',{venue_id:staff.venue_id})).reduce((n,e)=>Math.max(n,Number(e.seq)),0);return {orders,seq};
 });
}
