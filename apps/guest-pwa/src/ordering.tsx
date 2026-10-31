import {local} from './storage.ts';
import {ui,selectionError} from './i18n.ts';
import {useEffect,useRef,useState} from 'preact/hooks';
import {MenuView} from './menu-view.tsx';
import {addLine,editLine,restoreCart,saveCart,cartTotal,type CartLine} from '../../../packages/shared/src/cart.ts';
import {money} from '../../../packages/shared/src/index.ts';
import {SubmitOrder} from './submit-order.tsx';
export function Ordering({entry,locale,refreshSeq=0}:{entry:any;locale:'en'|'sw';refreshSeq?:number}){
 const dialog=useRef<HTMLDialogElement>(null),cartButton=useRef<HTMLButtonElement>(null);
 const [cart,setCart]=useState<CartLine[]>(()=>restoreCart(local,entry.session.id)),[open,setOpen]=useState(false),[error,setError]=useState(''),[recent,setRecent]=useState<any>();
 useEffect(()=>{const button=cartButton.current;if(!button)return;const measure=()=>document.documentElement.style.setProperty('--guest-cart-height',button.getBoundingClientRect().height+'px');measure();const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);observer?.observe(button);window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);document.documentElement.style.removeProperty('--guest-cart-height');};},[]);
 useEffect(()=>{if(open)dialog.current?.showModal();return()=>dialog.current?.close();},[open]);
 useEffect(()=>{try{saveCart(local,entry.session.id,cart);}catch{setError(ui(locale,'message_16'));}},[cart]);
 function persist(next:CartLine[]){try{saveCart(local,entry.session.id,next);setCart(next);}catch{setError(ui(locale,'message_16'));}}
 function update(id:string,change:Partial<Pick<CartLine,'quantity'|'note'>>){try{persist(editLine(cart,id,change));setError('');}catch(e){setError(selectionError(locale,(e as Error).message));}}
 return <>{recent&&<p class="order-confirmation" role="status">{ui(locale,'message_21')} #{recent.order_no}</p>}<MenuView entry={entry} locale={locale} refreshSeq={refreshSeq} onAdd={(i,s,q,n)=>persist(addLine(cart,i,s,q,n))}/>{open&&<dialog ref={dialog} onCancel={()=>setOpen(false)} class="cart-panel" aria-label={ui(locale,'message_17')}><div class="sheet-head"><h2>{ui(locale,'message_17')}</h2><button onClick={()=>setOpen(false)}>{ui(locale,'message_1')}</button></div>{cart.length===0&&<p>{ui(locale,'message_18')}</p>}{cart.map(l=><article><h3>{locale==='sw'&&l.item.name_sw?l.item.name_sw:l.item.name_en}</h3><p>{money(l.line_total_tzs)}</p><label>{ui(locale,'message_2')}<input type="number" min="1" max="99" value={l.quantity} onInput={e=>update(l.id,{quantity:Number(e.currentTarget.value)})}/></label><label>{ui(locale,'message_3')}<input maxLength={500} value={l.note} onInput={e=>update(l.id,{note:e.currentTarget.value})}/></label><button onClick={()=>persist(cart.filter(x=>x.id!==l.id))}>{ui(locale,'message_19')}</button></article>)}{error&&<p role="alert">{error}</p>}<p><strong>{money(cartTotal(cart))}</strong></p><SubmitOrder entry={entry} cart={cart} locale={locale} done={order=>{persist([]);setRecent(order);setOpen(false);}}/></dialog>}<button ref={cartButton} class="cart-bar" onClick={()=>setOpen(!open)}>{ui(locale,'message_20')} ({cart.reduce((s,l)=>s+l.quantity,0)}) · {money(cartTotal(cart))}</button></>;
}
