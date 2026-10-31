import {z} from 'zod';
import pg from 'pg';
import Redis from 'ioredis';
import {buildApp} from './app.ts';
import {PostgresStore} from './store.ts';
import path from 'node:path';
const env=z.object({DATABASE_URL:z.string().min(1),REDIS_URL:z.string().min(1),TOKEN_SECRET:z.string().min(64),QR_SECRET:z.string().min(64),GUEST_ORIGIN:z.url(),PORT:z.coerce.number().default(3000),UPLOAD_DIR:z.string().default('./uploads'),OWNER_REGISTRATION_ENABLED:z.enum(['true','false']).default('false'),ORDERING_ENABLED:z.enum(['true','false']).default('false')}).parse(process.env);
const pool=new pg.Pool({connectionString:env.DATABASE_URL,max:10});const redis=new Redis(env.REDIS_URL,{maxRetriesPerRequest:1});
await pool.query('SELECT 1');await redis.ping();
const subscriber=redis.duplicate();subscriber.on('error',()=>{});await subscriber.ping();
const receivers=new Map<string,(seq:number)=>void>();subscriber.on('message',(channel,payload)=>{if(!channel.startsWith('venue:'))return;const seq=Number(payload);if(Number.isSafeInteger(seq)&&seq>0)receivers.get(channel.slice(6))?.(seq);});
const app=await buildApp({store:new PostgresStore(pool),ownerRegistrationEnabled:env.OWNER_REGISTRATION_ENABLED==='true',tokenSecret:env.TOKEN_SECRET,qrSecret:env.QR_SECRET,guestOrigin:env.GUEST_ORIGIN,orderingEnabled:env.ORDERING_ENABLED==='true',uploadDir:path.resolve(env.UPLOAD_DIR),subscribe:async(venue,receive)=>{receivers.set(venue,receive);try{await subscriber.subscribe('venue:'+venue);}catch(e){receivers.delete(venue);throw e;}return()=>{if(receivers.get(venue)===receive){receivers.delete(venue);void subscriber.unsubscribe('venue:'+venue).catch(()=>{});}};},rateLimit:async(key,max,seconds)=>{
 const n=await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",1,'cloud-menu:rate:'+key,seconds);return Number(n)<=max;
},publish:async(venue,seq)=>{await redis.publish('venue:'+venue,String(seq));}});
app.get('/ready',async()=>{await pool.query('SELECT 1');await redis.ping();
const subscriber=redis.duplicate();subscriber.on('error',()=>{});await subscriber.ping();
const receivers=new Map<string,(seq:number)=>void>();subscriber.on('message',(channel,payload)=>{if(!channel.startsWith('venue:'))return;const seq=Number(payload);if(Number.isSafeInteger(seq)&&seq>0)receivers.get(channel.slice(6))?.(seq);});return {status:'ready'};});
await app.listen({host:'0.0.0.0',port:env.PORT});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void app.close().then(async()=>{await pool.end();await subscriber.quit();await redis.quit();process.exit(0);}));
