export function assertBudgets(metrics:{initialJsGzip:number;lcp:number;profile:string;shell?:number}):void;
export function assertCompleteLighthouse(report:{runtimeError?:{message?:string};runWarnings?:string[]}):void;
export function assertJsBudget(bytes:number):void;
