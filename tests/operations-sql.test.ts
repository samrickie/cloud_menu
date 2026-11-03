import {it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {citext} from '@electric-sql/pglite/contrib/citext';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readdir,readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import type pg from 'pg';
import {PostgresStore} from '../apps/api/src/store.ts';
import {checkOperationsPostgres} from './operations-postgres-check.ts';
it('all real migrations, dashboard SQL, stock transactions, tenant scoping and image bytea work in embedded PostgreSQL',async()=>{
 const db=new PGlite({extensions:{citext,pgcrypto}});
 try{for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('db/migrations/'+file,'utf8'));
 let pending=Promise.resolve();const query=(sql:string,values:unknown[]=[])=>db.query(sql,values),pool={query,connect:async()=>{const old=pending;let release!:()=>void;pending=new Promise<void>(resolve=>{release=resolve;});await old;return {query,release};}};await checkOperationsPostgres(new PostgresStore(pool as unknown as pg.Pool),randomBytes(32).toString('hex'));
 }finally{await db.close();}
},60000);
