import {useEffect,useRef,useState} from 'preact/hooks';
import {money} from '../../../packages/shared/src/index.ts';
import {billText,billError,type BillMessage} from './bill-i18n.ts';
import type {BillProps,GuestBill,Split,BillShare,ShareItem} from './bill-types.ts';
import './bill.css';

export function BillDialog({entry,locale,online,refreshSeq,close}:BillProps){
 const t=billText(locale),dialog=useRef<HTMLDialogElement>(null),lifetime=useRef(new AbortController()),requestNumber=useRef(0),mutating=useRef(false);
 const [bill,setBill]=useState<GuestBill>(),[error,setError]=useState<BillMessage>(),[busy,setBusy]=useState(false),[mode,setMode]=useState<'EQUAL'|'ITEMIZED'>('EQUAL'),[payers,setPayers]=useState('2'),[selected,setSelected]=useState(''),[unlocking,setUnlocking]=useState(false),[now,setNow]=useState(Date.now());
 const base=`/v1/sessions/${entry.session.id}`,headers={authorization:`Bearer ${entry.session_token}`};
 async function load(){
  const n=++requestNumber.current,r=await fetch(base+'/bill',{headers,credentials:'omit',cache:'no-store',signal:lifetime.current.signal});const data=await r.json();if(!r.ok)throw Error(data.code);
  if(n===requestNumber.current&&!lifetime.current.signal.aborted)setBill(data.bill);
 }
 useEffect(()=>{dialog.current?.showModal();return()=>{lifetime.current.abort();dialog.current?.close();};},[]);
 useEffect(()=>{void load().catch(e=>{if(!lifetime.current.signal.aborted)setError(billError(e.message));});},[refreshSeq]);
 useEffect(()=>{const timer=setInterval(()=>{setNow(Date.now());},1000),poll=setInterval(()=>{if(navigator.onLine)void load().catch(()=>{});},5000);return()=>{clearInterval(timer);clearInterval(poll);};},[]);
 const split=bill?.split,remaining=split?.lock_expires_at?Math.max(0,Math.ceil((new Date(split.lock_expires_at).getTime()-now)/1000)):0;
 useEffect(()=>{if(split){setMode(split.mode);setPayers(String(split.payer_count));}},[split?.id]);
 const deadlineReached=split?.status==='LOCKED'&&remaining===0;
 useEffect(()=>{if(deadlineReached)void load().catch(()=>{});},[deadlineReached,split?.id,split?.revision]);
 async function mutate(path:string,method='POST',payload?:unknown){
  if(mutating.current)return;if(!online){setError('Reconnect to change the bill split.');return;}
  mutating.current=true;setBusy(true);setError(undefined);
  try{const r=await fetch(path,{method,headers:{...headers,...(payload===undefined?{}:{'Content-Type':'application/json'})},credentials:'omit',signal:lifetime.current.signal,...(payload===undefined?{}:{body:JSON.stringify(payload)})});const data=await r.json();if(!r.ok)throw Error(data.code);await load();}
  catch(e){if(!lifetime.current.signal.aborted){setError(billError((e as Error).message));await load().catch(()=>{});}}
  finally{mutating.current=false;if(!lifetime.current.signal.aborted)setBusy(false);}
 }
 function create(){const n=Number(payers);if(!Number.isInteger(n)||n<1||n>50){setError('Enter between 1 and 50 payers.');return;}void mutate(base+'/splits','POST',{mode,payer_count:n});}
 const ownShares=split?.shares.filter(s=>s.participant_id===entry.participant.id)??[],share=ownShares.find(s=>s.id===selected)??ownShares[0];
 return <dialog ref={dialog} class="bill-dialog" aria-labelledby="bill-title" onCancel={close}>
  <div class="sheet-head"><h2 id="bill-title">{t('Table bill')}</h2><button aria-label={t('Close bill')} onClick={close}>×</button></div>
  {error&&<p role="alert">{t(error)}</p>}
  {!bill?<><p role="status">{t('Loading bill…')}</p><button class="bill-secondary" onClick={()=>void load().then(()=>setError(undefined)).catch(e=>setError(billError(e.message)))}>{t('Refresh bill')}</button></>:<>
   <div class="bill-total"><span>{t('Total')}</span><strong data-testid="bill-total">{money(bill.total_tzs)}</strong></div>
   <ul class="bill-lines">{bill.items.map(item=><li key={item.id}><div><strong>{item.quantity} × {item.name}</strong><span>{money(item.line_total_tzs)}</span></div>{item.modifiers.map((m,i)=><p key={i}>{m.name} · {money(m.price_delta_tzs)}</p>)}{item.note&&<p>{item.note}</p>}</li>)}</ul>
   <dl class="bill-totals"><div><dt>{t('Subtotal')}</dt><dd>{money(bill.subtotal_tzs)}</dd></div><div><dt>{t('Service charge')}</dt><dd>{money(bill.service_charge_tzs)}</dd></div><div><dt>{t(bill.prices_include_vat?'Tax included':'Tax')}</dt><dd>{money(bill.tax_tzs)}</dd></div><div><dt>{t('Paid')}</dt><dd>{money(bill.paid_tzs)}</dd></div><div><dt>{t('Balance')}</dt><dd>{money(bill.balance_tzs)}</dd></div></dl>
   {bill.pending_balance_tzs>0&&<aside class="bill-notice" data-testid="pending-balance"><strong>{t('New orders pending')}: {money(bill.pending_balance_tzs)}</strong><p>{t('New orders are separate from these locked shares.')}</p></aside>}
   {(!split||split.status==='OPEN')&&bill.balance_tzs>0&&<section class="bill-split-setup">
    <div class="bill-modes" aria-label={t('Choose your share')}>{(['EQUAL','ITEMIZED'] as const).map(value=><button aria-pressed={mode===value} onClick={()=>setMode(value)}>{t(value==='EQUAL'?'Equal':'My items')}</button>)}</div>
    <label>{t('Number of payers')}<input type="number" inputMode="numeric" min="1" max="50" step="1" value={payers} onInput={e=>setPayers(e.currentTarget.value)}/></label>
    <button class="bill-secondary" disabled={busy||!online} onClick={create}>{t(split?'Recalculate split':'Create split')}</button>
   </section>}
   {split&&<section class="bill-split" aria-label={t('Choose your share')}><p class="bill-state" role="status">{t(split.status==='LOCKED'?'Split locked':'Draft split')}</p>
    {split.requires_recalculation&&<p class="bill-notice">{t('The bill changed. Recalculate the split before confirming.')}</p>}
    {split.status==='LOCKED'&&<p class="bill-countdown">{remaining>0?`${t('Time remaining')}: ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:t('Checking lock…')}</p>}
    <div class="bill-shares">{split.shares.map(s=><article class={s.participant_id===entry.participant.id?'bill-share own':'bill-share'} key={s.id} data-testid="split-share"><div><strong>{s.participant_id===entry.participant.id?t('Your share'):s.participant_id?s.label:`${t('Guest')} ${s.slot_index+1}`}</strong><span data-testid="share-amount">{money(s.amount_tzs)}</span></div><p>{t(s.amount_tzs===0&&s.status==='PAID'?'No payment required':({UNPAID:'Unpaid',PENDING:'Payment pending',PAID:'Paid',VOID:'Void'} as const)[s.status])}</p>{!s.participant_id&&s.status!=='VOID'&&<button class="bill-secondary" disabled={busy||!online} aria-label={`${t('Claim share')} ${s.slot_index+1}`} onClick={()=>void mutate(`/v1/shares/${s.id}/claim`)}>{t('Claim share')}</button>}</article>)}</div>
    {split.mode==='ITEMIZED'&&<p class="bill-unassigned" data-testid="unassigned">{t('Unassigned')}: {money(split.unassigned_tzs)}</p>}
    {split.mode==='ITEMIZED'&&split.status==='OPEN'&&share&&!split.requires_recalculation&&<>
     {ownShares.length>1&&<label>{t('Choose your share')}<select value={share.id} onChange={e=>setSelected(e.currentTarget.value)}>{ownShares.map(s=><option value={s.id}>{t('Your share')} {s.slot_index+1}</option>)}</select></label>}
     <ItemClaims key={share.id} bill={bill} split={split} share={share} locale={locale} disabled={busy||!online} save={items=>void mutate(`/v1/splits/${split.id}/allocations`,'PUT',{mode:'ITEMIZED',shares:[{share_id:share.id,participant_id:entry.participant.id,items}]})}/>
    </>}
    {split.status==='OPEN'&&<button class="primary" disabled={busy||!online||split.requires_recalculation||split.unassigned_tzs!==0||split.unassigned_items_tzs!==0} onClick={()=>void mutate(`/v1/splits/${split.id}/lock`,'POST',{bill_version:bill.version,split_revision:split.revision})}>{t('Confirm split')}</button>}
    {split.status==='LOCKED'&&<><p class="bill-notice">{t('Payments are not configured. Ask your waiter to arrange payment.')}</p>{unlocking?<div class="bill-unlock"><p>{t('Unlocking cancels this split. Paid shares are kept and cannot be charged again.')}</p><button class="bill-secondary" onClick={()=>setUnlocking(false)}>{t('Cancel')}</button><button class="bill-secondary" disabled={busy||!online} onClick={()=>{setUnlocking(false);void mutate(`/v1/splits/${split.id}/unlock`);}}>{t('Unlock and recalculate')}</button></div>:<button class="bill-secondary" disabled={busy||!online} onClick={()=>setUnlocking(true)}>{t('Unlock split')}</button>}</>}
   </section>}
   {bill.balance_tzs===0&&<p role="status">{t('No outstanding balance')}</p>}
   {!online&&<p class="bill-notice">{t('Reconnect to change the bill split.')}</p>}
  </>}
 </dialog>;
}

function ItemClaims({bill,split,share,locale,disabled,save}:{bill:GuestBill;split:Split;share:BillShare;locale:'en'|'sw';disabled:boolean;save:(items:ShareItem[])=>void}){
 const t=billText(locale),[amounts,setAmounts]=useState<Record<string,string>>({}),[error,setError]=useState(false),fingerprint=JSON.stringify(share.items);
 useEffect(()=>{setAmounts(Object.fromEntries(share.items.map(i=>[i.order_item_id,String(i.amount_tzs)])));},[fingerprint]);
 const rows=bill.items.map(item=>{const other=split.shares.filter(s=>s.id!==share.id).flatMap(s=>s.items).filter(i=>i.order_item_id===item.id).reduce((sum,i)=>sum+i.amount_tzs,0);return {...item,max:Math.max(0,(item.available_tzs??item.line_total_tzs)-other)};});
 function submit(e:SubmitEvent){e.preventDefault();const items:ShareItem[]=[];for(const item of rows){const n=Number(amounts[item.id]??0);if(!Number.isSafeInteger(n)||n<0||n>item.max){setError(true);return;}if(n>0)items.push({order_item_id:item.id,amount_tzs:n});}setError(false);save(items);}
 return <form class="bill-claims" onSubmit={e=>submit(e as SubmitEvent)}><p>{t('Item amounts are before service and tax. Enter whole TZS; you can share an item by entering part of its price.')}</p>{rows.filter(item=>item.max>0||Number(amounts[item.id])>0).map(item=><label key={item.id}><span>{item.name} · {money(item.max)}</span><input type="number" inputMode="numeric" min="0" max={item.max} step="1" disabled={disabled} aria-label={`${t('Amount for')} ${item.name}`} value={amounts[item.id]??'0'} onInput={e=>setAmounts({...amounts,[item.id]:e.currentTarget.value})}/></label>)}{error&&<p role="alert">{t('Please enter a whole TZS amount within the available balance.')}</p>}<button class="bill-secondary" disabled={disabled}>{t('Save my items')}</button></form>;
}
