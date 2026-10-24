import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {randomUUID,randomBytes} from 'node:crypto';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import QRCode from 'qrcode';
import {idParams,type Context} from './context.ts';
import {Problem,signQR} from './security.ts';
export function registerTables(app:FastifyInstance,ctx:Context,qrSecret:string,guestOrigin:string){
 const url=(table:any)=>{const u=new URL('/',guestOrigin);u.searchParams.set('qr',signQR(table.qr_code,table.qr_key_version,qrSecret));return u.toString();};
 app.get('/v1/admin/tables',async request=>{const s=await ctx.staff(request,['MANAGER','OWNER']);return {tables:(await ctx.store.rows('dining_tables',{venue_id:s.venue_id,is_active:true})).map(t=>({...t,url:url(t)}))};});
 app.post('/v1/admin/tables',async(request,reply)=>{const s=await ctx.staff(request,['MANAGER','OWNER']);const {labels}=z.object({labels:z.array(z.string().trim().min(1).max(30)).min(1).max(100)}).parse(request.body);return ctx.store.tx(`venue:${s.venue_id}`,async tx=>{const tables=[];for(const label of new Set(labels)){let [t]=await tx.rows('dining_tables',{venue_id:s.venue_id,label});if(!t)t=await tx.add('dining_tables',{id:randomUUID(),venue_id:s.venue_id,label,qr_code:randomBytes(12).toString('base64url'),qr_key_version:1,is_active:true});tables.push({...t,url:url(t)});}await tx.add('audit_log',{venue_id:s.venue_id,actor_type:'STAFF',actor_id:s.id,action:'TABLES_CREATED',entity_type:'table',data:{count:tables.length}});reply.code(201);return {tables};});});
 app.post('/v1/admin/tables/:id/rotate',async request=>{const s=await ctx.staff(request,['MANAGER','OWNER']),id=idParams(request.params);return ctx.store.tx(`venue:${s.venue_id}`,async tx=>{const [t]=await tx.rows('dining_tables',{id,venue_id:s.venue_id,is_active:true});if(!t)throw new Problem(404,'TABLE_NOT_FOUND');const next={...t,qr_key_version:t.qr_key_version+1,qr_rotated_at:new Date().toISOString()};await tx.patch('dining_tables',{id,venue_id:s.venue_id},{qr_key_version:next.qr_key_version,qr_rotated_at:next.qr_rotated_at});await tx.add('audit_log',{venue_id:s.venue_id,actor_type:'STAFF',actor_id:s.id,action:'QR_ROTATED',entity_type:'table',entity_id:id});return {table_id:id,url:url(next)};});});
 app.get('/v1/admin/tables/qr.pdf',async(request,reply)=>{
  const s=await ctx.staff(request,['MANAGER','OWNER']);const [venue]=await ctx.store.rows('venues',{id:s.venue_id});const tables=(await ctx.store.rows('dining_tables',{venue_id:s.venue_id,is_active:true})).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);doc.setTitle('Cloud-Menu table QR stickers');doc.setSubject(JSON.stringify(tables.map(t=>({venue:venue.name,label:t.label,url:url(t)}))));
  let page=doc.addPage([595.28,841.89]);const printable=(s:string)=>s.replace(/[^\x20-\x7e\xa0-\xff]/g,'?');
  for(const [i,t]of tables.entries()){if(i>0&&i%12===0)page=doc.addPage([595.28,841.89]);const col=i%3,row=Math.floor(i%12/3),x=30+col*180,y=650-row*195;
   const png=await QRCode.toBuffer(url(t),{width:600,margin:4,errorCorrectionLevel:'M',type:'png'});const image=await doc.embedPng(png);page.drawRectangle({x:x-5,y:y-5,width:170,height:185,borderColor:rgb(.75,.75,.75),borderWidth:.5});page.drawImage(image,{x:x+10,y:y+15,width:140,height:140});
   const name=printable(venue.name);const size=Math.min(10,155/font.widthOfTextAtSize(name,1));page.drawText(name,{x,y:y+163,font,size});page.drawText(printable(t.label),{x:x+10,y:y+3,font:bold,size:12});page.drawText('Scan to order / Changanua kuagiza',{x,y:y-1,font,size:7});
  }
  return reply.type('application/pdf').header('Content-Disposition','attachment; filename="cloud-menu-qr-stickers.pdf"').send(Buffer.from(await doc.save()));
 });
}
