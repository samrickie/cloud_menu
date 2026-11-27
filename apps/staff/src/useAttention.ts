import {useEffect,useRef,useState} from 'preact/hooks';
import {request,ApiError} from '../../owner/src/api.ts';
export function useAttention(token:string){
 const [data,setData]=useState<any>(),[error,setError]=useState(false),[revision,setRevision]=useState(0),clock=useRef({server:Date.now(),client:performance.now()});
 useEffect(()=>{let live=true,running=false;const stop=new AbortController();
  async function load(){if(running)return;running=true;try{const r=await request(token,'/v1/staff/attention');if(live){clock.current={server:Date.parse(r.server_time),client:performance.now()};setData(r);setError(false);}}catch(e){if(live){setError(true);if(e instanceof ApiError&&[401,403].includes(e.status))setData(undefined);}}finally{running=false;}}
  void load();const poll=setInterval(()=>void load(),5000);
  const wait=()=>new Promise<void>(resolve=>{const timer=setTimeout(done,2000);function done(){clearTimeout(timer);stop.signal.removeEventListener('abort',done);resolve();}stop.signal.addEventListener('abort',done,{once:true});});
  async function stream(){while(live){const connection=new AbortController();const cancel=()=>connection.abort();stop.signal.addEventListener('abort',cancel,{once:true});let timeout:ReturnType<typeof setTimeout>|undefined;const reset=()=>{clearTimeout(timeout);timeout=setTimeout(cancel,40000);};try{reset();const r=await fetch('/v1/staff/attention/events',{headers:{authorization:`Bearer ${token}`},credentials:'omit',signal:connection.signal});if([401,403].includes(r.status))return;if(!r.ok||!r.body)throw Error();const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';while(live){const chunk=await reader.read();if(chunk.done)break;reset();buffer+=decoder.decode(chunk.value,{stream:true});if(buffer.length>65536)throw Error();let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);if(frame.includes('event: changed'))void load();}}}catch{/* Polling keeps the queue current while the stream reconnects. */}finally{clearTimeout(timeout);connection.abort();stop.signal.removeEventListener('abort',cancel);}if(live)await wait();}}
  void stream();return()=>{live=false;stop.abort();clearInterval(poll);};
 },[token,revision]);
 return {data,error,reload:()=>setRevision(v=>v+1),now:()=>clock.current.server+performance.now()-clock.current.client};
}
