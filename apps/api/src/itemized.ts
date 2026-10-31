import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {itemizedSplit} from '../../../packages/shared/src/splits.ts';
import {idParams,type Context} from './context.ts';
import {Problem} from './security.ts';
import {syncBill} from './billing.ts';
import {remainingBillItems,splitView} from './split-state.ts';
import type {Row} from './store.ts';
const allocation=z.object({order_item_id:z.uuid(),amount_tzs:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)}).strict();
const inputSchema=z.object({mode:z.literal('ITEMIZED'),shares:z.array(z.object({share_id:z.uuid(),participant_id:z.uuid(),items:z.array(allocation).max(500).refine(items=>new Set(items.map(i=>i.order_item_id)).size===items.length)}).strict()).min(1).max(50)}).strict().refine(p=>new Set(p.shares.map(s=>s.share_id)).size===p.shares.length&&p.shares.reduce((n,s)=>n+s.items.length,0)<=1000);
const canonical=(items:{order_item_id:string;amount_tzs:number}[])=>JSON.stringify(items.map(i=>[i.order_item_id,i.amount_tzs]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
export function registerItemized(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,publish:(venue:string,seq:number)=>Promise<void>){
 app.put('/v1/splits/:id/allocations',async request=>{
  const id=idParams(request.params),guest=await ctx.guest(request);await limit(`allocations:${guest.session_id}`,30);
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const scope={venue_id:guest.venue_id,session_id:guest.session_id};const [session]=await tx.rows('table_sessions',{id:guest.session_id,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');const [split]=await tx.rows('bill_splits',{id,...scope});if(!split)throw new Problem(404,'SPLIT_NOT_FOUND');if(split.status!=='OPEN')throw new Problem(409,'SPLIT_ALREADY_LOCKED');if(split.mode!=='ITEMIZED')throw new Problem(422,'SPLIT_MODE_MISMATCH');
   const input=inputSchema.parse(request.body),snapshot=await syncBill(tx,guest.venue_id,guest.session_id),remaining=await remainingBillItems(tx,snapshot.bill,snapshot.items);
   const shares=(await tx.rows('bill_shares',{split_id:id,...scope})).sort((a,b)=>a.slot_index-b.slot_index);if(shares.some(s=>s.status==='PAID'&&s.amount_tzs>0))throw new Problem(409,'PAYMENTS_RECEIVED');
   const rows=await tx.allocations(guest.venue_id,guest.session_id,id),valid=rows.filter(i=>remaining.items.some(line=>line.id===i.order_item_id&&line.available_tzs>0));
   const candidates=new Map<string,{order_item_id:string;amount_tzs:number}[]>(shares.map(s=>[s.id,valid.filter(i=>i.share_id===s.id).map(i=>({order_item_id:i.order_item_id,amount_tzs:i.amount_tzs}))]));const edits:{share:Row;participant:Row;items:z.infer<typeof allocation>[]}[]=[];
   for(const wanted of input.shares){
    const share=shares.find(s=>s.id===wanted.share_id);if(!share)throw new Problem(404,'SHARE_NOT_FOUND');
    const [participant]=await tx.rows('session_participants',{id:wanted.participant_id,session_id:guest.session_id});if(!participant)throw new Problem(403,'SESSION_FORBIDDEN');
    const own=wanted.participant_id===guest.participant_id&&(!share.participant_id||share.participant_id===guest.participant_id),initialise=split.created_by===guest.participant_id&&!share.participant_id;
    const unchanged=share.participant_id===wanted.participant_id&&canonical(candidates.get(share.id)??[])===canonical(wanted.items);
    if(!own&&!initialise&&!unchanged)throw new Problem(403,'SHARE_FORBIDDEN');
    candidates.set(share.id,wanted.items);if(own||initialise)edits.push({share,participant,items:wanted.items});
   }
   const allocated=new Map<string,bigint>();for(const entries of candidates.values())for(const entry of entries){const line=remaining.items.find(i=>i.id===entry.order_item_id);if(!line)throw new Problem(404,'ITEM_NOT_ON_BILL');const sum=(allocated.get(entry.order_item_id)??0n)+BigInt(entry.amount_tzs);if(sum>BigInt(line.available_tzs))throw new Problem(409,'ALREADY_CLAIMED');allocated.set(entry.order_item_id,sum);}
   const bases=shares.map(s=>(candidates.get(s.id)??[]).reduce((n,i)=>n+i.amount_tzs,0));const total=snapshot.bill.total_tzs-snapshot.bill.paid_tzs,pricing=itemizedSplit(remaining.subtotal_tzs,total,bases);
   for(const row of rows)if(!valid.some(i=>i.id===row.id))await tx.remove('bill_share_items',{id:row.id,...scope});
   for(const edit of edits){await tx.remove('bill_share_items',{share_id:edit.share.id,...scope});for(const item of edit.items)await tx.add('bill_share_items',{id:randomUUID(),share_id:edit.share.id,...scope,...item});await tx.patch('bill_shares',{id:edit.share.id,...scope},{participant_id:edit.participant.id,label:edit.participant.display_name});}
   for(const [i,share]of shares.entries())await tx.patch('bill_shares',{id:share.id,...scope},{amount_tzs:pricing.amounts[i],status:'UNPAID',paid_at:null});
   const change={total_tzs:total,subtotal_tzs:remaining.subtotal_tzs,bill_version:snapshot.bill.version,revision:(split.revision??1)+1};await tx.patch('bill_splits',{id,...scope},change);const view=await splitView(tx,{...split,...change});const event=await tx.add('realtime_events',{...scope,event_type:'split.updated',payload:{split_id:id,...view}});return {split:view,seq:Number(event.seq)};
  });await publish(guest.venue_id,result.seq).catch(()=>{});return {split:result.split};
 });
 app.post('/v1/shares/:id/claim',async request=>{
  const id=idParams(request.params),guest=await ctx.guest(request);await limit(`claims:${guest.session_id}`,60);z.object({}).strict().optional().parse(request.body);
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const scope={venue_id:guest.venue_id,session_id:guest.session_id};const [session]=await tx.rows('table_sessions',{id:guest.session_id,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');const [share]=await tx.rows('bill_shares',{id,...scope});if(!share)throw new Problem(404,'SHARE_NOT_FOUND');const [split]=await tx.rows('bill_splits',{id:share.split_id,...scope});if(!split||!['OPEN','LOCKED'].includes(split.status))throw new Problem(409,'SPLIT_INACTIVE');if(share.participant_id&&share.participant_id!==guest.participant_id)throw new Problem(409,'SHARE_ALREADY_CLAIMED');if(share.participant_id===guest.participant_id)return {share};
   const [participant]=await tx.rows('session_participants',{id:guest.participant_id,session_id:guest.session_id});if(!participant)throw new Problem(409,'SESSION_CLOSED');const change={participant_id:guest.participant_id,label:participant.display_name};await tx.patch('bill_shares',{id,...scope},change);await tx.patch('bill_splits',{id:split.id,...scope},{revision:(split.revision??1)+1});const view=await splitView(tx,{...split,revision:(split.revision??1)+1}),event=await tx.add('realtime_events',{...scope,event_type:'split.updated',payload:{split_id:split.id,...view}});return {share:{...share,...change},seq:Number(event.seq)};
  });if(result.seq)await publish(guest.venue_id,result.seq).catch(()=>{});return {share:result.share};
 });
}
