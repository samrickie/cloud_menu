interface CallState {id:string;status:string;created_at:string}
// HTTP retries may finish after SSE has already delivered a newer state.
export function mergeCall<T extends CallState>(current:T|undefined,next:T|undefined):T|undefined{
 if(!next)return undefined;if(!current)return next;
 if(current.id!==next.id)return new Date(current.created_at).getTime()>new Date(next.created_at).getTime()?current:next;
 const rank:Record<string,number>={OPEN:0,ACKNOWLEDGED:1,RESOLVED:2};return (rank[current.status]??0)>(rank[next.status]??0)?current:next;
}
