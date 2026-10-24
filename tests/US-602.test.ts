import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
import {PDFDocument} from 'pdf-lib';
import {randomUUID} from 'node:crypto';
let f:Awaited<ReturnType<typeof fixture>>,token:string;
beforeEach(async()=>{f=await fixture();const s=await f.store.add('staff_users',{id:randomUUID(),venue_id:f.venue.id,role:'MANAGER',is_active:true});token=await auth(secrets.token).sign({kind:'staff',staff_id:s.id,venue_id:f.venue.id,role:'MANAGER'},3600);});afterEach(async()=>f.app.close());
describe('US-602 printable table QR codes',()=>{
 it('Generate QR codes: tables T1 to T14 produce a PDF with one signed QR per table, label and venue',async()=>{const r=await f.app.inject({method:'POST',url:'/v1/admin/tables',headers:{authorization:`Bearer ${token}`},payload:{labels:Array.from({length:14},(_,i)=>'T'+(i+1))}});expect(r.statusCode).toBe(201);expect(r.json().tables).toHaveLength(14);const pdf=await f.app.inject({url:'/v1/admin/tables/qr.pdf',headers:{authorization:`Bearer ${token}`}});expect(pdf.statusCode).toBe(200);expect(pdf.headers['content-type']).toContain('application/pdf');const parsed=await PDFDocument.load(pdf.rawPayload);expect(parsed.getPageCount()).toBe(2);const manifest=JSON.parse(parsed.getSubject()!);expect(manifest).toHaveLength(14);expect(manifest.every((x:any)=>x.venue.includes('[DEMO]')&&x.label&&new URL(x.url).searchParams.get('qr'))).toBe(true);});
 it('Regenerate compromised QR: old token stops working immediately',async()=>{const rotated=await f.app.inject({method:'POST',url:`/v1/admin/tables/${f.table.id}/rotate`,headers:{authorization:`Bearer ${token}`}});expect(rotated.statusCode).toBe(200);expect((await f.init()).json().code).toBe('QR_SIGNATURE_INVALID');const qr=new URL(rotated.json().url).searchParams.get('qr');const r=await f.app.inject({method:'POST',url:'/v1/sessions/init',payload:{qr,device_id:randomUUID()}});expect(r.statusCode).toBe(201);});
 it('A manager cannot rotate a table outside their venue',async()=>{const r=await f.app.inject({method:'POST',url:`/v1/admin/tables/${randomUUID()}/rotate`,headers:{authorization:`Bearer ${token}`}});expect(r.statusCode).toBe(404);});
});
