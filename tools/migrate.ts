import pg from 'pg';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try{
 await client.query("SELECT pg_advisory_lock(hashtext('cloud-menu:migrations'))");
 await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){
  const source=await readFile('db/migrations/'+file,'utf8'),sha=createHash('sha256').update(source).digest('hex');const {rows:[old]}=await client.query('SELECT sha256 FROM schema_migrations WHERE name=$1',[file]);
  if(old){if(old.sha256!==sha)throw Error('Applied migration changed: '+file);continue;}
  await client.query('BEGIN');try{await client.query(source.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,''));await client.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[file,sha]);await client.query('COMMIT');console.log('Applied '+file);}catch(e){await client.query('ROLLBACK');throw e;}
 }
}finally{await client.end();}
