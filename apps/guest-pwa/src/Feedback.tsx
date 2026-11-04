import {useState} from 'preact/hooks';
import type {GuestOrder} from './live.ts';
export function Feedback({order,entry,locale}:{order:GuestOrder;entry:any;locale:'en'|'sw'}){
 const [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const [ratings,setRatings]=useState<Record<string,number>>({});
 const sw=locale==='sw';
 if(order.status!=='SERVED')return null;
 if(sent||order.rated)return <p>{sw?'Asante kwa maoni yako.':'Thank you for rating your service.'}</p>;
 const food=order.items.filter(i=>i.station==='KITCHEN'&&i.status==='SERVED');
 const score=(name:string,label:string)=><fieldset class="star-rating"><legend>{label}</legend><div>{[1,2,3,4,5].map(n=><label key={n}><input type="radio" name={name} value={n} required checked={ratings[name]===n} onChange={()=>setRatings(prev=>({...prev,[name]:n}))} aria-label={sw?`Nyota ${n} kati ya 5`:`${n} of 5 stars`}/><span aria-hidden="true">{n<=(ratings[name]??0)?'★':'☆'}</span></label>)}</div></fieldset>;
 return <form class="cm-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError(false);
 try{const response=await fetch('/v1/sessions/'+entry.session.id+'/orders/'+order.id+'/feedback',{method:'POST',headers:{authorization:'Bearer '+entry.session_token,'Content-Type':'application/json'},body:JSON.stringify({waiter:Number(f.get('waiter')),food:food.map(i=>({line:i.id,rating:Number(f.get(i.id))})),comment:f.get('comment')})});if(!response.ok)throw Error();setSent(true);}catch{setError(true);}finally{setBusy(false);}}}>
 <h3>{sw?'Tathmini huduma':'Rate your service'}</h3>{score('waiter',sw?'Huduma ya mhudumu':'Waiter service')}{food.map(i=>score(i.id,i.name))}<label>{sw?'Maoni (hiari)':'Comment (optional)'}<textarea name="comment" maxLength={500}/></label><button class="primary rating-submit" type="submit" disabled={busy}>{sw?'Tuma maoni':'Submit rating'}</button>{error&&<p role="alert">{sw?'Jaribu tena.':'Please try again.'}</p>}</form>;
}
