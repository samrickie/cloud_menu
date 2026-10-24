import {ui,orderError,receivedStatus} from './i18n.ts';
import {useState} from 'preact/hooks';
import {orderBody,cartTotal,type CartLine} from '../../../packages/shared/src/cart.ts';
import {money} from '../../../packages/shared/src/index.ts';
export function SubmitOrder({entry,cart,locale,done}:{entry:any;cart:CartLine[];locale:'en'|'sw';done:()=>void}){
 const [pending,setPending]=useState(false),[review,setReview]=useState<any>(),[error,setError]=useState(''),[order,setOrder]=useState<any>();
 const body=orderBody(cart,'');const fingerprint=JSON.stringify(body.items);
 function attempt(){const k='cloud-menu:attempt:'+entry.session.id;const old=JSON.parse(localStorage.getItem(k)??'null');if(old?.fingerprint===fingerprint)return old;const next={fingerprint,id:crypto.randomUUID()};localStorage.setItem(k,JSON.stringify(next));return next;}
 async function post(path:string,payload:any,key?:string){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',authorization:`Bearer ${entry.session_token}`,...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.code),data);return data;}
 async function send(confirm=false){setPending(true);setError('');try{
  const a=attempt(),payload=orderBody(cart,a.id),base=`/v1/sessions/${entry.session.id}`;
  const confirmed=confirm&&review?.fingerprint===fingerprint;
  const quote=confirmed?review:await post(base+'/order-quote',payload);
  if(!confirmed&&quote.subtotal_tzs!==cartTotal(cart)){setReview({...quote,fingerprint});return;}
  const result=await post(base+'/orders',{...payload,quote_token:quote.quote_token},a.id);localStorage.removeItem('cloud-menu:attempt:'+entry.session.id);setOrder(result.order);setReview(undefined);done();
 }catch(e){setReview(undefined);setError(orderError(locale,(e as Error).message));}finally{setPending(false);}}
 return <>{order&&<p role="status">{ui(locale,'message_21')} #{order.order_no} · {receivedStatus(locale)}</p>}{error&&<p role="alert">{error}</p>}{review&&<p role="alert">{ui(locale,'message_22')} {money(review.subtotal_tzs)}</p>}<button class="primary" disabled={pending||cart.length===0||!navigator.onLine} onClick={()=>void send(Boolean(review))}>{pending?(ui(locale,'message_23')):review?(ui(locale,'message_24')):(ui(locale,'message_25'))}</button></>;
}
