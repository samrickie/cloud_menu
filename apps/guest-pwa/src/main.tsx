import {render} from 'preact';
import {useEffect,useState} from 'preact/hooks';
import {copy,ui} from './i18n.ts';
import {Ordering} from './ordering.tsx';
import './style.css';
function App(){
 const qr=new URLSearchParams(location.search).get('qr');
 const [locale,setLocale]=useState<'en'|'sw'>(localStorage.getItem('locale')==='sw'?'sw':'en');
 const [entry,setEntry]=useState<any>(()=>{try{const old=JSON.parse(sessionStorage.getItem('entry:'+qr)??'null');return old&&Date.parse(old.token_expires_at)>Date.now()?old:undefined;}catch{return undefined;}});
 const [online,setOnline]=useState(navigator.onLine),[error,setError]=useState('');const t=copy[locale];
 async function enter(){
  if(!qr){setError('scan');return;}setError('');
  const device=localStorage.getItem('device_id')||crypto.randomUUID();localStorage.setItem('device_id',device);
  try{
   const response=await fetch('/v1/sessions/init',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qr,device_id:device,locale,device_proof:localStorage.getItem('device_proof:'+qr)||undefined})});const data=await response.json();
   if(!response.ok){setEntry(undefined);setError(data.code==='VENUE_SUSPENDED'?'unavailable':data.code==='SESSION_FULL'?'full':'invalidQR');return;}
   if(data.device_proof)localStorage.setItem('device_proof:'+qr,data.device_proof);sessionStorage.setItem('entry:'+qr,JSON.stringify(data));setEntry(data);
  }catch{if(!entry)setError('error');}
 }
 useEffect(()=>{void enter();const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 async function rename(name:string){try{const r=await fetch(`/v1/sessions/${entry.session.id}/participant`,{method:'PATCH',headers:{'Content-Type':'application/json',authorization:`Bearer ${entry.session_token}`},body:JSON.stringify({display_name:name})});if(r.ok)setEntry({...entry,participant:(await r.json()).participant});else setError('error');}catch{setError('error');}}
 return <main><header><strong>Cloud-Menu</strong><button onClick={()=>{const next=locale==='en'?'sw':'en';setLocale(next);localStorage.setItem('locale',next);}}>EN / SW</button></header>{!online&&<p role="status" class="offline">{t.offline}</p>}{entry?<><h1>{entry.venue.name}</h1><p>{entry.table.label}</p><label>{ui(locale,'message_6')}<input aria-label={ui(locale,'message_6')} maxLength={60} defaultValue={entry.participant.display_name} onBlur={e=>void rename(e.currentTarget.value)}/></label>{error&&<p role="alert">{t.error}</p>}<h2>{t.menu}</h2><Ordering entry={entry} locale={locale}/></>:<><h1>{t.menu}</h1><p role="status">{error?t[error as keyof typeof t]:t.loading}</p>{error&&<button onClick={enter}>{t.retry}</button>}</>}</main>;
}
const root=document.getElementById('app')!;root.replaceChildren();render(<App/>,root);
