import {z} from 'zod';
import type {FastifyInstance} from 'fastify';
import type {Context} from './context.ts';
import type {Row} from './store.ts';
import {Problem} from './security.ts';
export function relevantNotification(e:Row,role:string){
 if(e.event_type==='order.created')return !['KITCHEN','BAR'].includes(role)||e.payload.items?.some((i:Row)=>i.station===role);
 return !['KITCHEN','BAR'].includes(role)&&(e.event_type==='waiter.called'||e.event_type==='order.status_changed'&&e.payload.item_status==='READY');
}
export function registerStaffNotifications(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>){
 app.get('/v1/staff/notifications',async req=>{
  const s=await ctx.staff(req);z.object({}).strict().parse(req.query);await limit(`notifications:${s.id}`,30);
  const [read]=await ctx.store.rows('staff_notification_reads',{staff_id:s.id,venue_id:s.venue_id});
  const through=await ctx.store.eventHead(s.venue_id),result=await ctx.store.staffNotifications(s.venue_id,s.role,Number(read?.through_seq??0),through);
  // Never expose guest identifiers or lines belonging to a different station.
  const notifications=result.events.map((e:Row)=>({seq:e.seq,created_at:e.created_at,unread:Number(e.seq)>Number(read?.through_seq??0),type:e.event_type==='order.created'?'NEW_ORDER':e.event_type==='waiter.called'?'WAITER_CALL':'READY',order_id:e.payload.order_id??e.payload.id??null,order_no:e.payload.order_no??null,table_label:e.payload.table_label??null,items:e.event_type==='order.created'?e.payload.items.filter((i:Row)=>!['KITCHEN','BAR'].includes(s.role)||i.station===s.role).map((i:Row)=>i.name??i.name_snapshot):[],reason:e.payload.reason??null}));
  return {notifications,unread:result.unread,through,retention_days:7};
 });
 app.post('/v1/staff/notifications/read',async req=>{
  const s=await ctx.staff(req);await limit(`notifications-read:${s.id}`,30);const {through}=z.object({through:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict().parse(req.body);
  return ctx.store.tx(`notification-read:${s.id}`,async tx=>{
   if(through>await tx.eventHead(s.venue_id))throw new Problem(422,'VALIDATION_ERROR');
   const [old]=await tx.rows('staff_notification_reads',{staff_id:s.id,venue_id:s.venue_id}),value={staff_id:s.id,venue_id:s.venue_id,through_seq:Math.max(through,Number(old?.through_seq??0)),updated_at:new Date().toISOString()};
   if(old)await tx.patch('staff_notification_reads',{staff_id:s.id,venue_id:s.venue_id},value);else await tx.add('staff_notification_reads',value);
   return {through:value.through_seq};
  });
 });
}
