import {PgBoss} from 'pg-boss';
import type {Store} from './store.ts';
import {sweepExpiredAccess} from './subscription-access.ts';
import {sweepExpiredSplits} from './split-expiry.ts';
// Lifecycle boundary for Sprint 2 workers. No payment jobs are registered in S1.
export async function startJobs(connectionString:string){const boss=new PgBoss({connectionString});await boss.start();return boss;}
export async function startSplitJobs(connectionString:string,store:Store,publish:(venue:string,seq:number)=>Promise<void>,onError:()=>void){const boss=new PgBoss({connectionString});boss.on('error',onError);await boss.start();try{const name='cloud-menu-split-expiry';await boss.createQueue(name,{retryLimit:3,retryDelay:5});await boss.work(name,async()=>{await sweepExpiredSplits(store,publish);});await boss.schedule(name,'* * * * *',{}, {tz:'Africa/Dar_es_Salaam'});const accessName='cloud-menu-access-expiry';await boss.createQueue(accessName,{retryLimit:3,retryDelay:5});await boss.work(accessName,async()=>{await sweepExpiredAccess(store,publish);});await boss.schedule(accessName,'* * * * *',{}, {tz:'Africa/Dar_es_Salaam'});return boss;}catch(e){await boss.stop();throw e;}}
