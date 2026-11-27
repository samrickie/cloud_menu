import type {MenuItem} from './index.ts';
export class PricingError extends Error{constructor(public code:string,message:string){super(message);}}
export function tzs(value:number){if(!Number.isSafeInteger(value)||value<0)throw new PricingError('INVALID_MONEY','Money must be a non-negative safe integer in TZS');return value;}
export function priceLine(item:MenuItem,selected:string[],quantity:number){
 if(!item.is_available)throw new PricingError('ITEM_UNAVAILABLE','Item is sold out');
 if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new PricingError('VALIDATION_ERROR','Quantity must be between 1 and 99');
 if(new Set(selected).size!==selected.length)throw new PricingError('MODIFIER_RULE_VIOLATION','Duplicate modifiers');
 const modifiers=item.modifier_groups.flatMap(g=>g.modifiers);
 if(selected.some(id=>!modifiers.find(m=>m.id===id&&m.is_available)))throw new PricingError('MODIFIER_RULE_VIOLATION','Modifier is unavailable');
 for(const group of item.modifier_groups){const n=group.modifiers.filter(m=>selected.includes(m.id)).length;if(n<group.min_select)throw new PricingError('MODIFIER_RULE_VIOLATION',`Choose ${group.name_en}`);if(n>group.max_select)throw new PricingError('MODIFIER_RULE_VIOLATION',`Choose at most ${group.max_select} ${group.name_en}`);}
 return tzs((tzs(item.price_tzs)+modifiers.filter(m=>selected.includes(m.id)).reduce((sum,m)=>{if(!Number.isSafeInteger(m.price_delta_tzs))throw new PricingError('INVALID_MONEY','Invalid modifier price');return sum+m.price_delta_tzs;},0))*quantity);
}
export function toggleModifier(item:MenuItem,selected:string[],id:string){
 if(selected.includes(id))return selected.filter(m=>m!==id);const group=item.modifier_groups.find(g=>g.modifiers.some(m=>m.id===id));
 if(!group)throw new PricingError('MODIFIER_RULE_VIOLATION','Unknown modifier');
 if(group.modifiers.filter(m=>selected.includes(m.id)).length>=group.max_select)throw new PricingError('MODIFIER_RULE_VIOLATION',`Choose at most ${group.max_select} ${group.name_en}`);
 return [...selected,id];
}
