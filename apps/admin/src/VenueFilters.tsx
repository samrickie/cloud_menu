import type {Locale} from '../../../packages/ui/src/platform-copy.ts';
export function VenueFilters({locale,values,change}:{locale:Locale;values:Record<string,string>;change:(v:Record<string,string>)=>void}){
 const t=(en:string,sw:string)=>locale==='sw'?sw:en;
 const set=(key:string,value:string)=>{const next={...values};if(value)next[key]=value;else delete next[key];change(next);};
 const fields:[string,string,string,[string,string,string][]][]=[
 ['access','Access state','Hali ya ruhusa',[['TRIAL','Trial','Jaribio'],['ACTIVE','Active','Inatumika'],['EXPIRED','Expired','Imeisha'],['REVOKED','Revoked','Imefutwa'],['SUSPENDED','Suspended','Imesimamishwa'],['CLOSED','Closed','Imefungwa'],['UNMANAGED','Legacy access','Ruhusa ya awali']]],
 ['model','Billing model','Mpango wa malipo',[['MONTHLY','Monthly','Kila mwezi'],['SALES_BASED','Pay per service','Lipa kwa huduma'],['NONE','Not selected','Haijachaguliwa']]],
 ['sample','Venue data','Data ya ukumbi',[['no','Real venues','Kumbi halisi'],['yes','Sample data','Data ya mfano']]],
 ['expiry_days','Access deadline','Mwisho wa ruhusa',[['7','Within 7 days','Ndani ya siku 7'],['14','Within 14 days','Ndani ya siku 14'],['30','Within 30 days','Ndani ya siku 30']]],
 ['activity','Order activity','Shughuli za maagizo',[['orders','Has orders','Ina maagizo'],['none','No orders yet','Bado hakuna maagizo']]],
 ['sort','Sort by','Panga kwa',[['newest','Newest first','Mpya kwanza'],['oldest','Oldest first','Za zamani kwanza'],['name','Venue name','Jina la ukumbi'],['orders','Most orders','Maagizo mengi']]]
 ];
 return <fieldset class="platform-filter-grid"><legend>{t('Filter venues','Chuja kumbi')}</legend>{fields.map(([key,en,sw,options])=><label key={key}>{t(en,sw)}<select aria-label={t(en,sw)} value={values[key]??''} onChange={e=>set(key,e.currentTarget.value)}><option value="">{key==='sort'?t('Newest first','Mpya kwanza'):t('All','Zote')}</option>{options.map(([value,en,sw])=><option key={value} value={value}>{t(en,sw)}</option>)}</select></label>)}{[['registered_from','Registered from','Usajili kuanzia'],['registered_to','Registered through','Usajili hadi']].map(([key,en,sw])=><label key={key}>{t(en,sw)}<input type="date" value={values[key]??''} onInput={e=>set(key,e.currentTarget.value)}/></label>)}<button type="button" onClick={()=>change({})}>{t('Reset filters','Futa vichujio')}</button><small>{t('Search also matches owner email. Dates use UTC. Access deadlines exclude monthly grace days.','Utafutaji unajumuisha barua pepe ya mmiliki. Tarehe hutumia UTC. Mwisho wa ruhusa haujumuishi siku za nyongeza.')}</small></fieldset>;
}
