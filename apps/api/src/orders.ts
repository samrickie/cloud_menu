import {serviceSettings,businessDay} from './service-settings.ts';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {hash,Problem} from './security.ts';
import {idParams,type Context} from './context.ts';
import {menuData} from './menu.ts';
import {priceLine,PricingError,tzs} from '../../../packages/shared/src/pricing.ts';
import type {MenuItem} from '../../../packages/shared/src/index.ts';
import type {Row} from './store.ts';
import {deductStock} from './inventory.ts';
import {syncBill} from './billing.ts';
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
export function registerOrders(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,publish?:(venue:string,seq:number)=>Promise<void>,enabled=true){
 app.post('/v1/sessions/:id/order-quote',async request=>{
  if(!enabled)throw new Problem(503,'ORDERING_DISABLED');
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`quote:${sid}`,30);const input=inputSchema.parse(request.body);
  return ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{const p=await priced({...ctx,store:tx},guest.venue_id,input);return {...p,quote_token:await ctx.tokens.sign({kind:'quote',session_id:sid,request_hash:hash(JSON.stringify({...input,quote_token:undefined})),price_hash:hash(JSON.stringify(p))},300)};});
 });
 app.post('/v1/sessions/:id/orders',async(request,reply)=>{
  if(!enabled)throw new Problem(503,'ORDERING_DISABLED');
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`orders:${sid}`,10);const key=z.uuid().parse(request.headers['idempotency-key']);const input=inputSchema.parse(request.body);
  const clientHash=hash(JSON.stringify({...input,quote_token:undefined})),bodyHash=clientHash,scope=`orders:create:${sid}`;
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   if(!await tx.venueAccess(guest.venue_id))throw new Problem(403,'VENUE_SUSPENDED');
   const [session]=await tx.rows('table_sessions',{id:sid,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');
   const [saved]=await tx.rows('idempotency_keys',{scope,key});
   if(saved&&new Date(saved.expires_at).getTime()>Date.now()){if(saved.response_body?.order?.placed_by!==guest.participant_id||saved.request_hash!==bodyHash)throw new Problem(422,'IDEMPOTENCY_CONFLICT');return {body:saved.response_body,replay:true};}
   const [existing]=await tx.rows('orders',{session_id:sid,client_order_id:input.client_order_id});
   if(existing){if(existing.placed_by!==guest.participant_id||existing.request_hash!==clientHash)throw new Problem(422,'IDEMPOTENCY_CONFLICT');const lines=await tx.rows('order_items',{order_id:existing.id});return {body:{order:{...existing,items:lines.map(l=>({...l,name:l.name_snapshot}))},repriced:false},replay:true};}
   const p=await priced({...ctx,store:tx},guest.venue_id,input);
   if(input.quote_token){const quote=await ctx.tokens.verify(input.quote_token);if(quote.kind!=='quote'||quote.session_id!==sid||quote.request_hash!==clientHash||quote.price_hash!==hash(JSON.stringify(p)))throw new Problem(409,'PRICE_CHANGED','Review the updated total before confirming.');}
   const date=businessDay((await serviceSettings(tx,guest.venue_id)).business_day_cutoff).date;
   const previous=(await tx.rows('orders',{venue_id:guest.venue_id})).filter(o=>o.business_date===date);
   const order=await tx.add('orders',{id:randomUUID(),venue_id:guest.venue_id,session_id:sid,placed_by:guest.participant_id,order_no:previous.reduce((n,o)=>Math.max(n,o.order_no),0)+1,business_date:date,client_order_id:input.client_order_id,request_hash:clientHash,status:'NEW',subtotal_tzs:p.subtotal_tzs,note:input.note??null,created_at:new Date().toISOString()});
   await deductStock(tx,guest.venue_id,order.id,p.lines);
   const lines:Row[]=[];for(const l of p.lines){const line=await tx.add('order_items',{id:randomUUID(),order_id:order.id,item_id:l.item_id,participant_id:guest.participant_id,name_snapshot:l.name,unit_price_tzs:l.unit_price_tzs,modifiers_total_tzs:l.modifiers_total_tzs,quantity:l.quantity,line_total_tzs:l.line_total_tzs,note:l.note,station:l.station,status:'NEW'});for(const m of l.modifiers)await tx.add('order_item_modifiers',{id:randomUUID(),order_item_id:line.id,modifier_id:m.id,name_snapshot:m.name_en,price_delta_tzs:m.price_delta_tzs});lines.push({...line,name:l.name});}
   const [notificationTable]=await tx.rows('dining_tables',{id:session.table_id,venue_id:guest.venue_id});
   const response={order:{...order,table_label:notificationTable?.label??null,items:lines},repriced:false};const event=await tx.add('realtime_events',{venue_id:guest.venue_id,session_id:sid,event_type:'order.created',payload:response.order});const billing=await syncBill(tx,guest.venue_id,sid);
   const idem={scope,key,request_hash:bodyHash,response_code:201,response_body:response,expires_at:new Date(Date.now()+86400000).toISOString()};if(saved)await tx.patch('idempotency_keys',{scope,key},idem);else await tx.add('idempotency_keys',idem);
   await tx.patch('table_sessions',{id:sid},{last_activity_at:new Date().toISOString()});return {body:response,replay:false,seq:billing.seq??event.seq};
  });
  if(result.seq&&publish)await publish(guest.venue_id,Number(result.seq)).catch(()=>{});reply.code(result.replay?200:201);return result.body;
 });
 app.patch('/v1/staff/orders/:id/items/:line/status',async request=>{
  const staff=await ctx.staff(request,['KITCHEN','BAR','WAITER','MANAGER','OWNER']);
  const {id,line}=z.object({id:z.uuid(),line:z.uuid()}).parse(request.params);
  const {status}=z.object({status:z.enum(['ACCEPTED','PREPARING','READY','SERVED'])}).strict().parse(request.body);
  const result=await ctx.store.tx('venue:'+staff.venue_id,async tx=>{
   const [order]=await tx.rows('orders',{id,venue_id:staff.venue_id});
   if(!order)throw new Problem(404,'ORDER_NOT_FOUND');
   const lines=await tx.rows('order_items',{order_id:id}),item=lines.find(i=>i.id===line);
   if(!item||(['KITCHEN','BAR'].includes(staff.role)&&item.station!==staff.role))throw new Problem(404,'ITEM_NOT_FOUND');
   if((staff.role==='WAITER'&&status!=='SERVED')||(['KITCHEN','BAR'].includes(staff.role)&&status==='SERVED'))throw new Problem(403,'ROLE_FORBIDDEN');
   if(item.status===status)return {status,seq:0};
   const steps=['NEW','ACCEPTED','PREPARING','READY','SERVED'];
   if(steps.indexOf(item.status)<0||steps.indexOf(status)!==steps.indexOf(item.status)+1)throw new Problem(409,'INVALID_TRANSITION');
   const timestamp=new Date().toISOString(),change={status,stage_started_at:timestamp,handled_by:staff.id,...(status==='SERVED'?{served_at:timestamp}:{})};
   await tx.patch('order_items',{id:line,order_id:id},change);item.status=status;
   const remaining=lines.filter(i=>steps.includes(i.status));
   const progress=steps[Math.min(...remaining.map(i=>steps.indexOf(i.status)))];
   await tx.patch('orders',{id,venue_id:staff.venue_id},{status:progress});
   await tx.add('audit_log',{venue_id:staff.venue_id,actor_type:'STAFF',actor_id:staff.id,action:'ORDER_ITEM_STATUS',entity_type:'order_item',entity_id:line,data:{status}});
   const [notificationSession]=await tx.rows('table_sessions',{id:order.session_id,venue_id:staff.venue_id});const [notificationTable]=notificationSession?await tx.rows('dining_tables',{id:notificationSession.table_id,venue_id:staff.venue_id}):[];
   const event=await tx.add('realtime_events',{venue_id:staff.venue_id,session_id:order.session_id,event_type:'order.status_changed',payload:{participant_id:order.placed_by,order_id:id,order_no:order.order_no,table_label:notificationTable?.label??null,status:progress,item_status:status,item_id:line,station:item.station}});
   return {status,seq:Number(event.seq)};
  });
  if(result.seq&&publish)await publish(staff.venue_id,result.seq).catch(()=>{});
  return {status:result.status};
 });
 app.get('/v1/staff/orders',async request=>{
  const staff=await ctx.staff(request);await limit(`staff-orders:${staff.id}`,60);
  const query=z.object({item_status:z.enum(['NEW','ACCEPTED','PREPARING','READY','SERVED','CANCELLED','REJECTED']).optional(),from:z.iso.datetime().optional(),until:z.iso.datetime().optional(),page:z.coerce.number().int().min(1).max(100000).default(1),status:z.enum(['NEW','ACCEPTED','PREPARING','READY','SERVED','CANCELLED']).optional(),station:z.enum(['KITCHEN','BAR']).optional(),since_seq:z.coerce.number().int().min(0).default(0)}).parse(request.query);
  const station=['KITCHEN','BAR'].includes(staff.role as string)?staff.role:query.station;
  const businessStart=['KITCHEN','BAR','WAITER'].includes(staff.role)?businessDay((await serviceSettings(ctx.store,staff.venue_id)).business_day_cutoff).start:undefined;
  const handlers=new Map((await ctx.store.rows('staff_users',{venue_id:staff.venue_id})).map(s=>[s.id,s.full_name]));
  const orders=[];for(const o of await ctx.store.recentOrders(staff.venue_id,station,query.status,businessStart?undefined:query.from,businessStart?undefined:query.until,query.page,query.item_status,businessStart)){const lines=(await ctx.store.rows('order_items',{order_id:o.id})).filter(l=>(!station||l.station===station)&&(staff.role!=='WAITER'||['READY','SERVED','CANCELLED','REJECTED'].includes(l.status)));if(lines.length){for(const l of lines){l.handled_name=handlers.get(l.handled_by)??null;l.modifiers=await ctx.store.rows('order_item_modifiers',{order_item_id:l.id});}const [session]=await ctx.store.rows('table_sessions',{id:o.session_id,venue_id:staff.venue_id});const [table]=session?await ctx.store.rows('dining_tables',{id:session.table_id,venue_id:staff.venue_id}):[];const feedback=['MANAGER','OWNER'].includes(staff.role)?(await ctx.store.rows('service_feedback',{order_id:o.id,venue_id:staff.venue_id}))[0]:undefined;const cash_shares=[];if(!station&&session){const [locked]=await ctx.store.rows('bill_splits',{venue_id:staff.venue_id,session_id:session.id,status:'LOCKED'});if(locked&&Date.parse(locked.lock_expires_at)>Date.now())for(const sh of await ctx.store.rows('bill_shares',{venue_id:staff.venue_id,session_id:session.id,split_id:locked.id,status:'UNPAID'}))if(sh.amount_tzs>0)cash_shares.push({id:sh.id,label:sh.label,amount_tzs:sh.amount_tzs});}orders.push({...o,cash_shares,feedback,table_label:table?.label??null,items:lines});}}
  const seq=await ctx.store.eventHead(staff.venue_id);return {orders,seq};
 });
}
