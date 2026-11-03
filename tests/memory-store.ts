import {memoryDashboard} from './dashboard-memory.ts';
import type {ReportWindow} from '../apps/api/src/dashboard.ts';
import type { Store, Table, Row } from '../apps/api/src/store.ts';
// Test adapter only. The production server never selects this adapter.
export class MemoryStore implements Store {
 async recentOrders(venue:string,station?:string,status?:string){const out:Row[]=[];for(const o of (await this.rows('orders',{venue_id:venue})).filter(o=>!status||o.status===status).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())){if(!station||(await this.rows('order_items',{order_id:o.id,station})).length)out.push(o);if(out.length===200)break;}return out;}
 async dashboard(venue:string,w:ReportWindow){return memoryDashboard(this,venue,w);}
 async imageStorageBytes(venue:string){return (await this.rows('menu_images',{venue_id:venue})).reduce((n,i)=>n+i.content.byteLength,0);}
 async lockSplit(venue:string,session:string,id:string){return (await this.rows('bill_splits',{venue_id:venue,session_id:session,id}))[0];}
 async expiredSplits(limit:number){const out:Row[]=[];for(const split of (await this.rows('bill_splits',{status:'LOCKED'})).sort((a,b)=>Date.parse(a.lock_expires_at)-Date.parse(b.lock_expires_at))){if(!split.lock_expires_at||Date.parse(split.lock_expires_at)>Date.now())continue;const shares=await this.rows('bill_shares',{split_id:split.id,venue_id:split.venue_id,session_id:split.session_id});let pending=shares.some(s=>s.status==='PENDING');for(const share of shares)if((await this.rows('payment_transactions',{share_id:share.id,venue_id:split.venue_id})).some(p=>['INITIATED','PENDING'].includes(p.status)))pending=true;if(!pending)out.push(split);if(out.length===limit)break;}return out;}
 async allocations(venue:string,session:string,split:string){const ids=new Set((await this.rows('bill_shares',{venue_id:venue,session_id:session,split_id:split})).map(s=>s.id));return (await this.rows('bill_share_items',{venue_id:venue,session_id:session})).filter(i=>ids.has(i.share_id));}
 async paidAllocations(venue:string,session:string){const ids=new Set((await this.rows('bill_shares',{venue_id:venue,session_id:session,status:'PAID'})).map(s=>s.id)),totals=new Map<string,number>();for(const i of await this.rows('bill_share_items',{venue_id:venue,session_id:session}))if(ids.has(i.share_id))totals.set(i.order_item_id,(totals.get(i.order_item_id)??0)+i.amount_tzs);return [...totals].map(([order_item_id,amount_tzs])=>({order_item_id,amount_tzs}));}
 async events(venue:string,after:number,limit:number,session?:string){return structuredClone((this.data.realtime_events??[]).filter(e=>e.venue_id===venue&&e.seq>after&&(!session||e.session_id===session||(e.session_id===null&&e.event_type==='menu.item_availability'))).sort((a,b)=>a.seq-b.seq).slice(0,limit));}
 async eventHead(venue:string){return (this.data.realtime_events??[]).filter(e=>e.venue_id===venue).reduce((n,e)=>Math.max(n,e.seq),0);}
 data: Partial<Record<Table,Row[]>> = {}; private tail = Promise.resolve();
 async rows(table:Table,where:Row) { return structuredClone((this.data[table]??[]).filter(r=>Object.entries(where).every(([k,v])=>r[k]===v))); }
 async add(table:Table,row:Row) { const value={...row};if(table==='bills'&&!value.created_at)value.created_at=new Date().toISOString();if(table==='realtime_events')value.seq=(this.data.realtime_events?.length??0)+1; (this.data[table]??=[]).push(value); return structuredClone(value); }
 async patch(table:Table,where:Row,change:Row) { for(const r of this.data[table]??[]) if(Object.entries(where).every(([k,v])=>r[k]===v)) Object.assign(r,change); }
 async remove(table:'item_modifier_groups'|'bill_share_items',where:Row){if(!Object.keys(where).length||(table==='bill_share_items'&&(!where.venue_id||!where.session_id)))throw Error('Invalid link deletion');this.data[table]=(this.data[table]??[]).filter(r=>!Object.entries(where).every(([k,v])=>r[k]===v));}
 async tx<T>(_lock:string,work:(tx:Store)=>Promise<T>):Promise<T> {
  const prior=this.tail; let release!:()=>void; this.tail=new Promise(r=>{release=r;}); await prior; const snapshot=structuredClone(this.data);
  try{return await work(this);}catch(e){this.data=snapshot;throw e;}finally{release();}
 }
}
