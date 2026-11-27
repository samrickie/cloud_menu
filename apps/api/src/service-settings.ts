import {z} from 'zod';
import type {FastifyInstance} from 'fastify';
import type {Context} from './context.ts';
import type {Row,Store} from './store.ts';
import {Problem} from './security.ts';
export const serviceDefaults={default_minutes:20,kitchen_minutes:null,bar_minutes:null,waiter_minutes:null,business_day_cutoff:'00:00',timezone:'Africa/Dar_es_Salaam',revision:0};
export async function serviceSettings(store:Store,venue:string){return {...serviceDefaults,...(await store.rows('venue_service_settings',{venue_id:venue}))[0]};}
export function businessDay(cutoff='00:00',now=Date.now()){
 const [h,m]=cutoff.split(':').map(Number),shift=10800000-(h*60+m)*60000,date=new Date(now+shift).toISOString().slice(0,10);
 return {date,start:new Date(Date.parse(date+'T00:00:00Z')-shift).toISOString()};
}
export function serviceTiming(work:Row,settings:Row,now=Date.now()){
 const minutes=settings[work.station.toLowerCase()+'_minutes']??settings.default_minutes;
 const started=work.items.length?Math.min(...work.items.map((i:Row)=>new Date(i.stage_started_at??work.received_at).getTime())):new Date(work.received_at).getTime();
 const due=started+minutes*60000;return {...work,stage_started_at:new Date(started).toISOString(),limit_minutes:minutes,due_at:new Date(due).toISOString(),elapsed_ms:Math.max(0,now-started),overdue:now>=due};
}
export function groupServiceItems(rows:Row[],role:string){
 const groups=new Map<string,Row>();
 for(const row of rows){const station=row.status==='READY'?'WAITER':row.station;if(!['OWNER','MANAGER',station].includes(role))continue;const key=row.order_id+station;
  let group=groups.get(key);if(!group){group={id:row.order_id,kind:'ORDER',station,order_no:row.order_no,note:row.order_note,received_at:row.received_at,table_label:row.table_label,items:[]};groups.set(key,group);}
  group.items.push({id:row.id,name:row.name_snapshot,note:row.note,quantity:row.quantity,status:row.status,station:row.station,stage_started_at:row.stage_started_at??row.received_at});
 }return [...groups.values()];
}
export function registerServiceSettings(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,publish:(venue:string,seq:number)=>Promise<void>){
 app.get('/v1/owner/service-settings',async req=>{const s=await ctx.staff(req,['OWNER']);return serviceSettings(ctx.store,s.venue_id);});
 app.put('/v1/owner/service-settings',async req=>{
  const s=await ctx.staff(req,['OWNER']);await limit('service-settings:'+s.id,30);const minutes=z.number().int().min(1).max(240);
  const {expected_revision,...input}=z.object({default_minutes:minutes,kitchen_minutes:minutes.nullable(),bar_minutes:minutes.nullable(),waiter_minutes:minutes.nullable(),business_day_cutoff:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),expected_revision:z.number().int().nonnegative()}).strict().parse(req.body);
  const result=await ctx.store.tx('venue:'+s.venue_id,async tx=>{const old=await serviceSettings(tx,s.venue_id);if(old.revision!==expected_revision)throw new Problem(409,'SETTINGS_CHANGED');const next={...old,...input,venue_id:s.venue_id,revision:old.revision+1};if((await tx.rows('venue_service_settings',{venue_id:s.venue_id})).length)await tx.patch('venue_service_settings',{venue_id:s.venue_id},next);else await tx.add('venue_service_settings',next);await tx.add('audit_log',{venue_id:s.venue_id,actor_type:'STAFF',actor_id:s.id,action:'SERVICE_SETTINGS_CHANGED',entity_type:'venue',entity_id:s.venue_id,data:input});const event=await tx.add('realtime_events',{venue_id:s.venue_id,event_type:'attention.settings',payload:{}});return {next,seq:Number(event.seq)};});await publish(s.venue_id,result.seq).catch(()=>{});return result.next;
 });
}
