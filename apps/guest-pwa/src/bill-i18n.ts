import type {Locale} from './luxury-i18n.ts';
const messages={
 'View bill':'Angalia bili','Table bill':'Bili ya meza','Close bill':'Funga bili','Loading bill…':'Bili inapakia…','Refresh bill':'Sasisha bili',
 'Subtotal':'Jumla ndogo','Service charge':'Ada ya huduma','Tax included':'Kodi imejumuishwa','Tax':'Kodi','Total':'Jumla','Paid':'Imelipwa','Balance':'Salio',
 'Equal':'Sawa','My items':'Vitu vyangu','Number of payers':'Idadi ya walipaji','Create split':'Gawanya bili','Recalculate split':'Hesabu mgawanyo upya','Confirm split':'Thibitisha mgawanyo',
 'Your share':'Sehemu yako','Guest':'Mgeni','Unassigned':'Haijagawiwa','Claim share':'Chukua sehemu','Choose your share':'Chagua sehemu yako','Amount for':'Kiasi cha',
 'Save my items':'Hifadhi vitu vyangu','Item amounts are before service and tax. Enter whole TZS; you can share an item by entering part of its price.':'Kiasi cha vitu hakijajumuisha huduma na kodi. Weka TZS kamili; unaweza kugawana kitu kwa kuweka sehemu ya bei yake.',
 'Split locked':'Mgawanyo umefungwa','Draft split':'Rasimu ya mgawanyo','Unlock split':'Fungua mgawanyo','Time remaining':'Muda uliobaki','Checking lock…':'Inakagua mgawanyo…',
 'New orders pending':'Maagizo mapya yanasubiri','New orders are separate from these locked shares.':'Maagizo mapya yametenganishwa na sehemu hizi zilizofungwa.',
 'No payment required':'Hakuna malipo yanayohitajika','Payment pending':'Malipo yanasubiri','Unpaid':'Haijalipwa','Void':'Imebatilishwa',
 'Payments are not configured. Ask your waiter to arrange payment.':'Malipo hayajasanidiwa. Muombe mhudumu akusaidie kulipa.',
 'The bill changed. Recalculate the split before confirming.':'Bili imebadilika. Hesabu mgawanyo upya kabla ya kuthibitisha.',
 'Another guest changed this split. Review the latest amounts.':'Mgeni mwingine amebadilisha mgawanyo. Kagua kiasi cha sasa.',
 'That amount is already claimed. Review the latest allocations.':'Kiasi hicho tayari kimechukuliwa. Kagua mgawanyo wa sasa.',
 'Another guest has claimed this share.':'Mgeni mwingine amechukua sehemu hii.',
 'A payment is in progress. Wait for its final result.':'Malipo yanaendelea. Subiri matokeo yake ya mwisho.',
 'Assign all items before confirming the split.':'Gawa vitu vyote kabla ya kuthibitisha mgawanyo.',
 'Please enter a whole TZS amount within the available balance.':'Weka kiasi kamili cha TZS kisichozidi salio lililopo.',
 'Enter between 1 and 50 payers.':'Weka walipaji kati ya 1 na 50.',
 'Reconnect to change the bill split.':'Unganisha mtandao ili kubadilisha mgawanyo wa bili.',
 'Could not load or save the bill. Please try again.':'Imeshindikana kupakia au kuhifadhi bili. Tafadhali jaribu tena.',
 'Unlocking cancels this split. Paid shares are kept and cannot be charged again.':'Kufungua kunafuta mgawanyo huu. Sehemu zilizolipwa zinahifadhiwa na hazitatozwa tena.',
 'Cancel':'Ghairi','Unlock and recalculate':'Fungua na uhesabu upya',
 'No outstanding balance':'Hakuna salio la kulipa','The session has ended. Scan the table QR again.':'Kikao kimeisha. Changanua QR ya meza tena.'
} as const;
export type BillMessage=keyof typeof messages;
export const billText=(locale:Locale)=>(key:BillMessage)=>locale==='sw'?messages[key]:key;
export function billError(code:string):BillMessage{return ({BILL_CHANGED:'The bill changed. Recalculate the split before confirming.',SPLIT_CHANGED:'Another guest changed this split. Review the latest amounts.',SPLIT_ALREADY_LOCKED:'Another guest changed this split. Review the latest amounts.',SPLIT_INACTIVE:'Another guest changed this split. Review the latest amounts.',ALREADY_CLAIMED:'That amount is already claimed. Review the latest allocations.',SHARE_ALREADY_CLAIMED:'Another guest has claimed this share.',SHARE_FORBIDDEN:'Another guest has claimed this share.',PAYMENT_IN_FLIGHT:'A payment is in progress. Wait for its final result.',UNASSIGNED_AMOUNT:'Assign all items before confirming the split.',SESSION_CLOSED:'The session has ended. Scan the table QR again.',TOKEN_INVALID:'The session has ended. Scan the table QR again.'} as Record<string,BillMessage>)[code]??'Could not load or save the bill. Please try again.';}
