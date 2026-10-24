export interface Modifier {id:string;name_en:string;name_sw?:string;price_delta_tzs:number;is_available:boolean}
export interface ModifierGroup {id:string;name_en:string;name_sw?:string;min_select:number;max_select:number;modifiers:Modifier[]}
export interface MenuItem {id:string;name_en:string;name_sw?:string;description_en?:string;description_sw?:string;price_tzs:number;is_available:boolean;modifier_groups:ModifierGroup[];image_variants:{width:number;url:string}[]}
export interface Category {id:string;name_en:string;name_sw?:string;items:MenuItem[]}
export interface Menu {version:number;categories:Category[]}
export const money=(amount:number)=>`TZS ${amount.toLocaleString('en-TZ')}`;
