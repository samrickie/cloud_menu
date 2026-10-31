import type {FastifyInstance} from 'fastify';
import {randomUUID} from 'node:crypto';
import {billTotals} from '../../../packages/shared/src/splits.ts';
import {tzs} from '../../../packages/shared/src/pricing.ts';
import {idParams,type Context} from './context.ts';
import type {Store,Row} from './store.ts';
import {hash,Problem} from './security.ts';
import {activeSplit,splitView} from './split-state.ts';

// Called under the same per-venue transaction as orders/rejections. Menu edits
// never reprice historical lines; their immutable order snapshots are the input.
export async function syncBill(tx:Store,venueId:string,sessionId:string){
 const [session]=await tx.rows('table_sessions',{id:sessionId,venue_id:venueId});if(!session)throw new Problem(404,'SESSION_NOT_FOUND');
 const [venue]=await tx.rows('venues',{id:venueId});if(!venue)throw new Problem(404,'VENUE_NOT_FOUND');
 const [previous]=await tx.rows('bills',{session_id:sessionId,venue_id:venueId});
 const rates={service_charge_bp:previous?.service_charge_bp??venue.service_charge_bp??0,vat_rate_bp:previous?.vat_rate_bp??venue.vat_rate_bp??1800,prices_include_vat:previous?.prices_include_vat??venue.prices_include_vat??true};
 const orders=await tx.rows('orders',{session_id:sessionId,venue_id:venueId});const items:Row[]=[];
 for(const order of orders){for(const item of await tx.rows('order_items',{order_id:order.id})){
  if(['REJECTED','CANCELLED'].includes(item.status))continue;
  const modifiers=await tx.rows('order_item_modifiers',{order_item_id:item.id});
  items.push({id:item.id,order_id:order.id,order_no:order.order_no,participant_id:item.participant_id,name:item.name_snapshot,quantity:item.quantity,unit_price_tzs:item.unit_price_tzs,modifiers_total_tzs:item.modifiers_total_tzs,line_total_tzs:item.line_total_tzs,note:item.note,status:item.status,modifiers:modifiers.map(m=>({name:m.name_snapshot,price_delta_tzs:m.price_delta_tzs}))});
 }}
 const total=items.reduce((sum,item)=>sum+BigInt(tzs(item.line_total_tzs)),0n);const subtotal=tzs(Number(total));
 const amounts=billTotals(subtotal,rates.service_charge_bp,rates.vat_rate_bp,rates.prices_include_vat);
 const financial=items.map(i=>[i.id,i.quantity,i.unit_price_tzs,i.modifiers_total_tzs,i.line_total_tzs]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const source_hash=hash(JSON.stringify({financial,rates}));let bill=previous,seq:number|undefined;
 if(previous&&Number(previous.paid_tzs)>amounts.total_tzs)throw new Problem(409,'REFUND_REVIEW_REQUIRED','A paid bill cannot be reduced without an approved refund.');
 if(!previous){bill=await tx.add('bills',{id:randomUUID(),session_id:sessionId,venue_id:venueId,...amounts,...rates,source_hash,paid_tzs:0,status:'OPEN',version:1});}
 else if(previous.source_hash!==source_hash){const change={...amounts,source_hash,version:previous.version+1};await tx.patch('bills',{id:previous.id,venue_id:venueId},change);bill={...previous,...change};}
 if(!previous||previous.source_hash!==source_hash){const event=await tx.add('realtime_events',{venue_id:venueId,session_id:sessionId,event_type:'bill.updated',payload:{bill_id:bill!.id,bill_version:bill!.version,total_tzs:bill!.total_tzs,balance_tzs:tzs(bill!.total_tzs-bill!.paid_tzs)}});seq=Number(event.seq);}
 return {bill:bill!,items,seq};
}
export function registerBilling(app:FastifyInstance,ctx:Context,publish:(venue:string,seq:number)=>Promise<void>){
 app.get('/v1/sessions/:id/bill',async request=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);
  const result=await ctx.store.tx(`venue:${guest.venue_id}`,async tx=>{const [session]=await tx.rows('table_sessions',{id:sid,venue_id:guest.venue_id,status:'ACTIVE'});if(!session)throw new Problem(409,'SESSION_CLOSED');const snapshot=await syncBill(tx,guest.venue_id,sid),current=await activeSplit(tx,guest.venue_id,sid,snapshot.bill.id);return {...snapshot,split:current?await splitView(tx,current):null};});
  if(result.seq)await publish(guest.venue_id,result.seq).catch(()=>{});
  const {bill,items}=result;return {bill:{id:bill.id,session_id:sid,currency:'TZS',version:bill.version,status:bill.status,subtotal_tzs:bill.subtotal_tzs,service_charge_tzs:bill.service_charge_tzs,tax_tzs:bill.tax_tzs,total_tzs:bill.total_tzs,paid_tzs:bill.paid_tzs,balance_tzs:tzs(bill.total_tzs-bill.paid_tzs),service_charge_bp:bill.service_charge_bp,vat_rate_bp:bill.vat_rate_bp,prices_include_vat:bill.prices_include_vat,items,split:result.split}};
 });
}
