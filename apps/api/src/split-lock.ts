import type {FastifyInstance} from 'fastify';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {idParams,type Context} from './context.ts';
import type {Store,Row} from './store.ts';
import {Problem} from './security.ts';
import {syncBill} from './billing.ts';
import {activeSplit,remainingBillItems,splitView} from './split-state.ts';

export async function paymentInFlight(tx:Store,split:Row){
 for(const share of await tx.rows('bill_shares',{split_id:split.id,venue_id:split.venue_id,session_id:split.session_id})){
  if(share.status==='PENDING')return true;
  if((await tx.rows('payment_transactions',{venue_id:split.venue_id,share_id:share.id})).some(p=>['INITIATED','PENDING'].includes(p.status)))return true;
 }return false;
}
export async function splitEvent(tx:Store,split:Row){const view=await splitView(tx,split),event=await tx.add('realtime_events',{venue_id:split.venue_id,session_id:split.session_id,event_type:'split.updated',payload:{split_id:split.id,...view}});return {split:view,seq:Number(event.seq)};}
export async function expireSplit(tx:Store,split:Row):Promise<Row>{
 if(split.status!=='LOCKED'||!split.lock_expires_at)return split;
 const deadline=new Date(split.lock_expires_at).getTime();if(!Number.isFinite(deadline))throw new Problem(409,'LEDGER_REVIEW_REQUIRED');if(deadline>Date.now())return split;
 if(await paymentInFlight(tx,split))return split;
 const change={status:'OPEN',locked_at:null,lock_expires_at:null,revision:(split.revision??1)+1};await tx.patch('bill_splits',{id:split.id,venue_id:split.venue_id,session_id:split.session_id},change);await tx.patch('bills',{id:split.bill_id,venue_id:split.venue_id,session_id:split.session_id,status:'LOCKED'},{status:'OPEN'});const next={...split,...change};await splitEvent(tx,next);return next;
}
// Exact proportional apportionment, largest remainder first; slots break ties.
export function apportion(total:number,weights:number[]){
 const sum=weights.reduce((n,w)=>n+BigInt(w),0n);if(!sum){if(total)throw new Problem(409,'LEDGER_REVIEW_REQUIRED');return weights.map(()=>0);}
 const parts=weights.map((w,i)=>({i,amount:Number(BigInt(total)*BigInt(w)/sum),remainder:BigInt(total)*BigInt(w)%sum}));let left=total-parts.reduce((n,p)=>n+p.amount,0);
 for(const p of [...parts].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(!left)break;p.amount++;left--;}
 return parts.map(p=>p.amount);
}
export function registerSplitLocks(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,publish:(venue:string,seq:number)=>Promise<void>){
 for(const action of ['lock','unlock'] as const)app.post(`/v1/splits/:id/${action}`,async request=>{
  const id=idParams(request.params),guest=await ctx.guest(request);await limit(`split-lock:${guest.session_id}`,30);
  const input=action==='lock'?z.object({bill_version:z.number().int().positive(),split_revision:z.number().int().positive().optional()}).strict().parse(request.body):z.object({}).strict().optional().parse(request.body);
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{
   const scope={venue_id:guest.venue_id,session_id:guest.session_id};const [session]=await tx.rows('table_sessions',{id:guest.session_id,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');
   let split=await tx.lockSplit(guest.venue_id,guest.session_id,id);if(!split)throw new Problem(404,'SPLIT_NOT_FOUND');split=await expireSplit(tx,split);
   if(action==='unlock'){
    if(!['OPEN','LOCKED'].includes(split.status))throw new Problem(409,'SPLIT_INACTIVE');if(await paymentInFlight(tx,split))throw new Problem(409,'PAYMENT_IN_FLIGHT');
    const change={status:'CANCELLED',locked_at:null,lock_expires_at:null,revision:(split.revision??1)+1};await tx.patch('bill_splits',{id,...scope},change);await tx.patch('bills',{id:split.bill_id,...scope,status:'LOCKED'},{status:'OPEN'});return splitEvent(tx,{...split,...change});
   }
   const current=await activeSplit(tx,guest.venue_id,guest.session_id,split.bill_id);if(split.status!=='OPEN'||current?.id!==id)throw new Problem(409,'SPLIT_ALREADY_LOCKED');
   const {bill,items}=await syncBill(tx,guest.venue_id,guest.session_id);const wanted=input as {bill_version:number;split_revision?:number};
   if(wanted.bill_version!==bill.version||split.bill_version!==bill.version)throw new Problem(409,'BILL_CHANGED');if(wanted.split_revision!==undefined&&wanted.split_revision!==(split.revision??1))throw new Problem(409,'SPLIT_CHANGED');
   if(await paymentInFlight(tx,split))throw new Problem(409,'PAYMENT_IN_FLIGHT');
   const view=await splitView(tx,split);if(view.unassigned_tzs||view.unassigned_items_tzs)throw new Problem(422,'UNASSIGNED_AMOUNT');
   const shares=(await tx.rows('bill_shares',{split_id:id,...scope})).sort((a,b)=>a.slot_index-b.slot_index);
   if(shares.some(s=>s.status==='PAID'&&s.amount_tzs>0)){
    // Paid snapshots remain immutable. A changed bill needs a new remaining-balance split.
    if(!split.lock_snapshot)throw new Problem(409,'LEDGER_REVIEW_REQUIRED');
   }else{
    const remaining=await remainingBillItems(tx,bill,items);if(split.total_tzs!==bill.total_tzs-bill.paid_tzs||split.subtotal_tzs!==remaining.subtotal_tzs)throw new Problem(409,'BILL_CHANGED');
    if(split.mode==='EQUAL'){
     const bases=apportion(remaining.subtotal_tzs,shares.map(s=>s.amount_tzs));const capacities=remaining.items.filter(i=>i.available_tzs>0).sort((a,b)=>a.id.localeCompare(b.id)).map(i=>({id:i.id,left:i.available_tzs}));
     for(const [index,share]of shares.entries()){await tx.remove('bill_share_items',{share_id:share.id,...scope});let left=bases[index];for(const line of capacities){const amount=Math.min(left,line.left);if(amount){await tx.add('bill_share_items',{id:randomUUID(),share_id:share.id,...scope,order_item_id:line.id,amount_tzs:amount});left-=amount;line.left-=amount;}if(!left)break;}if(left)throw new Problem(409,'LEDGER_REVIEW_REQUIRED');}
    }
    const allocations=await tx.allocations(guest.venue_id,guest.session_id,id);
    const snapshot={bill_version:bill.version,subtotal_tzs:remaining.subtotal_tzs,total_tzs:split.total_tzs,service_charge_bp:bill.service_charge_bp,vat_rate_bp:bill.vat_rate_bp,prices_include_vat:bill.prices_include_vat,items:remaining.items,shares:shares.map(s=>({id:s.id,amount_tzs:s.amount_tzs,items:allocations.filter(i=>i.share_id===s.id).map(i=>({order_item_id:i.order_item_id,amount_tzs:i.amount_tzs}))}))};
    await tx.patch('bill_splits',{id,...scope},{lock_snapshot:snapshot});
   }
   const now=Date.now(),change={status:'LOCKED',locked_at:new Date(now).toISOString(),lock_expires_at:new Date(now+600000).toISOString(),revision:(split.revision??1)+1};await tx.patch('bill_splits',{id,...scope},change);await tx.patch('bills',{id:bill.id,...scope},{status:'LOCKED'});return splitEvent(tx,{...split,...change});
  });await publish(guest.venue_id,result.seq).catch(()=>{});return {split:result.split};
 });
}
