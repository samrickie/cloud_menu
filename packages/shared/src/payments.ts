// Contract boundary only. No mobile money routes or real provider protocols in S1.
export interface PaymentRequest {reference:string;amount_tzs:number;currency:'TZS';idempotency_key:string;encrypted_contact_reference:string}
export interface ProviderResult {reference:string;status:'PENDING'|'SUCCESS'|'FAILED';provider_reference?:string}
export interface PaymentProvider {initiate(request:PaymentRequest):Promise<ProviderResult>;status(reference:string):Promise<ProviderResult>}
export class SandboxPaymentProvider implements PaymentProvider {
 readonly mode='SANDBOX_STUB';private requests=new Map<string,ProviderResult>();
 async initiate(request:PaymentRequest){if(!Number.isSafeInteger(request.amount_tzs)||request.amount_tzs<=0)throw Error('Invalid TZS amount');const result=this.requests.get(request.idempotency_key)??{reference:request.reference,status:'PENDING' as const,provider_reference:'sandbox:'+request.reference};this.requests.set(request.idempotency_key,result);return result;}
 async status(reference:string){return [...this.requests.values()].find(r=>r.reference===reference)??{reference,status:'FAILED' as const};}
}
