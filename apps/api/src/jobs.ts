import {PgBoss} from 'pg-boss';
// Lifecycle boundary for Sprint 2 workers. No payment jobs are registered in S1.
export async function startJobs(connectionString:string){const boss=new PgBoss({connectionString});await boss.start();return boss;}
