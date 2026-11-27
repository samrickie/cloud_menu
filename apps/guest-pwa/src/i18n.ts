export const copy={
 en:{closed:'Your session has ended. Please scan the table QR again.',loading:'Loading menu…',invalidQR:'This QR code is not valid. Please ask your waiter.',unavailable:'Digital ordering unavailable',full:'This table is full. Please see a waiter.',retry:'Retry',scan:'Scan your table QR to open the menu.',offline:'You are offline. Please reconnect to send an order.',menu:'Menu',error:'Something went wrong. Please try again.'},
 sw:{closed:'Kikao kimeisha. Tafadhali changanua QR ya meza tena.',loading:'Menyu inapakia…',invalidQR:'Msimbo huu wa QR si sahihi. Tafadhali muulize mhudumu.',unavailable:'Kuagiza kidijitali hakupatikani',full:'Meza imejaa. Tafadhali muone mhudumu.',retry:'Jaribu tena',scan:'Changanua QR ya meza yako kufungua menyu.',offline:'Huna mtandao. Unganisha tena ili kutuma agizo.',menu:'Menyu',error:'Hitilafu imetokea. Tafadhali jaribu tena.'}
};

const messages={
  "message_1": {
    "en": "Close",
    "sw": "Funga"
  },
  "message_2": {
    "en": "Quantity",
    "sw": "Idadi"
  },
  "message_3": {
    "en": "Kitchen note",
    "sw": "Maelezo kwa mpishi"
  },
  "message_4": {
    "en": "Add to cart",
    "sw": "Ongeza kwenye kikapu"
  },
  "message_5": {
    "en": "sw",
    "sw": "en"
  },
  "message_6": {
    "en": "Your name",
    "sw": "Jina lako"
  },
  "message_7": {
    "en": "Menu unavailable. Please retry.",
    "sw": "Menyu haipatikani. Tafadhali jaribu tena."
  },
  "message_8": {
    "en": "Loading menu…",
    "sw": "Menyu inapakia…"
  },
  "message_9": {
    "en": "Retry",
    "sw": "Jaribu tena"
  },
  "message_10": {
    "en": "Find your favourite",
    "sw": "Tafuta unachopenda"
  },
  "message_11": {
    "en": "Search the menu",
    "sw": "Tafuta kwenye menyu"
  },
  "message_12": {
    "en": "Menu categories",
    "sw": "Makundi ya menyu"
  },
  "message_13": {
    "en": "The menu is being prepared. Please ask your waiter.",
    "sw": "Menyu inaandaliwa. Tafadhali muulize mhudumu."
  },
  "message_14": {
    "en": "Sold out",
    "sw": "Imeisha"
  },
  "message_15": {
    "en": "Add",
    "sw": "Ongeza"
  },
  "message_16": {
    "en": "Cart could not be saved on this device.",
    "sw": "Kikapu hakikuhifadhiwa kwenye kifaa hiki."
  },
  "message_17": {
    "en": "Your cart",
    "sw": "Kikapu chako"
  },
  "message_18": {
    "en": "Your cart is empty.",
    "sw": "Kikapu chako ni tupu."
  },
  "message_19": {
    "en": "Remove",
    "sw": "Ondoa"
  },
  "message_20": {
    "en": "View cart",
    "sw": "Ona kikapu"
  },
  "message_21": {
    "en": "Order received",
    "sw": "Agizo limepokelewa"
  },
  "message_22": {
    "en": "Prices changed. Review the updated total:",
    "sw": "Bei zimebadilika. Hakiki jumla mpya:"
  },
  "message_23": {
    "en": "Sending…",
    "sw": "Inatuma…"
  },
  "message_24": {
    "en": "Confirm updated total",
    "sw": "Thibitisha jumla mpya"
  },
  "message_25": {
    "en": "Send order",
    "sw": "Tuma agizo"
  }
} as const;
export function ui(locale:'en'|'sw',key:keyof typeof messages){return messages[key][locale];}
const errors={
 en:{stock:'Not enough stock remains. Reduce the quantity or ask your waiter.',venuePaused:'Ordering is paused. Please ask your waiter.',generic:'Please check the quantity and selections.',choose:'Choose ',maximum:'Choose at most ',notConfirmed:'Order not confirmed. Please retry with the same cart.',unavailable:'An item is sold out. Remove it and try again.',session:'Your session has ended. Please scan the table QR again.',changed:'Prices changed. Please review the new total.',waiting:'Received by the venue'},
 sw:{stock:'Hisa zilizobaki hazitoshi. Punguza idadi au muulize mhudumu.',venuePaused:'Kuagiza kumesimamishwa. Tafadhali muulize mhudumu.',generic:'Tafadhali hakiki idadi na chaguo.',choose:'Chagua ',maximum:'Chagua zisizozidi ',notConfirmed:'Agizo halijathibitishwa. Tafadhali jaribu tena na kikapu hicho hicho.',unavailable:'Bidhaa imeisha. Iondoe kisha ujaribu tena.',session:'Kikao kimeisha. Tafadhali changanua QR ya meza tena.',changed:'Bei zimebadilika. Tafadhali hakiki jumla mpya.',waiting:'Limepokelewa na mgahawa'}
};
export function selectionError(locale:'en'|'sw',message:string,groups:{name_en:string;name_sw?:string}[]=[]){const groupName=(name:string)=>locale==='sw'?(groups.find(g=>g.name_en===name)?.name_sw??name):name;const maximum=/^Choose at most (\d+) (.+)$/.exec(message);if(maximum)return errors[locale].maximum+maximum[1]+' '+groupName(maximum[2]);if(message.startsWith('Choose '))return errors[locale].choose+groupName(message.slice(7));return errors[locale].generic;}
export function orderError(locale:'en'|'sw',code:string){const e=errors[locale];return code==='STOCK_INSUFFICIENT'?e.stock:code==='VENUE_SUSPENDED'?e.venuePaused:code==='ITEM_UNAVAILABLE'?e.unavailable:['SESSION_CLOSED','TOKEN_INVALID'].includes(code)?e.session:code==='PRICE_CHANGED'?e.changed:e.notConfirmed;}
export const receivedStatus=(locale:'en'|'sw')=>errors[locale].waiting;
