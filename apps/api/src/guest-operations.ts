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
   const records=(await tx.rows('orders',{session_id:sid,venue_id:guest.venue_id})).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());const orders=[];
   for(const o of records.slice(0,200)){const lines=await tx.rows('order_items',{order_id:o.id});orders.push({id:o.id,order_no:o.order_no,status:o.status,note:o.note,created_at:o.created_at,subtotal_tzs:o.subtotal_tzs,items:lines.map(l=>({id:l.id,name:l.name_snapshot,quantity:l.quantity,note:l.note,station:l.station,status:l.status,rejection_reason:l.rejection_reason??null,line_total_tzs:l.line_total_tzs}))});}
   const calls=(await tx.rows('waiter_calls',{venue_id:guest.venue_id,session_id:sid})).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());return {orders,waiter_call:calls[0]??null,seq:await tx.eventHead(guest.venue_id),truncated:records.length>200};
  });
 });
 app.post('/v1/sessions/:id/waiter-calls',async(request,reply)=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`waiter:${sid}`,30);const input=z.object({reason:z.enum(['HELP','BILL','CLEAN_TABLE','WATER']),message:z.string().trim().max(500).default('')}).strict().parse(request.body);
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const [session]=await tx.rows('table_sessions',{id:sid,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');
   const recent=(await tx.rows('waiter_calls',{venue_id:guest.venue_id,session_id:sid})).find(c=>Date.now()-new Date(c.created_at).getTime()<60000);if(recent)return {call:recent,repeated:true};
   const call=await tx.add('waiter_calls',{id:randomUUID(),venue_id:guest.venue_id,session_id:sid,table_id:session.table_id,participant_id:guest.participant_id,...input,status:'OPEN',created_at:new Date().toISOString(),acknowledged_at:null,acknowledged_by:null});
   const event=await tx.add('realtime_events',{venue_id:guest.venue_id,session_id:sid,event_type:'waiter.called',payload:{call_id:call.id,table_id:call.table_id,reason:call.reason,message:call.message,status:call.status,created_at:call.created_at}});return {call,repeated:false,seq:event.seq};
  });if(result.seq)await publish(guest.venue_id,Number(result.seq)).catch(()=>{});reply.code(result.repeated?200:201);return {call:result.call,repeated:result.repeated};
 });
 app.get('/v1/staff/waiter-calls',async request=>{const s=await ctx.staff(request);const tables=await ctx.store.rows('dining_tables',{venue_id:s.venue_id});const calls=(await ctx.store.rows('waiter_calls',{venue_id:s.venue_id})).filter(c=>c.status!=='RESOLVED').sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,200).map(c=>({...c,table_label:tables.find(t=>t.id===c.table_id)?.label??''}));return {calls,seq:await ctx.store.eventHead(s.venue_id)};});
 app.post('/v1/staff/waiter-calls/:id/acknowledge',async request=>{
  const s=await ctx.staff(request,['WAITER','MANAGER','OWNER']),id=idParams(request.params);
  const result=await ctx.store.tx(`venue:${s.venue_id}`,async tx=>{const [call]=await tx.rows('waiter_calls',{id,venue_id:s.venue_id});if(!call)throw new Problem(404,'CALL_NOT_FOUND');if(call.status!=='OPEN'){if(call.acknowledged_by===s.id)return {call};throw new Problem(409,'CALL_ALREADY_ACKNOWLEDGED');}const change={status:'ACKNOWLEDGED',acknowledged_by:s.id,acknowledged_at:new Date().toISOString()};await tx.patch('waiter_calls',{id,venue_id:s.venue_id},change);const next={...call,...change};const e=await tx.add('realtime_events',{venue_id:s.venue_id,session_id:call.session_id,event_type:'waiter.acknowledged',payload:{call_id:id,status:'ACKNOWLEDGED',acknowledged_at:change.acknowledged_at}});await tx.add('audit_log',{venue_id:s.venue_id,actor_type:'STAFF',actor_id:s.id,action:'WAITER_CALL_ACKNOWLEDGED',entity_type:'waiter_call',entity_id:id});return {call:next,seq:e.seq};});if(result.seq)await publish(s.venue_id,Number(result.seq)).catch(()=>{});return result;
 });
}
export const guestEvent=(event:Row,sid:string)=>event.session_id===sid||(event.session_id==null&&['menu.item_availability','venue.access_suspended'].includes(event.event_type));
