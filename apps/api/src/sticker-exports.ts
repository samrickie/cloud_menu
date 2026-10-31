import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {resolveTheme,themes} from '../../../packages/ui/src/theme.ts';
import {idParams,type Context} from './context.ts';
import type {Row} from './store.ts';
import {Problem} from './security.ts';
const exportInput=z.object({style:z.enum(['noir','ivory','venue']).default('noir'),locale:z.enum(['en','sw']).default('en')}).strict();
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function registerStickerExports(app:FastifyInstance,ctx:Context,url:(table:Row,slug:string)=>string,limit:(key:string,max:number)=>Promise<void>){
 async function colours(venue:string,style:string){if(style!=='venue')return themes[style==='ivory'?'ivory':'noir'];const [p]=await ctx.store.rows('venue_profiles',{venue_id:venue});return resolveTheme(p?.theme??'noir',p?.brand_colour??undefined,p?.primary_text??undefined);}
 app.get('/v1/admin/tables/:id/sticker.png',async(req,reply)=>{
  const s=await ctx.staff(req,['MANAGER','OWNER']);await limit(`qr-png:${req.ip}`,20);const id=idParams(req.params),{style,locale}=exportInput.parse(req.query);const [t]=await ctx.store.rows('dining_tables',{id,venue_id:s.venue_id,is_active:true});if(!t)throw new Problem(404,'TABLE_NOT_FOUND');const [v]=await ctx.store.rows('venues',{id:s.venue_id});const theme=await colours(s.venue_id,style);const q=await QRCode.toString(url(t,v.slug),{type:'svg',margin:4,errorCorrectionLevel:'M'});const matrix=q.replace('<svg ', '<svg x="200" y="350" width="680" height="680" ');const number=t.label.match(/\d+$/)?.[0]??t.label;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440"><rect width="1080" height="1440" rx="30" fill="${theme.background}"/><rect x="25" y="25" width="1030" height="1390" rx="25" fill="none" stroke="${theme.primary}" stroke-width="3"/><text x="540" y="180" text-anchor="middle" font-family="serif" font-size="${Math.min(70,850/v.name.length)}" fill="${theme.text}">${escape(v.name)}</text><text x="540" y="265" text-anchor="middle" font-family="sans-serif" font-size="28" fill="${theme.muted}">${locale==='sw'?'CHANGANUA KUAGIZA':'SCAN TO ORDER'}</text>${matrix}<text x="540" y="1200" text-anchor="middle" font-family="serif" font-size="${Math.min(150,850/number.length)}" fill="${theme.highlight}">${escape(number)}</text><text x="540" y="1290" text-anchor="middle" font-family="sans-serif" font-size="34" fill="${theme.text}">${escape(t.label)}</text><text x="540" y="1360" text-anchor="middle" font-family="sans-serif" font-size="22" fill="${theme.muted}">Cloud-Menu</text></svg>`;
  return reply.type('image/png').header('Content-Disposition','attachment; filename="cloud-menu-sticker.png"').send(await sharp(Buffer.from(svg)).png().toBuffer());
 });
 app.get('/v1/admin/tables/qr.pdf',async(req,reply)=>{
  const s=await ctx.staff(req,['MANAGER','OWNER']);await limit(`qr-pdf:${req.ip}`,10);const {style,locale}=exportInput.parse(req.query);const [venue]=await ctx.store.rows('venues',{id:s.venue_id});const tables=(await ctx.store.rows('dining_tables',{venue_id:s.venue_id,is_active:true})).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));const theme=await colours(s.venue_id,style);
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.HelveticaBold);doc.setTitle('Cloud-Menu table QR stickers');doc.setSubject(JSON.stringify(tables.map(t=>({venue:venue.name,label:t.label,url:url(t,venue.slug)}))));
  const colour=(hex:string)=>rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]);const printable=(v:string)=>v.replace(/[^\x20-\x7e\xa0-\xff]/g,'?');let page=doc.addPage([595.28,841.89]);
  for(const [i,t]of tables.entries()){if(i>0&&i%12===0)page=doc.addPage([595.28,841.89]);const x=27+(i%3)*182,y=642-Math.floor(i%12/3)*198;page.drawRectangle({x,y,width:176,height:190,color:colour(theme.background),borderColor:colour(theme.primary),borderWidth:.5});const centered=(value:string,size:number,cy:number,tint:string)=>{const v=printable(value),fit=Math.min(size,162/Math.max(font.widthOfTextAtSize(v,1),1));page.drawText(v,{x:x+(176-font.widthOfTextAtSize(v,fit))/2,y:cy,size:fit,font,color:colour(tint)});};centered(venue.name,10,y+173,theme.text);
   const png=await QRCode.toBuffer(url(t,venue.slug),{width:600,margin:4,errorCorrectionLevel:'M',type:'png'});page.drawImage(await doc.embedPng(png),{x:x+33,y:y+58,width:110,height:110});centered(t.label.match(/\d+$/)?.[0]??t.label,26,y+32,theme.highlight);centered(t.label,8,y+20,theme.text);centered(locale==='sw'?'Changanua kuagiza':'Scan to order',7,y+7,theme.muted);
  }return reply.type('application/pdf').header('Content-Disposition','attachment; filename="cloud-menu-qr-stickers.pdf"').send(Buffer.from(await doc.save()));
 });
}
