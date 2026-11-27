// Explicitly gated CI-only disposable database. No existing schema is dropped.
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {PostgresStore} from '../apps/api/src/store.ts';
import {buildApp} from '../apps/api/src/app.ts';
import {randomBytes} from 'node:crypto';
import {signQR} from '../apps/api/src/security.ts';
import assert from 'node:assert/strict';
import {checkPlatformPostgres} from '../tests/platform-postgres-check.ts';
import {checkOperationsPostgres} from '../tests/operations-postgres-check.ts';
if(process.env.CI_TEST_DATABASE!=='1'||!process.env.TEST_DATABASE_URL)throw Error('Requires explicit isolated CI test database configuration.');
const url=new URL(process.env.TEST_DATABASE_URL);if(!url.pathname.endsWith('_test'))throw Error('Test database name must end in _test');
const schema='test_'+randomUUID().replaceAll('-','');const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema},public`});
try{
 await pool.query(`CREATE SCHEMA "${schema}"`);
 for(const f of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile('db/migrations/'+f,'utf8'));
 const store=new PostgresStore(pool);const venue=await store.add('venues',{slug:'isolated-'+randomUUID(),name:'CI DEMO',status:'ACTIVE'});const table=await store.add('dining_tables',{venue_id:venue.id,label:'T12',qr_code:randomUUID()});const secret=randomBytes(32).toString('hex');const app=await buildApp({store,tokenSecret:secret,qrSecret:secret,logger:false});
 const qr=signQR(table.qr_code,1,secret);const responses=await Promise.all(Array.from({length:21},()=>app.inject({method:'POST',url:'/v1/sessions/init',payload:{qr,device_id:randomUUID()}})));assert.equal(responses.filter(r=>r.statusCode===409).length,1);assert.equal((await store.rows('session_participants',{})).length,20);
 try{await store.tx('rollback-check',async tx=>{await tx.add('venues',{slug:'rollback-demo',name:'ROLLBACK DEMO'});throw Error('expected rollback');});}catch{/* verify below */}
 assert.equal((await store.rows('venues',{slug:'rollback-demo'})).length,0);await app.close();await checkOperationsPostgres(store,secret);await checkPlatformPostgres(store,secret);console.log('PostgreSQL migrations, concurrent participants and transaction rollback passed in isolated schema '+schema);
 // The disposable CI service owns cleanup. Never drop schemas against a supplied URL.
}finally{await pool.end();}
