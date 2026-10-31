import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {equalSplit} from '../../../packages/shared/src/splits.ts';
import {idParams,type Context} from './context.ts';
import {Problem} from './security.ts';
import {syncBill} from './billing.ts';
import {registerItemized} from './itemized.ts';
import {activeSplit,remainingBillItems,splitView} from './split-state.ts';
export function registerSplits(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,publish:(venue:string,seq:number)=>Promise<void>){
 app.post('/v1/sessions/:id/splits',async(request,reply)=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`splits:${sid}`,20);const input=z.object({mode:z.enum(['EQUAL','ITEMIZED']),payer_count:z.number().int().min(1).max(50)}).strict().parse(request.body);
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const [session]=await tx.rows('table_sessions',{id:sid,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');
   const {bill,items}=await syncBill(tx,guest.venue_id,sid);const remaining=await remainingBillItems(tx,bill,items);const current=await activeSplit(tx,guest.venue_id,sid,bill.id);
   if(current?.status==='LOCKED')throw new Problem(409,'SPLIT_ALREADY_LOCKED');
   if(current){const shares=await tx.rows('bill_shares',{split_id:current.id,venue_id:guest.venue_id,session_id:sid});if(shares.some(s=>s.status==='PAID'&&s.amount_tzs>0))throw new Problem(409,'PAYMENTS_RECEIVED');await tx.patch('bill_splits',{id:current.id,venue_id:guest.venue_id,session_id:sid},{status:'CANCELLED'});}
   const balance=bill.total_tzs-bill.paid_tzs;if(balance<=0)throw new Problem(409,'NOTHING_TO_PAY');if(input.mode==='ITEMIZED'&&remaining.subtotal_tzs<=0)throw new Problem(409,'NO_UNPAID_ITEMS');
   const now=new Date().toISOString(),split=await tx.add('bill_splits',{id:randomUUID(),bill_id:bill.id,venue_id:guest.venue_id,session_id:sid,mode:input.mode,status:'OPEN',payer_count:input.payer_count,bill_version:bill.version,total_tzs:balance,subtotal_tzs:remaining.subtotal_tzs,revision:1,created_by:guest.participant_id,created_at:now,locked_at:null,lock_expires_at:null});
   for(const [slot_index,amount_tzs]of (input.mode==='EQUAL'?equalSplit(balance,input.payer_count):Array<number>(input.payer_count).fill(0)).entries())await tx.add('bill_shares',{id:randomUUID(),split_id:split.id,venue_id:guest.venue_id,session_id:sid,participant_id:null,label:`Guest ${slot_index+1}`,slot_index,amount_tzs,tip_tzs:0,status:input.mode==='EQUAL'&&amount_tzs===0?'PAID':'UNPAID',paid_at:input.mode==='EQUAL'&&amount_tzs===0?now:null});
   const view=await splitView(tx,split),event=await tx.add('realtime_events',{venue_id:guest.venue_id,session_id:sid,event_type:'split.updated',payload:{split_id:split.id,...view}});
   return {split:view,seq:Number(event.seq)};
  });await publish(guest.venue_id,result.seq).catch(()=>{});reply.code(201);return {split:result.split};
 });
 registerItemized(app,ctx,limit,publish);
}
