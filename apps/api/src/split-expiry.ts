import type {Store} from './store.ts';
import {expireSplit} from './split-lock.ts';
// Trusted worker-only enumeration. All mutations reacquire the venue and row locks.
export async function sweepExpiredSplits(store:Store,publish:(venue:string,seq:number)=>Promise<void>){
 let changed=0;for(const candidate of await store.expiredSplits(100)){
  const result=await store.tx(`venue:${candidate.venue_id}`,async tx=>{const current=await tx.lockSplit(candidate.venue_id,candidate.session_id,candidate.id);if(!current)return;const next=await expireSplit(tx,current);if(next.status===current.status)return;return {venue:next.venue_id,seq:await tx.eventHead(next.venue_id)};});
  if(result){changed++;await publish(result.venue,result.seq).catch(()=>{});}
 }return changed;
}
