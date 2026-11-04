import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {idParams,type Context} from './context.ts';
import type {Row} from './store.ts';
import {Problem} from './security.ts';
export function registerGuestOperations(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,publish:(venue:string,seq:number)=>Promise<void>){
 app.get('/v1/sessions/:id/orders',async request=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);
  return ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const [session]=await tx.rows('table_sessions',{id:sid,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');
   const records=(await tx.rows('orders',{session_id:sid,venue_id:guest.venue_id,placed_by:guest.participant_id})).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());const orders=[];
   for(const o of records.slice(0,200)){const lines=await tx.rows('order_items',{order_id:o.id});orders.push({rated:o.status==='SERVED'&&(await tx.rows('service_feedback',{order_id:o.id,venue_id:guest.venue_id})).length>0,id:o.id,order_no:o.order_no,status:o.status,note:o.note,created_at:o.created_at,subtotal_tzs:o.subtotal_tzs,items:lines.map(l=>({id:l.id,name:l.name_snapshot,quantity:l.quantity,note:l.note,station:l.station,status:l.status,rejection_reason:l.rejection_reason??null,line_total_tzs:l.line_total_tzs}))});}
   const calls=(await tx.rows('waiter_calls',{venue_id:guest.venue_id,session_id:sid,participant_id:guest.participant_id})).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());return {orders,table_has_bill:(await tx.rows('bills',{venue_id:guest.venue_id,session_id:sid})).length>0,waiter_call:calls[0]??null,seq:await tx.eventHead(guest.venue_id),truncated:records.length>200};
  });
 });
 app.post('/v1/sessions/:id/orders/:order/feedback',async request=>{
  const {id,order}=z.object({id:z.uuid(),order:z.uuid()}).parse(request.params);
  const guest=await ctx.guest(request,id);
  const rating=z.number().int().min(1).max(5);
  const input=z.object({waiter:rating,comment:z.string().trim().max(500).default(''),food:z.array(z.object({line:z.uuid(),rating})).max(100)}).strict().parse(request.body);
  return ctx.store.tx('venue:'+guest.venue_id,async tx=>{
   const [record]=await tx.rows('orders',{id:order,session_id:id,venue_id:guest.venue_id,placed_by:guest.participant_id});
   if(!record)throw new Problem(404,'ORDER_NOT_FOUND');
   if(record.status!=='SERVED')throw new Problem(409,'ORDER_NOT_SERVED');
   if((await tx.rows('service_feedback',{order_id:order})).length)return {saved:true};
   const lines=await tx.rows('order_items',{order_id:order,station:'KITCHEN',status:'SERVED'});
   if(new Set(input.food.map(f=>f.line)).size!==input.food.length)throw new Problem(422,'INVALID_RATING');
   for(const vote of input.food){
    const line=lines.find(l=>l.id===vote.line);
    if(!line)throw new Problem(422,'INVALID_RATING');
    const [item]=await tx.rows('items',{venue_id:guest.venue_id,id:line.item_id});
    if(item)await tx.patch('items',{id:item.id,venue_id:guest.venue_id},{food_rating_count:Number(item.food_rating_count??0)+1,food_rating_sum:Number(item.food_rating_sum??0)+vote.rating});
   }
   await tx.add('service_feedback',{order_id:order,venue_id:guest.venue_id,waiter_rating:input.waiter,comment:input.comment,food_ratings:JSON.stringify(input.food)});
   for(const menu of await tx.rows('menus',{venue_id:guest.venue_id,is_active:true}))await tx.patch('menus',{id:menu.id,venue_id:guest.venue_id},{version:menu.version+1});
   return {saved:true};
  });
 });
 app.post('/v1/sessions/:id/waiter-calls',async(request,reply)=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`waiter:${sid}`,30);const input=z.object({reason:z.enum(['HELP','BILL','CLEAN_TABLE','WATER']),message:z.string().trim().max(500).default('')}).strict().parse(request.body);
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const [session]=await tx.rows('table_sessions',{id:sid,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');
   const recent=(await tx.rows('waiter_calls',{venue_id:guest.venue_id,session_id:sid,participant_id:guest.participant_id})).find(c=>Date.now()-new Date(c.created_at).getTime()<60000);if(recent)return {call:recent,repeated:true};
   const call=await tx.add('waiter_calls',{id:randomUUID(),venue_id:guest.venue_id,session_id:sid,table_id:session.table_id,participant_id:guest.participant_id,...input,status:'OPEN',created_at:new Date().toISOString(),acknowledged_at:null,acknowledged_by:null});
   const event=await tx.add('realtime_events',{venue_id:guest.venue_id,session_id:sid,event_type:'waiter.called',payload:{participant_id:call.participant_id,call_id:call.id,table_id:call.table_id,reason:call.reason,message:call.message,status:call.status,created_at:call.created_at}});return {call,repeated:false,seq:event.seq};
  });if(result.seq)await publish(guest.venue_id,Number(result.seq)).catch(()=>{});reply.code(result.repeated?200:201);return {call:result.call,repeated:result.repeated};
 });
 app.post('/v1/staff/waiter-calls/:id/resolve',async req=>{
  const staff=await ctx.staff(req,['WAITER','MANAGER','OWNER']),id=idParams(req.params);
  return ctx.store.tx('venue:'+staff.venue_id,async tx=>{
   const where={id,venue_id:staff.venue_id},[call]=await tx.rows('waiter_calls',where);
   if(!call)throw new Problem(404,'CALL_NOT_FOUND');
   if(call.status==='OPEN')throw new Problem(409,'ACKNOWLEDGE_FIRST');
   if(call.status!=='RESOLVED'){await tx.patch('waiter_calls',where,{status:'RESOLVED',resolved_at:new Date().toISOString()});
    await tx.add('realtime_events',{venue_id:staff.venue_id,session_id:call.session_id,event_type:'waiter.resolved',payload:{participant_id:call.participant_id,call_id:id,status:'RESOLVED'}});
   }return {status:'RESOLVED'};
  });
 });
 app.get('/v1/staff/waiter-calls',async request=>{const s=await ctx.staff(request,['WAITER','MANAGER','OWNER']);const tables=await ctx.store.rows('dining_tables',{venue_id:s.venue_id});const calls=(await ctx.store.rows('waiter_calls',{venue_id:s.venue_id})).filter(c=>c.status!=='RESOLVED').sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,200).map(c=>({...c,table_label:tables.find(t=>t.id===c.table_id)?.label??''}));return {calls,seq:await ctx.store.eventHead(s.venue_id)};});
 app.post('/v1/staff/waiter-calls/:id/acknowledge',async request=>{
  const s=await ctx.staff(request,['WAITER','MANAGER','OWNER']),id=idParams(request.params);
  const result=await ctx.store.tx(`venue:${s.venue_id}`,async tx=>{const [call]=await tx.rows('waiter_calls',{id,venue_id:s.venue_id});if(!call)throw new Problem(404,'CALL_NOT_FOUND');if(call.status!=='OPEN'){if(call.acknowledged_by===s.id)return {call};throw new Problem(409,'CALL_ALREADY_ACKNOWLEDGED');}const change={status:'ACKNOWLEDGED',acknowledged_by:s.id,acknowledged_at:new Date().toISOString()};await tx.patch('waiter_calls',{id,venue_id:s.venue_id},change);const next={...call,...change};const e=await tx.add('realtime_events',{venue_id:s.venue_id,session_id:call.session_id,event_type:'waiter.acknowledged',payload:{participant_id:call.participant_id,call_id:id,status:'ACKNOWLEDGED',acknowledged_at:change.acknowledged_at}});await tx.add('audit_log',{venue_id:s.venue_id,actor_type:'STAFF',actor_id:s.id,action:'WAITER_CALL_ACKNOWLEDGED',entity_type:'waiter_call',entity_id:id});return {call:next,seq:e.seq};});if(result.seq)await publish(s.venue_id,Number(result.seq)).catch(()=>{});return result;
 });
}
export const guestEvent=(event:Row,sid:string)=>event.session_id===sid||(event.session_id==null&&['menu.item_availability','venue.access_suspended'].includes(event.event_type));
