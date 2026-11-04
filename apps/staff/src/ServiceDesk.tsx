import {useEffect,useState} from 'preact/hooks';
import {money} from '../../../packages/shared/src/index.ts';
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
 const tickets=orders.flatMap(order=>['KITCHEN','BAR'].map(station=>({order,station,items:order.items.filter((i:RecordData)=>i.station===station&&(!filter||i.status===filter)) as RecordData[]})).filter(t=>t.items.length));
 return <><button onClick={()=>refresh(n=>n+1)}>{text('Refresh orders','Onyesha maagizo upya')}</button>{error&&<p role="alert">{error}</p>}
 {floor&&<section><h2>{text('Waiter requests','Maombi ya mhudumu')}</h2>{!calls.length&&<p>{text('No open requests.','Hakuna maombi.')}</p>}{calls.map(call=><article class="cm-card" key={call.id}><strong>{call.table_label} · {({HELP:text('Need help','Msaada'),BILL:text('Bill please','Bili'),CLEAN_TABLE:text('Clean table','Safisha meza'),WATER:text('Water','Maji')} as Record<string,string>)[call.reason]}</strong><p>{call.message}</p><small>{date(call.created_at)}</small>{call.status==='OPEN'?<button disabled={busy} onClick={()=>void change('/v1/staff/waiter-calls/'+call.id+'/acknowledge','POST')}>{text('On my way','Ninakuja')}</button>:<button disabled={busy} onClick={()=>void change('/v1/staff/waiter-calls/'+call.id+'/resolve','POST')}>{text('Mark resolved','Maliza ombi')}</button>}</article>)}</section>}
 <label>{text('Filter by status','Chuja kwa hali')}<select value={filter} onChange={e=>{setFilter(e.currentTarget.value);setPage(1);}}><option value="">{text('All statuses','Hali zote')}</option>{Object.entries(labels).map(([id,label])=><option value={id}>{label}</option>)}</select></label>
 <div class="ops-table-scroll"><table><thead><tr>{[text('Order / table','Agizo / meza'),text('Order type','Aina ya agizo'),text('Item / station','Bidhaa / kituo'),text('Customer message','Ujumbe wa mteja'),text('Status','Hali'),text('Received','Imepokelewa'),text('Served','Imehudumiwa'),text('Handled by','Mhudumu'),text('Next step','Hatua inayofuata')].map(label=><th>{label}</th>)}</tr></thead>
 <tbody>{tickets.map(({order,station,items})=><tr key={order.id+station}><td><details><summary>#{order.order_no} · {order.table_label}</summary><strong>{text('Order details','Maelezo ya agizo')}</strong><p>{date(order.created_at)} · {station}</p>{items.map(i=><p>{i.quantity} × {i.name_snapshot} · {labels[i.status]} {i.note}</p>)}{order.note&&<p>{order.note}</p>}{floor&&order.cash_shares?.map((s:RecordData)=><button disabled={busy} onClick={()=>{if(confirm(text('Confirm cash received: ','Thibitisha pesa taslimu: ')+money(s.amount_tzs)+' · '+s.label))void change('/v1/staff/shares/'+s.id+'/cash','POST');}}>{text('Record cash','Rekodi taslimu')} · {s.label} · {money(s.amount_tzs)}</button>)}</details></td><td>{text('Dine-in','Mezani')}</td><td><strong>{station}</strong>{items.map(i=><p>{i.quantity} × {i.name_snapshot}</p>)}</td><td class="ops-ticket-note">{[order.note,...items.map(i=>i.note)].filter(Boolean).join(' · ')||'—'}{order.feedback&&<p>{order.feedback.waiter_rating} ★ · {order.feedback.comment}</p>}</td><td>{items.map(i=><p>{labels[i.status]}</p>)}</td><td>{date(order.created_at)}</td><td>{items.map(i=><p>{date(i.served_at)}</p>)}</td><td>{items.map(i=><p>{i.handled_name||'—'}</p>)}</td><td>{items.map(item=>{const next=stages[stages.indexOf(item.status)+1],can=stages.includes(item.status)&&next&&(role==='WAITER'?next==='SERVED':floor||next!=='SERVED');return can&&<button disabled={busy} onClick={()=>void change('/v1/staff/orders/'+order.id+'/items/'+item.id+'/status','PATCH',{status:next})}>{item.name_snapshot}: {labels[next]}</button>;})}</td></tr>)}</tbody></table></div><div><button disabled={page===1} onClick={()=>setPage(page-1)}>{text('Previous','Iliyopita')}</button> {page} <button disabled={orders.length<200} onClick={()=>setPage(page+1)}>{text('Next','Inayofuata')}</button></div>{!tickets.length&&<p>{text('No matching orders.','Hakuna maagizo yanayolingana.')}</p>}</>;
}
