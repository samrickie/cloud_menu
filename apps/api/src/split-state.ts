import type {Row,Store} from './store.ts';
import {tzs} from '../../../packages/shared/src/pricing.ts';
export async function splitView(tx:Store,split:Row){
 const shares=(await tx.rows('bill_shares',{split_id:split.id,venue_id:split.venue_id,session_id:split.session_id})).sort((a,b)=>a.slot_index-b.slot_index).map(s=>({id:s.id,participant_id:s.participant_id,label:s.label,slot_index:s.slot_index,amount_tzs:s.amount_tzs,tip_tzs:s.tip_tzs,status:s.status}));
 return {id:split.id,mode:split.mode,status:split.status,created_by:split.created_by,bill_version:split.bill_version,total_tzs:split.total_tzs,payer_count:split.payer_count,locked_at:split.locked_at??null,lock_expires_at:split.lock_expires_at??null,shares,unassigned_tzs:tzs(split.total_tzs-shares.reduce((n,s)=>n+s.amount_tzs,0))};
}
export async function activeSplit(tx:Store,venue:string,session:string,bill:string){return (await tx.rows('bill_splits',{venue_id:venue,session_id:session,bill_id:bill})).find(s=>s.status==='OPEN'||s.status==='LOCKED');}
