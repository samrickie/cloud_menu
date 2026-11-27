import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {Context} from './context.ts';
import type {Row} from './store.ts';
import {Problem} from './security.ts';
import {csvExport,xlsxExport} from './export-format.ts';
export function registerPlatformExports(app:FastifyInstance,ctx:Context,platform:(req:FastifyRequest)=>Promise<Row>){
 app.get('/v1/platform/records',async(req,reply)=>{
  const actor=await platform(req),q=z.object({kind:z.enum(['details','staff','orders','transactions','subscriptions']),business:z.uuid().optional(),branch:z.uuid().optional(),from:z.iso.datetime().optional(),until:z.iso.datetime().optional(),page:z.coerce.number().int().min(1).max(100000).default(1),subscription_status:z.enum(['PAID','UNPAID','OVERDUE','EXPIRED','TRIAL']).optional(),format:z.enum(['json','csv','xlsx']).default('json')}).strict().parse(req.query);
  if(q.from&&q.until&&Date.parse(q.from)>=Date.parse(q.until))throw new Problem(422,'INVALID_DATE_RANGE');
  if(q.branch){const [branch]=await ctx.store.rows('venues',{id:q.branch,...(q.business?{business_id:q.business}:{})});if(!branch)throw new Problem(404,'BRANCH_NOT_FOUND');}
  const results=await ctx.store.exportRecords(q.kind,q.business,q.branch,q.from,q.until,q.page,q.subscription_status),rows=results.slice(0,200),has_more=results.length>200;
  await ctx.store.add('audit_log',{actor_type:'PLATFORM_ADMIN',actor_id:actor.id,action:q.format==='json'?'RECORDS_VIEWED':'RECORDS_EXPORTED',entity_type:'business',entity_id:q.business??null,data:{...q,count:rows.length}});
  reply.header('Cache-Control','no-store').header('X-Export-Has-More',String(has_more));
  if(q.format==='json')return {rows,page:q.page,has_more,page_size:200};
  reply.header('Content-Disposition',`attachment; filename="cloud-menu-${q.kind}-page-${q.page}.${q.format}"`);
  return q.format==='csv'?reply.type('text/csv; charset=utf-8').send(csvExport(rows)):reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(xlsxExport(rows));
 });
}
