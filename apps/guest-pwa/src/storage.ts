// Some embedded/private browsers deny Web Storage. Preserve the current tab's
// identity, draft and idempotency key; warn instead of crashing the guest flow.
const memory=new Map<string,string>(),listeners=new Set<()=>void>();let limited=false;
const mark=()=>{if(!limited){limited=true;for(const listener of listeners)listener();}};
export const storageLimited=()=>limited;
export const watchStorage=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
function area(kind:'localStorage'|'sessionStorage'){
 const keyFor=(key:string)=>kind+':'+key;
 function fallbackGet(key:string){try{return window.sessionStorage.getItem('cloud-menu:fallback:'+keyFor(key));}catch{return null;}}
 return {
  getItem(key:string){try{return window[kind].getItem(key)??memory.get(keyFor(key))??null;}catch{mark();return fallbackGet(key)??memory.get(keyFor(key))??null;}},
  setItem(key:string,value:string){memory.set(keyFor(key),value);try{window[kind].setItem(key,value);}catch{mark();try{window.sessionStorage.setItem('cloud-menu:fallback:'+keyFor(key),value);}catch{/* in-memory fallback remains */}}},
  removeItem(key:string){memory.delete(keyFor(key));try{window[kind].removeItem(key);}catch{mark();}try{window.sessionStorage.removeItem('cloud-menu:fallback:'+keyFor(key));}catch{/* storage denied */}}
 };
}
export const local=area('localStorage'),session=area('sessionStorage');
