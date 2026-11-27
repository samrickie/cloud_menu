import type {FastifyInstance} from 'fastify';
import {Problem} from './security.ts';
export function registerReadiness(app:FastifyInstance,database:{query:(sql:string)=>Promise<unknown>},redis:{ping:()=>Promise<unknown>}){
 app.get('/ready',async()=>{try{await Promise.all([database.query('SELECT 1'),redis.ping()]);return {status:'ready'};}catch{throw new Problem(503,'DEPENDENCY_UNAVAILABLE');}});
}
