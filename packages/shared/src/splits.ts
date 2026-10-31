import {tzs,PricingError} from './pricing.ts';
const safe=(value:bigint)=>{const n=Number(value);return tzs(n);};
const bp=(value:number)=>{if(!Number.isInteger(value)||value<0||value>10000)throw new PricingError('VALIDATION_ERROR','Invalid configured rate');return BigInt(value);};
const rounded=(numerator:bigint,denominator:bigint)=>(numerator+denominator/2n)/denominator;
export function billTotals(subtotal:number,serviceBp:number,taxBp:number,pricesIncludeTax:boolean){
 const base=BigInt(tzs(subtotal)),service=rounded(base*bp(serviceBp),10000n),taxable=base+service,rate=bp(taxBp),tax=rounded(taxable*rate,pricesIncludeTax?10000n+rate:10000n);
 return {subtotal_tzs:subtotal,service_charge_tzs:safe(service),tax_tzs:safe(tax),total_tzs:safe(taxable+(pricesIncludeTax?0n:tax))};
}
