import {describe,it,expect} from 'vitest';
import {addLine,editLine,cartTotal,saveCart,restoreCart,orderBody} from '../packages/shared/src/cart.ts';
const item={id:'chips',name_en:'Chips Mayai [DEMO]',price_tzs:6000,is_available:true,modifier_groups:[],image_variants:[]};
const storage=()=>{const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};};
describe('US-203 cart review',()=>{
 it('Edit quantity: 2 x Chips Mayai becomes 3 with updated line and cart totals',()=>{let cart=addLine([],item,[],2,'');expect(cartTotal(cart)).toBe(12000);cart=editLine(cart,cart[0].id,{quantity:3});expect(cartTotal(cart)).toBe(18000);expect(cart[0].line_total_tzs).toBe(18000);});
 it('Add kitchen note: No onions is saved and sent with the order',()=>{const cart=addLine([],item,[],1,'No onions');expect(orderBody(cart,'client').items[0].note).toBe('No onions');});
 it('Cart survives page reload only for the same session',()=>{const s=storage(),cart=addLine([],item,[],1,'');saveCart(s,'session-a',cart);expect(restoreCart(s,'session-a')).toEqual(cart);expect(restoreCart(s,'session-b')).toEqual([]);});
 it('Corrupted local storage cannot create malformed or fractional order lines',()=>{const s=storage();s.setItem('cloud-menu:cart:x','oops');expect(restoreCart(s,'x')).toEqual([]);expect(()=>editLine(addLine([],item,[],1,''),'missing',{quantity:2})).toThrow();expect(()=>addLine([],item,[],0,'')).toThrow();});
});
