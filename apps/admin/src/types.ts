export type Data=Record<string,any>;
export type Call=(url:string,method?:string,body?:unknown)=>Promise<Data>;
