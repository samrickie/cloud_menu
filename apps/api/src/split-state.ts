import type {Row,Store} from './store.ts';
import {tzs} from '../../../packages/shared/src/pricing.ts';
import {Problem} from './security.ts';
export async function remainingBillItems(tx:Store,bill:Row,items:Row[]){
 const consumed=await tx.paidAllocations(bill.venue_id,bill.session_id),used=new Map(consumed.map(i=>[i.order_item_id,i.amount_tzs]));
 if(consumed.some(i=>!items.some(line=>line.id===i.order_item_id)))throw new Problem(409,'REFUND_REVIEW_REQUIRED');
 const available:(Row&{available_tzs:number})[]=items.map(i=>{const amount=i.line_total_tzs-(used.get(i.id)??0);if(amount<0)throw new Problem(409,'REFUND_REVIEW_REQUIRED');return {...i,available_tzs:tzs(amount)};});
 const subtotal_tzs=tzs(available.reduce((sum,i)=>sum+i.available_tzs,0));if(subtotal_tzs>bill.total_tzs-bill.paid_tzs)throw new Problem(409,'LEDGER_REVIEW_REQUIRED');return {items:available,subtotal_tzs};
}
export async function splitView(tx:Store,split:Row){
 const allocations=await tx.allocations(split.venue_id,split.session_id,split.id);
 const shares=(await tx.rows('bill_shares',{split_id:split.id,venue_id:split.venue_id,session_id:split.session_id})).sort((a,b)=>a.slot_index-b.slot_index).map(s=>({id:s.id,participant_id:s.participant_id,label:s.label,slot_index:s.slot_index,amount_tzs:s.amount_tzs,tip_tzs:s.tip_tzs,status:s.status,items:allocations.filter(i=>i.share_id===s.id).map(i=>({order_item_id:i.order_item_id,amount_tzs:i.amount_tzs}))}));
 return {id:split.id,mode:split.mode,status:split.status,created_by:split.created_by,revision:split.revision??1,bill_version:split.bill_version,total_tzs:split.total_tzs,subtotal_tzs:split.subtotal_tzs??0,payer_count:split.payer_count,locked_at:split.locked_at??null,lock_expires_at:split.lock_expires_at??null,shares,unassigned_tzs:tzs(split.total_tzs-shares.reduce((n,s)=>n+s.amount_tzs,0)),unassigned_items_tzs:split.mode==='ITEMIZED'?tzs((split.subtotal_tzs??0)-allocations.reduce((n,i)=>n+i.amount_tzs,0)):0};
}
export async function activeSplit(tx:Store,venue:string,session:string,bill:string){return (await tx.rows('bill_splits',{venue_id:venue,session_id:session,bill_id:bill})).find(s=>s.status==='OPEN'||s.status==='LOCKED');}
