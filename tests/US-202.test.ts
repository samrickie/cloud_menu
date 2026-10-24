import {describe,it,expect} from 'vitest';
import {priceLine,toggleModifier} from '../packages/shared/src/pricing.ts';
import type {MenuItem} from '../packages/shared/src/index.ts';
export const vodka:MenuItem={id:'vodka',name_en:'Vodka [DEMO]',price_tzs:8000,is_available:true,image_variants:[],modifier_groups:[{id:'mixer',name_en:'Mixer',min_select:1,max_select:1,modifiers:[{id:'soda',name_en:'Soda',price_delta_tzs:0,is_available:true}]},{id:'extras',name_en:'Extras',min_select:0,max_select:2,modifiers:[{id:'double',name_en:'Double shot',price_delta_tzs:3000,is_available:true},{id:'lime',name_en:'Lime',price_delta_tzs:0,is_available:true},{id:'ice',name_en:'Ice',price_delta_tzs:0,is_available:true}]}]};
describe('US-202 item modifiers',()=>{
 it('Required modifier group must be chosen: Add to cart is blocked with Choose a mixer',()=>{expect(()=>priceLine(vodka,[],1)).toThrow(/Choose.*Mixer/i);});
 it('Modifier price adjusts item price from 8000 to 11000 TZS before quantity',()=>{expect(priceLine(vodka,['soda','double'],1)).toBe(11000);expect(priceLine(vodka,['soda','double'],2)).toBe(22000);});
 it('Max selections enforced: third extra is rejected with a message',()=>{expect(()=>toggleModifier(vodka,['soda','double','lime'],'ice')).toThrow(/at most 2/);});
 it('Unknown, duplicate, sold-out and fractional quantities are rejected',()=>{expect(()=>priceLine(vodka,['soda','foreign'],1)).toThrow();expect(()=>priceLine(vodka,['soda','soda'],1)).toThrow();expect(()=>priceLine({...vodka,is_available:false},['soda'],1)).toThrow();expect(()=>priceLine(vodka,['soda'],1.1)).toThrow();});
});
