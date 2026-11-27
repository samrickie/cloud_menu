export interface BillItem {id:string;name:string;quantity:number;unit_price_tzs:number;modifiers_total_tzs:number;line_total_tzs:number;available_tzs:number;note?:string;modifiers:{name:string;price_delta_tzs:number}[]}
export interface ShareItem {order_item_id:string;amount_tzs:number}
export interface BillShare {id:string;participant_id:string|null;label:string;slot_index:number;amount_tzs:number;status:'UNPAID'|'PENDING'|'PAID'|'VOID';items:ShareItem[]}
export interface Split {id:string;mode:'EQUAL'|'ITEMIZED';status:'OPEN'|'LOCKED';revision:number;bill_version:number;payer_count:number;total_tzs:number;unassigned_tzs:number;unassigned_items_tzs:number;lock_expires_at:string|null;requires_recalculation:boolean;shares:BillShare[]}
export interface GuestBill {id:string;version:number;subtotal_tzs:number;service_charge_tzs:number;tax_tzs:number;total_tzs:number;paid_tzs:number;balance_tzs:number;pending_balance_tzs:number;prices_include_vat:boolean;items:BillItem[];split:Split|null}
export interface BillProps {entry:any;locale:'en'|'sw';online:boolean;refreshSeq:number;close:()=>void}
