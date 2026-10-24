import { render } from 'preact';
import { useEffect,useState } from 'preact/hooks';
import { copy } from './i18n.ts';
import './style.css';
function App(){
 const [locale,setLocale]=useState<'en'|'sw'>(localStorage.getItem('locale')==='sw'?'sw':'en');
 const [entry,setEntry]=useState<any>();const [error,setError]=useState('');const t=copy[locale];
 async function enter(){
  const qr=new URLSearchParams(location.search).get('qr');if(!qr){setError('scan');return;}setError('');
  const device=localStorage.getItem('device_id')||crypto.randomUUID();localStorage.setItem('device_id',device);
  try{const response=await fetch('/v1/sessions/init',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qr,device_id:device,locale,device_proof:localStorage.getItem('device_proof:'+qr)||undefined})});const data=await response.json();
   if(!response.ok){setError(data.code==='VENUE_SUSPENDED'?'unavailable':data.code==='SESSION_FULL'?'full':'invalidQR');return;}
   if(data.device_proof)localStorage.setItem('device_proof:'+qr,data.device_proof);sessionStorage.setItem('entry',JSON.stringify(data));setEntry(data);
  }catch{setError('error');}
 }
 useEffect(()=>{void enter();},[]);
 return <main><header><strong>Cloud-Menu</strong><button onClick={()=>{const l=locale==='en'?'sw':'en';setLocale(l);localStorage.setItem('locale',l);document.documentElement.lang=l;}}>EN / SW</button></header>{entry?<><h1>{entry.venue.name}</h1><p>{entry.table.label}</p><h2>{t.menu}</h2></>:<><h1>{t.menu}</h1><p role="status">{error?t[error as keyof typeof t]:t.loading}</p>{error&&<button onClick={enter}>{t.retry}</button>}</>}</main>;
}
render(<App/>,document.getElementById('app')!);
