import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import type {Context} from './context.ts';
import {idParams} from './context.ts';
import type {Store,Row} from './store.ts';
import {Problem} from './security.ts';
import {guestEvent} from './guest-operations.ts';
export type ExternalSubscribe=(venue:string,receive:(seq:number)=>void)=>Promise<()=>void>;
type Listener=(event:Row)=>void;
type Channel={listeners:Set<Listener>;cursor:number;ready:Promise<void>;stop?:()=>void;timer?:ReturnType<typeof setInterval>;reading?:Promise<void>;again:boolean};

// Read the durable outbox once per venue, then fan out. Redis only wakes readers;
// missed pub/sub notifications are recovered by the bounded venue-level poll.
export class RealtimeBroker {
 private channels=new Map<string,Channel>();
 constructor(private store:Store,private external?:ExternalSubscribe){}
 async subscribe(venue:string,receive:Listener){
  let state=this.channels.get(venue);
  if(!state){
   const channel:Channel={listeners:new Set(),cursor:0,ready:Promise.resolve(),again:false};state=channel;this.channels.set(venue,channel);
   channel.ready=Promise.resolve().then(async()=>{channel.stop=await this.external?.(venue,()=>{void this.refresh(venue).catch(()=>{});});channel.cursor=await this.store.eventHead(venue);channel.timer=setInterval(()=>{void this.refresh(venue).catch(()=>{});},5000);channel.timer.unref();});
  }
  state.listeners.add(receive);
  const release=()=>{state!.listeners.delete(receive);if(!state!.listeners.size){if(state!.timer)clearInterval(state!.timer);state!.stop?.();if(this.channels.get(venue)===state)this.channels.delete(venue);}};
  try{await state.ready;}catch{release();throw new Problem(503,'REALTIME_UNAVAILABLE');}
  return release;
 }
 async refresh(venue:string){
  const state=this.channels.get(venue);if(!state)return;await state.ready;
  if(state.reading){state.again=true;return state.reading;}
  state.reading=(async()=>{let batches=0;do{state.again=false;const rows=await this.store.events(venue,state.cursor,200);for(const event of rows){if(event.seq<=state.cursor)continue;state.cursor=Number(event.seq);for(const listener of [...state.listeners])listener(event);}if(rows.length===200)state.again=true;}while(state.again&&++batches<10);})();
  try{await state.reading;}finally{state.reading=undefined;}
 }
 async close(){for(const state of this.channels.values()){await state.ready.catch(()=>{});if(state.timer)clearInterval(state.timer);state.stop?.();}this.channels.clear();}
}

export function registerGuestEvents(app:FastifyInstance,ctx:Context,broker:RealtimeBroker,limit:(key:string,max:number)=>Promise<void>){
 const streams=new Set<()=>void>(),perParticipant=new Map<string,number>();
 app.addHook('preClose',async()=>{for(const end of [...streams])end();await broker.close();});
 app.get('/v1/sessions/:id/events',async(request,reply)=>{
  const sid=idParams(request.params),guest=await ctx.guest(request,sid);await limit(`sse:${guest.participant_id}`,20);
  const cursor=z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0).parse(request.headers['last-event-id']);
  let head=await ctx.store.eventHead(guest.venue_id);if(cursor>head)throw new Problem(409,'EVENT_CURSOR_INVALID');
  const key=guest.participant_id;if((perParticipant.get(key)??0)>=3||streams.size>=5000)throw new Problem(429,'TOO_MANY_STREAMS');
  let last=cursor,initial=true,ended=false;const pending:Row[]=[];let release:(()=>void)|undefined,heartbeat:ReturnType<typeof setInterval>|undefined,expiry:ReturnType<typeof setTimeout>|undefined;
  const end=()=>{if(ended)return;ended=true;release?.();if(heartbeat)clearInterval(heartbeat);if(expiry)clearTimeout(expiry);streams.delete(end);const n=(perParticipant.get(key)??1)-1;if(n)perParticipant.set(key,n);else perParticipant.delete(key);if(reply.raw.headersSent&&!reply.raw.destroyed)reply.raw.end();};
  const write=(event:Row)=>{if(ended||Number(event.seq)<=last||!guestEvent(event,sid))return;if(!/^[a-z_.]{1,100}$/.test(event.event_type))return;reply.raw.write(`id: ${event.seq}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event.payload)}\n\n`);last=Number(event.seq);if(reply.raw.writableLength>262144){reply.raw.destroy();end();}if(['session.closed','venue.access_suspended'].includes(event.event_type))end();};
  perParticipant.set(key,(perParticipant.get(key)??0)+1);streams.add(end);
  reply.raw.on('close',end);
  try{release=await broker.subscribe(guest.venue_id,event=>{if(!guestEvent(event,sid))return;if(initial){pending.push(event);if(pending.length>128){reply.raw.destroy();end();}}else write(event);});await ctx.guest(request,sid);head=await ctx.store.eventHead(guest.venue_id);}catch(e){end();throw e;}
  if(ended||reply.raw.destroyed){release();end();return;}
  reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});reply.raw.write(': connected\n\n');
  try{
   // Subscribe before replay; live events wait until the replay cursor catches up.
   let batches=0;while(!ended){const events=await ctx.store.events(guest.venue_id,last,200,sid);for(const event of events.filter(e=>Number(e.seq)<=head)){if(event.event_type==='venue.access_suspended')last=Math.max(last,Number(event.seq));else write(event);}if(events.length<200||last>=head)break;if(++batches>=10){reply.raw.write('event: resync.required\ndata: {}\n\n');end();break;}}
   initial=false;for(const event of pending.sort((a,b)=>Number(a.seq)-Number(b.seq)))write(event);pending.length=0;
   if(ended)return;
   heartbeat=setInterval(()=>{if(reply.raw.writableLength>262144){reply.raw.destroy();end();return;}void ctx.guest(request,sid).then(()=>{if(!ended)reply.raw.write(': heartbeat\n\n');}).catch(e=>{if(!ended)reply.raw.write(e instanceof Problem&&e.code==='VENUE_SUSPENDED'?'event: venue.access_suspended\ndata: {"status":"SUSPENDED"}\n\n':'event: session.closed\ndata: {"reason":"SESSION_CLOSED"}\n\n');end();});},20000);heartbeat.unref();
   expiry=setTimeout(()=>{reply.raw.write('event: auth.expired\ndata: {}\n\n');end();},Math.max(0,Number(guest.exp)*1000-Date.now()));expiry.unref();
  }catch{reply.raw.write('event: resync.required\ndata: {}\n\n');end();}
 });
}
