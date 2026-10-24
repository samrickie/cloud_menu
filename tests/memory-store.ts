import type { Store, Table, Row } from '../apps/api/src/store.ts';
// Test adapter only. The production server never selects this adapter.
export class MemoryStore implements Store {
 data: Partial<Record<Table,Row[]>> = {}; private tail = Promise.resolve();
 async rows(table:Table,where:Row) { return structuredClone((this.data[table]??[]).filter(r=>Object.entries(where).every(([k,v])=>r[k]===v))); }
 async add(table:Table,row:Row) { const value={...row};if(table==='realtime_events')value.seq=(this.data.realtime_events?.length??0)+1; (this.data[table]??=[]).push(value); return structuredClone(value); }
 async patch(table:Table,where:Row,change:Row) { for(const r of this.data[table]??[]) if(Object.entries(where).every(([k,v])=>r[k]===v)) Object.assign(r,change); }
 async tx<T>(_lock:string,work:(tx:Store)=>Promise<T>):Promise<T> {
  const prior=this.tail; let release!:()=>void; this.tail=new Promise(r=>{release=r;}); await prior; const snapshot=structuredClone(this.data);
  try{return await work(this);}catch(e){this.data=snapshot;throw e;}finally{release();}
 }
}
