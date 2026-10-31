import {tzs,PricingError} from './pricing.ts';
const safe=(value:bigint)=>{const n=Number(value);return tzs(n);};
const bp=(value:number)=>{if(!Number.isInteger(value)||value<0||value>10000)throw new PricingError('VALIDATION_ERROR','Invalid configured rate');return BigInt(value);};
const rounded=(numerator:bigint,denominator:bigint)=>(numerator+denominator/2n)/denominator;
export function billTotals(subtotal:number,serviceBp:number,taxBp:number,pricesIncludeTax:boolean){
 const base=BigInt(tzs(subtotal)),service=rounded(base*bp(serviceBp),10000n),taxable=base+service,rate=bp(taxBp),tax=rounded(taxable*rate,pricesIncludeTax?10000n+rate:10000n);
 return {subtotal_tzs:subtotal,service_charge_tzs:safe(service),tax_tzs:safe(tax),total_tzs:safe(taxable+(pricesIncludeTax?0n:tax))};
}
export function equalSplit(total:number,payers:number):number[]{
 if(!Number.isInteger(payers)||payers<1||payers>50)throw new PricingError('VALIDATION_ERROR','Payer count must be between 1 and 50');
 const amount=BigInt(tzs(total)),n=BigInt(payers),base=amount/n,remainder=amount%n;
 return Array.from({length:payers},(_,i)=>safe(base+(BigInt(i)<remainder?1n:0n)));
}
export function itemizedSplit(subtotal:number,total:number,bases:number[]){
 const base=BigInt(tzs(subtotal)),gross=BigInt(tzs(total));if(gross<base||!bases.length||bases.length>50)throw new PricingError('INVALID_MONEY','Invalid itemized total');
 const weights=bases.map(n=>BigInt(tzs(n))),assigned=weights.reduce((a,b)=>a+b,0n);if(assigned>base)throw new PricingError('ALREADY_CLAIMED','Allocated items exceed subtotal');
 if(base===0n){if(gross!==0n)throw new PricingError('INVALID_MONEY','No item base for extras');return {amounts:bases.map(()=>0),unassigned_tzs:0,unassigned_items_tzs:0};}
 const extra=gross-base,parts=weights.map(w=>extra*w/base);
 if(assigned===base){const left=Number(extra-parts.reduce((a,b)=>a+b,0n));const order=weights.map((w,index)=>({index,remainder:extra*w%base})).sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);for(let i=0;i<left;i++)parts[order[i].index]++;}
 const amounts=weights.map((w,i)=>safe(w+parts[i]));return {amounts,unassigned_tzs:safe(gross-amounts.reduce((n,a)=>n+BigInt(a),0n)),unassigned_items_tzs:safe(base-assigned)};
}
