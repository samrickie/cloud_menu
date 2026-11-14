import {serviceSettings,serviceTiming} from './service-settings.ts';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import type {Context} from './context.ts';
import type {Row} from './store.ts';
import {Problem} from './security.ts';
import type {RealtimeBroker} from './realtime.ts';
export function attentionEvent(e:Row,role:string){
 if(['OWNER','MANAGER'].includes(role))return /^(order|waiter|attention)\./.test(e.event_type);
 if(e.event_type.startsWith('attention.'))return true;
 if(role==='WAITER')return e.event_type.startsWith('waiter.')||e.event_type==='order.status_changed'&&e.payload.item_status==='READY';
 return e.event_type==='order.created'?e.payload.items?.some((i:Row)=>i.station===role):e.event_type==='order.status_changed'&&e.payload.station===role;
}
export function registerAttention(app:FastifyInstance,ctx:Context,broker:RealtimeBroker,limit:(key:string,max:number)=>Promise<void>,publish:(venue:string,seq:number)=>Promise<void>){
 app.get('/v1/staff/attention',async req=>{
  const s=await ctx.staff(req);await limit(`attention:${s.id}`,120);z.object({}).strict().parse(req.query);
  const settings=await serviceSettings(ctx.store,s.venue_id);
  const [work,acks,prefs]=await Promise.all([ctx.store.serviceWork(s.venue_id,s.role),ctx.store.rows('staff_attention_ack',{venue_id:s.venue_id,staff_id:s.id}),ctx.store.rows('staff_alert_preferences',{venue_id:s.venue_id,staff_id:s.id})]);
  return {staff_id:s.id,muted:prefs[0]?.muted??true,server_time:new Date().toISOString(),work:work.map(w=>({...serviceTiming(w,settings),is_new:['KITCHEN','BAR','WAITER'].includes(s.role)&&w.station===s.role&&(w.kind==='REQUEST'?w.status==='OPEN':w.items.some((i:Row)=>i.status==='NEW'||s.role==='WAITER'&&i.status==='READY'))&&!acks.some(a=>a.kind===w.kind&&a.entity_id===w.id&&a.station===w.station&&(s.role!=='WAITER'||w.kind==='REQUEST'||new Date(a.created_at).getTime()>=Math.max(...w.items.map((i:Row)=>new Date(i.stage_started_at??w.received_at).getTime()))))}))};
 });
 app.post('/v1/staff/attention/acknowledge',async req=>{
  const s=await ctx.staff(req,['KITCHEN','BAR','WAITER']);await limit(`attention-ack:${s.id}`,60);const input=z.object({kind:z.enum(['ORDER','REQUEST']),id:z.uuid()}).strict().parse(req.body);
  const seq=await ctx.store.tx(`venue:${s.venue_id}`,async tx=>{const work=await tx.serviceWork(s.venue_id,s.role);const item=work.find(w=>w.id===input.id&&w.kind===input.kind&&w.station===s.role);if(!item)throw new Problem(404,'ATTENTION_NOT_FOUND');const key={staff_id:s.id,venue_id:s.venue_id,kind:input.kind,entity_id:input.id,station:s.role};if(!(await tx.rows('staff_attention_ack',key)).length)await tx.add('staff_attention_ack',{...key,created_at:new Date().toISOString()});else await tx.patch('staff_attention_ack',key,{created_at:new Date().toISOString()});return (await tx.add('realtime_events',{venue_id:s.venue_id,event_type:'attention.acknowledged',payload:{staff_id:s.id}})).seq;});await publish(s.venue_id,Number(seq)).catch(()=>{});return {acknowledged:true};
 });
 app.put('/v1/staff/attention/preferences',async req=>{
  const s=await ctx.staff(req);const input=z.object({muted:z.boolean()}).strict().parse(req.body);await limit(`attention-pref:${s.id}`,30);
  await ctx.store.tx(`staff-pref:${s.id}`,async tx=>{const key={venue_id:s.venue_id,staff_id:s.id};if((await tx.rows('staff_alert_preferences',key)).length)await tx.patch('staff_alert_preferences',key,input);else await tx.add('staff_alert_preferences',{...key,...input});});return input;
 });
 const streams=new Set<()=>void>(),counts=new Map<string,number>();app.addHook('preClose',async()=>{for(const end of streams)end();});
 app.get('/v1/staff/attention/events',async(req,reply)=>{
  const s=await ctx.staff(req);await limit(`attention-stream:${s.id}`,20);if((counts.get(s.id)??0)>=3||streams.size>=5000)throw new Problem(429,'TOO_MANY_STREAMS');
  let ended=false,release:(()=>void)|undefined;const heartbeat:{timer?:ReturnType<typeof setInterval>}={};
  const end=()=>{if(ended)return;ended=true;release?.();if(heartbeat.timer)clearInterval(heartbeat.timer);streams.delete(end);counts.set(s.id,Math.max(0,(counts.get(s.id)??1)-1));if(reply.raw.headersSent&&!reply.raw.destroyed)reply.raw.end();};
  counts.set(s.id,(counts.get(s.id)??0)+1);streams.add(end);reply.raw.on('close',end);
  const notify=async()=>{try{await ctx.staff(req);if(!ended&&reply.raw.headersSent){reply.raw.write('event: changed\ndata: {}\n\n');if(reply.raw.writableLength>65536)end();}}catch{end();}};
  try{release=await broker.subscribe(s.venue_id,e=>{if(attentionEvent(e,s.role)&&(!e.payload.staff_id||e.payload.staff_id===s.id))void notify();});await ctx.staff(req);}catch(e){end();throw e;}
  if(ended){release();return;}reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});reply.raw.write('event: changed\ndata: {}\n\n');
  heartbeat.timer=setInterval(()=>{void ctx.staff(req).then(()=>{if(!ended)reply.raw.write(': heartbeat\n\n');}).catch(end);},15000);heartbeat.timer.unref();
 });
}
