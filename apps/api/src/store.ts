import pg from 'pg';
export const tables = ['venues','dining_tables','table_sessions','session_participants','menus','categories','items','modifier_groups','modifiers','item_modifier_groups','orders','order_items','order_item_modifiers','idempotency_keys','realtime_events','staff_users','audit_log','owner_accounts','venue_profiles','waiter_calls'] as const;
export type Table = typeof tables[number];
export type Row = Record<string,any>;
export interface Store {
 events(venue:string,after:number,limit:number,session?:string):Promise<Row[]>;
 eventHead(venue:string):Promise<number>;
 rows(table:Table,where:Row):Promise<Row[]>;
 add(table:Table,row:Row):Promise<Row>;
 patch(table:Table,where:Row,change:Row):Promise<void>;
 remove(table:'item_modifier_groups',where:Row):Promise<void>;
 tx<T>(lock:string,work:(tx:Store)=>Promise<T>):Promise<T>;
}
const ident=(s:string)=>{if(!/^[a-z_]+$/.test(s))throw new Error('Invalid SQL identifier');return `"${s}"`;};
export function normalizeRow(row:Row):Row{return Object.fromEntries(Object.entries(row).map(([k,v])=>{
 if((k.endsWith('_tzs')||k==='seq'||k==='token_issued_at')&&v!==null&&v!==undefined){const n=Number(v);if(!Number.isSafeInteger(n))throw new Error('Unsafe database integer: '+k);return [k,n];}
 if(k==='business_date'&&v instanceof Date)return [k,v.toISOString().slice(0,10)];return [k,v];
}));}
export class PostgresStore implements Store {
 constructor(private pool:pg.Pool,private client?:pg.PoolClient){}
 private query(sql:string,values:any[]=[]){return (this.client??this.pool).query(sql,values);}
 private table(table:Table){if(!tables.includes(table))throw new Error('Unknown table');return ident(table);}
 async events(venue:string,after:number,limit:number,session?:string){if(!Number.isSafeInteger(limit)||limit<1||limit>2000)throw Error('Invalid event batch');return (await this.query(`SELECT * FROM realtime_events WHERE venue_id=$1 AND seq>$2${session?" AND (session_id=$4 OR (session_id IS NULL AND event_type='menu.item_availability'))":''} ORDER BY seq LIMIT $3`,[venue,after,limit,...(session?[session]:[])])).rows.map(normalizeRow);}
 async eventHead(venue:string){return normalizeRow((await this.query('SELECT COALESCE(MAX(seq),0) AS seq FROM realtime_events WHERE venue_id=$1',[venue])).rows[0]).seq as number;}
 async rows(table:Table,where:Row){const keys=Object.keys(where);return (await this.query(`SELECT * FROM ${this.table(table)}${keys.length?' WHERE '+keys.map((k,i)=>`${ident(k)} IS NOT DISTINCT FROM $${i+1}`).join(' AND '):''}`,Object.values(where))).rows.map(normalizeRow);}
 async add(table:Table,row:Row){const keys=Object.keys(row);return normalizeRow((await this.query(`INSERT INTO ${this.table(table)} (${keys.map(ident)}) VALUES (${keys.map((_,i)=>'$'+(i+1))}) RETURNING *`,Object.values(row))).rows[0]);}
 async patch(table:Table,where:Row,change:Row){const keys=Object.keys(change),wk=Object.keys(where);if(!wk.length)throw new Error('Unscoped update');await this.query(`UPDATE ${this.table(table)} SET ${keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(',')} WHERE ${wk.map((k,i)=>`${ident(k)} IS NOT DISTINCT FROM $${keys.length+i+1}`).join(' AND ')}`,[...Object.values(change),...Object.values(where)]);}
 async remove(table:'item_modifier_groups',where:Row){const keys=Object.keys(where);if(table!=='item_modifier_groups'||!keys.length)throw new Error('Invalid link deletion');await this.query(`DELETE FROM ${this.table(table)} WHERE ${keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(' AND ')}`,Object.values(where));}
 async tx<T>(lock:string,work:(tx:Store)=>Promise<T>):Promise<T>{
  if(this.client)throw new Error('Nested transaction');const client=await this.pool.connect();
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock]);const result=await work(new PostgresStore(this.pool,client));await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
