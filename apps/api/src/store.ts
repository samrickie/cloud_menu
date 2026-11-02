import pg from 'pg';
export const tables = ['venues','dining_tables','table_sessions','session_participants','menus','categories','items','modifier_groups','modifiers','item_modifier_groups','orders','order_items','order_item_modifiers','idempotency_keys','realtime_events','staff_users','audit_log','owner_accounts','venue_profiles','waiter_calls','bills','bill_splits','bill_shares','bill_share_items','payment_transactions','owner_identities','oauth_flows'] as const;
export type Table = typeof tables[number];
export type Row = Record<string,any>;
export interface Store {
 expiredSplits(limit:number):Promise<Row[]>;
 lockSplit(venue:string,session:string,id:string):Promise<Row|undefined>;
 allocations(venue:string,session:string,split:string):Promise<Row[]>;
 paidAllocations(venue:string,session:string):Promise<Row[]>;
 events(venue:string,after:number,limit:number,session?:string):Promise<Row[]>;
 eventHead(venue:string):Promise<number>;
 rows(table:Table,where:Row):Promise<Row[]>;
 add(table:Table,row:Row):Promise<Row>;
 patch(table:Table,where:Row,change:Row):Promise<void>;
 remove(table:'item_modifier_groups'|'bill_share_items',where:Row):Promise<void>;
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
 async lockSplit(venue:string,session:string,id:string){if(!this.client)throw Error('Split row lock requires a transaction');return (await this.query('SELECT * FROM bill_splits WHERE venue_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE',[venue,session,id])).rows.map(normalizeRow)[0];}
 async expiredSplits(limit:number){if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid expiry batch');return (await this.query("SELECT b.* FROM bill_splits b WHERE b.status='LOCKED' AND b.lock_expires_at<=now() AND NOT EXISTS (SELECT 1 FROM bill_shares s WHERE s.split_id=b.id AND s.venue_id=b.venue_id AND s.session_id=b.session_id AND (s.status='PENDING' OR EXISTS (SELECT 1 FROM payment_transactions p WHERE p.share_id=s.id AND p.venue_id=s.venue_id AND p.status IN ('INITIATED','PENDING')))) ORDER BY b.lock_expires_at,b.id LIMIT $1",[limit])).rows.map(normalizeRow);}
 async allocations(venue:string,session:string,split:string){return (await this.query('SELECT i.* FROM bill_share_items i JOIN bill_shares s ON s.id=i.share_id AND s.venue_id=i.venue_id AND s.session_id=i.session_id WHERE i.venue_id=$1 AND i.session_id=$2 AND s.split_id=$3',[venue,session,split])).rows.map(normalizeRow);}
 async paidAllocations(venue:string,session:string){return (await this.query("SELECT i.order_item_id,SUM(i.amount_tzs) AS amount_tzs FROM bill_share_items i JOIN bill_shares s ON s.id=i.share_id AND s.venue_id=i.venue_id AND s.session_id=i.session_id WHERE i.venue_id=$1 AND i.session_id=$2 AND s.status='PAID' GROUP BY i.order_item_id",[venue,session])).rows.map(normalizeRow);}
 async events(venue:string,after:number,limit:number,session?:string){if(!Number.isSafeInteger(limit)||limit<1||limit>2000)throw Error('Invalid event batch');return (await this.query(`SELECT * FROM realtime_events WHERE venue_id=$1 AND seq>$2${session?" AND (session_id=$4 OR (session_id IS NULL AND event_type='menu.item_availability'))":''} ORDER BY seq LIMIT $3`,[venue,after,limit,...(session?[session]:[])])).rows.map(normalizeRow);}
 async eventHead(venue:string){return normalizeRow((await this.query('SELECT COALESCE(MAX(seq),0) AS seq FROM realtime_events WHERE venue_id=$1',[venue])).rows[0]).seq as number;}
 async rows(table:Table,where:Row){const keys=Object.keys(where);return (await this.query(`SELECT * FROM ${this.table(table)}${keys.length?' WHERE '+keys.map((k,i)=>`${ident(k)} IS NOT DISTINCT FROM $${i+1}`).join(' AND '):''}`,Object.values(where))).rows.map(normalizeRow);}
 async add(table:Table,row:Row){const keys=Object.keys(row);return normalizeRow((await this.query(`INSERT INTO ${this.table(table)} (${keys.map(ident)}) VALUES (${keys.map((_,i)=>'$'+(i+1))}) RETURNING *`,Object.values(row))).rows[0]);}
 async patch(table:Table,where:Row,change:Row){const keys=Object.keys(change),wk=Object.keys(where);if(!wk.length)throw new Error('Unscoped update');await this.query(`UPDATE ${this.table(table)} SET ${keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(',')} WHERE ${wk.map((k,i)=>`${ident(k)} IS NOT DISTINCT FROM $${keys.length+i+1}`).join(' AND ')}`,[...Object.values(change),...Object.values(where)]);}
 async remove(table:'item_modifier_groups'|'bill_share_items',where:Row){const keys=Object.keys(where);if(!['item_modifier_groups','bill_share_items'].includes(table)||!keys.length||(table==='bill_share_items'&&(!where.venue_id||!where.session_id)))throw new Error('Invalid link deletion');await this.query(`DELETE FROM ${this.table(table)} WHERE ${keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(' AND ')}`,Object.values(where));}
 async tx<T>(lock:string,work:(tx:Store)=>Promise<T>):Promise<T>{
  if(this.client)throw new Error('Nested transaction');const client=await this.pool.connect();
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock]);const result=await work(new PostgresStore(this.pool,client));await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
