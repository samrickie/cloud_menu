import type {MenuItem} from './index.ts';
import {priceLine,tzs} from './pricing.ts';
export interface CartLine {id:string;item:MenuItem;selected:string[];quantity:number;note:string;line_total_tzs:number}
export function addLine(cart:CartLine[],item:MenuItem,selected:string[],quantity:number,note:string):CartLine[]{return [...cart,{id:crypto.randomUUID(),item,selected,quantity,note:note.slice(0,500),line_total_tzs:priceLine(item,selected,quantity)}];}
export function editLine(cart:CartLine[],id:string,change:Partial<Pick<CartLine,'quantity'|'note'|'selected'>>){if(!cart.some(l=>l.id===id))throw Error('Cart line not found');return cart.map(l=>{if(l.id!==id)return l;const n={...l,...change};return {...n,note:n.note.slice(0,500),line_total_tzs:priceLine(n.item,n.selected,n.quantity)};});}
export const cartTotal=(cart:CartLine[])=>tzs(cart.reduce((n,l)=>n+l.line_total_tzs,0));
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
export function saveCart(storage:Storage,session:string,cart:CartLine[]){storage.setItem('cloud-menu:cart:'+session,JSON.stringify(cart));}
export function restoreCart(storage:Storage,session:string):CartLine[]{try{const value=JSON.parse(storage.getItem('cloud-menu:cart:'+session)??'[]');if(!Array.isArray(value)||value.length>99)return [];return value.map(l=>({...l,line_total_tzs:priceLine(l.item,l.selected,l.quantity)}));}catch{return [];}}
export function orderBody(cart:CartLine[],client_order_id:string){return {client_order_id,items:cart.map(l=>({item_id:l.item.id,quantity:l.quantity,modifiers:l.selected.map(modifier_id=>({modifier_id})),note:l.note}))};}
