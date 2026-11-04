import {useEffect,useState} from 'preact/hooks';
import {request} from '../../owner/src/api.ts';

type RecordData=Record<string,any>;
type Props={token:string;locale:'en'|'sw';role:string;from?:string;until?:string};
const stages=['NEW','ACCEPTED','PREPARING','READY','SERVED'];
export function ServiceDesk({token,locale,role,from,until}:Props){
 const sw=locale==='sw',text=(en:string,kiswahili:string)=>sw?kiswahili:en;
 const labels:Record<string,string>={NEW:text('Received','Imepokelewa'),ACCEPTED:text('Accepted','Imekubaliwa'),PREPARING:text('Preparing','Inaandaliwa'),READY:text('Ready','Tayari'),SERVED:text('Served','Imehudumiwa'),REJECTED:text('Rejected','Imekataliwa'),CANCELLED:text('Cancelled','Imefutwa')};
 const [orders,setOrders]=useState<RecordData[]>([]),[calls,setCalls]=useState<RecordData[]>([]),[filter,setFilter]=useState(''),[error,setError]=useState(''),[version,refresh]=useState(0),[busy,setBusy]=useState(false);
 const [page,setPage]=useState(1);
 const floor=['OWNER','MANAGER','WAITER'].includes(role);
 useEffect(()=>{
  let current=true,running=false;
  async function load(){if(running)return;running=true;try{
   const params=new URLSearchParams({page:String(page)});if(filter)params.set('item_status',filter);if(from)params.set('from',from);if(until)params.set('until',until);
   const [tickets,inbox]=await Promise.all([request(token,'/v1/staff/orders?'+params),floor?request(token,'/v1/staff/waiter-calls'):Promise.resolve({calls:[]})]);
   if(current){setOrders(tickets.orders);setCalls(inbox.calls);setError('');}
  }catch{if(current)setError(text('Could not refresh service desk.','Imeshindwa kusasisha huduma.'));}finally{running=false;}}
  void load();const timer=setInterval(()=>void load(),5000);return()=>{current=false;clearInterval(timer);};
 },[token,role,from,until,version,page,filter]);
 async function change(path:string,method:string,body?:unknown){setBusy(true);try{await request(token,path,method,body);refresh(n=>n+1);}catch{setError(text('Update failed. Refresh and try again.','Imeshindwa kuhifadhi. Onyesha upya.'));}finally{setBusy(false);}}
 const date=(value:string)=>value?new Date(value).toLocaleString(sw?'sw-TZ':'en-TZ',{timeZone:'Africa/Dar_es_Salaam'}):'—';
 const rows=orders.flatMap(order=>order.items.filter((item:RecordData)=>!filter||item.status===filter).map((item:RecordData)=>({order,item})));
 return <><button onClick={()=>refresh(n=>n+1)}>{text('Refresh orders','Onyesha maagizo upya')}</button>{error&&<p role="alert">{error}</p>}
 {floor&&<section><h2>{text('Waiter requests','Maombi ya mhudumu')}</h2>{!calls.length&&<p>{text('No open requests.','Hakuna maombi.')}</p>}{calls.map(call=><article class="cm-card" key={call.id}><strong>{call.table_label} · {({HELP:text('Need help','Msaada'),BILL:text('Bill please','Bili'),CLEAN_TABLE:text('Clean table','Safisha meza'),WATER:text('Water','Maji')} as Record<string,string>)[call.reason]}</strong><p>{call.message}</p><small>{date(call.created_at)}</small>{call.status==='OPEN'?<button disabled={busy} onClick={()=>void change('/v1/staff/waiter-calls/'+call.id+'/acknowledge','POST')}>{text('On my way','Ninakuja')}</button>:<button disabled={busy} onClick={()=>void change('/v1/staff/waiter-calls/'+call.id+'/resolve','POST')}>{text('Mark resolved','Maliza ombi')}</button>}</article>)}</section>}
 <label>{text('Filter by status','Chuja kwa hali')}<select value={filter} onChange={e=>{setFilter(e.currentTarget.value);setPage(1);}}><option value="">{text('All statuses','Hali zote')}</option>{Object.entries(labels).map(([id,label])=><option value={id}>{label}</option>)}</select></label>
 <div class="ops-table-scroll"><table><thead><tr>{[text('Order / table','Agizo / meza'),text('Order type','Aina ya agizo'),text('Item / station','Bidhaa / kituo'),text('Customer message','Ujumbe wa mteja'),text('Status','Hali'),text('Received','Imepokelewa'),text('Served','Imehudumiwa'),text('Handled by','Mhudumu'),text('Next step','Hatua inayofuata')].map(label=><th>{label}</th>)}</tr></thead>
 <tbody>{rows.map(({order,item})=>{const next=stages[stages.indexOf(item.status)+1],can=stages.includes(item.status)&&next&&(role==='WAITER'?next==='SERVED':floor||next!=='SERVED');return <tr key={item.id}><td>#{order.order_no} · {order.table_label}</td><td>{text('Dine-in','Mezani')}</td><td>{item.quantity} × {item.name_snapshot}<br/>{item.station}</td><td class="ops-ticket-note">{[order.note,item.note].filter(Boolean).join(' · ')||'—'}{order.feedback&&<p>{text('Waiter rating','Alama za mhudumu')}: {order.feedback.waiter_rating}/5 · {order.feedback.comment}</p>}</td><td>{labels[item.status]}</td><td>{date(order.created_at)}</td><td>{date(item.served_at)}</td><td>{item.handled_name||'—'}</td><td>{can&&<button disabled={busy} onClick={()=>void change('/v1/staff/orders/'+order.id+'/items/'+item.id+'/status','PATCH',{status:next})}>{labels[next]}</button>}</td></tr>;})}</tbody></table></div><div><button disabled={page===1} onClick={()=>setPage(page-1)}>{text('Previous','Iliyopita')}</button> {page} <button disabled={orders.length<200} onClick={()=>setPage(page+1)}>{text('Next','Inayofuata')}</button></div>{!rows.length&&<p>{text('No matching orders.','Hakuna maagizo yanayolingana.')}</p>}</>;
}
