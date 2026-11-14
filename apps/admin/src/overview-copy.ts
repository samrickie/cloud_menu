import {platformText,type Locale} from '../../../packages/ui/src/platform-copy.ts';
const sw:Record<string,string>={
 'View venues':'Ona kumbi',
 'Venue status and plan counts are current; activity follows the selected period. Times are EAT.':'Hali na mipango ya kumbi ni ya sasa; shughuli zinafuata kipindi kilichochaguliwa. Saa ni za Afrika Mashariki.',
 'Of registered venues':'Ya kumbi zilizosajiliwa','Active access; payment not implied':'Ruhusa hai; si uthibitisho wa malipo','Orders per registered venue':'Maagizo kwa ukumbi uliosajiliwa','Average per order':'Wastani kwa agizo','Successful recorded payments':'Malipo yaliyorekodiwa kwa mafanikio',
 'Venues on trial':'Kumbi za majaribio','Review trial venues and help owners choose a plan.':'Kagua kumbi za majaribio na wasaidie wamiliki kuchagua mpango.',
 'No recorded collections':'Hakuna malipo yaliyorekodiwa','Recorded collections':'Malipo yaliyorekodiwa','Recorded payments may differ from completed-order revenue.':'Malipo yaliyorekodiwa yanaweza kutofautiana na mapato ya maagizo yaliyokamilika.',
 'Peak ordering hour':'Saa yenye maagizo mengi','No orders in this period':'Hakuna maagizo katika kipindi hiki','Insights appear as venues begin taking orders.':'Taarifa zitaonekana kumbi zikianza kupokea maagizo.',
 'Venue status':'Hali ya kumbi','Where each registered venue stands':'Hali ya kila ukumbi uliosajiliwa','Other access states':'Hali nyingine za ruhusa','Venue lifecycle':'Hatua za kumbi','Current snapshot, not historical conversion':'Hali ya sasa, si historia ya mabadiliko',
 'Growth':'Ukuaji','Last 12 calendar months; other totals remain all time.':'Miezi 12 ya kalenda iliyopita; jumla nyingine ni za muda wote.','Real registrations and orders in the selected period.':'Usajili na maagizo halisi katika kipindi kilichochaguliwa.',
 'Ordered vs collected sales':'Mauzo yaliyoagizwa na yaliyolipwa','Order value and successful recorded payments':'Thamani ya maagizo na malipo yaliyorekodiwa kwa mafanikio','Subscription model':'Mpango wa usajili','How venues have chosen to pay':'Jinsi kumbi zilivyochagua kulipa',
 'Oldest trial registrations to follow up':'Fuatilia usajili wa majaribio wa zamani kwanza','View all trials':'Ona majaribio yote','No venues currently on trial.':'Hakuna kumbi za majaribio kwa sasa.','Venue':'Ukumbi','Status':'Hali','Next step':'Hatua inayofuata','Review venue':'Kagua ukumbi','Chart data':'Data ya chati','Period':'Kipindi'
};
export const overviewText=(locale:Locale)=>(key:string)=>locale==='sw'?(sw[key]??platformText(locale)(key)):key;
