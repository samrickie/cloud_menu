export interface ApiProblem {type:string;title:string;status:number;code:string;detail?:string;request_id?:string}
export class ApiError extends Error{constructor(public problem:ApiProblem){super(problem.code);}}
export class ApiClient {
 constructor(private token:()=>string|undefined,private base='',private transport:typeof fetch=fetch){}
 async request<T>(path:string,options:{method?:string;body?:unknown;idempotencyKey?:string;signal?:AbortSignal}={}):Promise<T>{
  const token=this.token();const response=await this.transport(this.base+path,{method:options.method??'GET',signal:options.signal,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(options.body!==undefined?{'Content-Type':'application/json'}:{}),...(options.idempotencyKey?{'Idempotency-Key':options.idempotencyKey}:{})},body:options.body!==undefined?JSON.stringify(options.body):undefined});
  const data=await response.json();if(!response.ok)throw new ApiError(data);return data as T;
 }
}
