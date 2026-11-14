import {mergeCall} from './call-state.ts';
import {useEffect,useState} from 'preact/hooks';
export interface GuestOrder {rated?:boolean;id:string;order_no:number;status:string;created_at:string;items:{id:string;station?:string;name:string;quantity:number;note?:string;status:string;rejection_reason?:string;line_total_tzs:number}[]}
export interface WaiterCall {id:string;reason:string;status:string;created_at:string;message?:string}
export function useGuestLive(entry:any,onExpired:()=>void,onSuspended:()=>void=onExpired){
 const [tableHasBill,setTableHasBill]=useState(false);
 const [orders,setOrders]=useState<GuestOrder[]>([]),[call,setCall]=useState<WaiterCall>(),[connected,setConnected]=useState(false),[menuSeq,setMenuSeq]=useState(0),[billSeq,setBillSeq]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();let connection:AbortController|undefined,lastSeq=0,failures=0,poll:ReturnType<typeof setInterval>|undefined,loading:Promise<void>|undefined,again=false;
  const base=`/v1/sessions/${entry.session.id}`,headers={authorization:`Bearer ${entry.session_token}`};
  async function snapshot(){if(loading){again=true;return loading;}loading=(async()=>{do{again=false;const r=await fetch(base+'/orders',{headers,signal:abort.signal,credentials:'omit'});if(!r.ok){if(r.status===403){const p=await r.json();if(p.code==='VENUE_SUSPENDED')onSuspended();else onExpired();}else if([401,409].includes(r.status))onExpired();throw Error('snapshot unavailable');}const data=await r.json();if(abort.signal.aborted)return;setTableHasBill(!!data.table_has_bill);setOrders(data.orders);setCall(current=>mergeCall(current,data.waiter_call??undefined));lastSeq=Math.max(lastSeq,data.seq);setMenuSeq(lastSeq);setBillSeq(lastSeq);}while(again&&!abort.signal.aborted);})();try{await loading;}finally{loading=undefined;}}
  const wait=(ms:number)=>new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);abort.signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,ms);abort.signal.addEventListener('abort',done,{once:true});});
  async function stream(){
   try{await snapshot();}catch{/* SSE replay can still recover; polling remains available. */}
   while(!abort.signal.aborted){let timer:ReturnType<typeof setTimeout>|undefined;const current=new AbortController();connection=current;const cancel=()=>current.abort();abort.signal.addEventListener('abort',cancel,{once:true});
    try{
     const reset=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>current.abort(),41000);};reset();
     const r=await fetch(base+'/events',{headers:{...headers,'Last-Event-ID':String(lastSeq)},signal:current.signal,credentials:'omit',priority:'low'});
     if(r.status===409){const error=await r.json();if(error.code==='EVENT_CURSOR_INVALID'){lastSeq=0;await snapshot();continue;}onExpired();return;}if([401,403].includes(r.status)){const p=await r.json();if(p.code==='VENUE_SUSPENDED')onSuspended();else onExpired();return;}if(!r.ok||!r.headers.get('content-type')?.includes('text/event-stream'))throw Error('stream unavailable');
     if(abort.signal.aborted)return;setConnected(true);failures=0;if(poll){clearInterval(poll);poll=undefined;}
     const reader=r.body!.getReader(),decoder=new TextDecoder();let buffer='';
     while(!abort.signal.aborted){const chunk=await reader.read();if(chunk.done)break;reset();buffer+=decoder.decode(chunk.value,{stream:true}).replaceAll('\r\n','\n');if(buffer.length>1048576)throw Error('event too large');let end;
      while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);let type='',id=0;const lines=[];for(const line of frame.split('\n')){if(line.startsWith('event:'))type=line.slice(6).trim();if(line.startsWith('id:'))id=Number(line.slice(3).trim());if(line.startsWith('data:'))lines.push(line.slice(5).trimStart());}
       if(!type)continue;if(type==='venue.access_suspended'){onSuspended();return;}if(type==='auth.expired'||type==='session.closed'){onExpired();return;}if(type==='resync.required'){await snapshot();continue;}if(!Number.isSafeInteger(id)||id<=lastSeq)continue;lastSeq=id;
       if(type==='menu.item_availability')setMenuSeq(id);
       if(type.startsWith('order.')||type.startsWith('waiter.')||type==='bill.updated'||type==='split.updated')await snapshot();
      }
     }
     throw Error('stream closed');
    }catch{if(abort.signal.aborted)return;setConnected(false);failures++;if(failures>=3&&!poll)poll=setInterval(()=>{void snapshot().catch(()=>{});},5000);}
    finally{if(timer)clearTimeout(timer);current.abort();abort.signal.removeEventListener('abort',cancel);}
    await wait(Math.min(15000,1000*2**Math.min(failures-1,4)));
   }
  }
  void stream();return()=>{abort.abort();connection?.abort();if(poll)clearInterval(poll);};
 },[entry.session.id,entry.session_token]);
 return {tableHasBill,orders,call,connected,menuSeq,billSeq,setCall:(next:WaiterCall)=>setCall(current=>mergeCall(current,next))};
}
