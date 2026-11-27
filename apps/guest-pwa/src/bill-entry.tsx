import {useRef,useState} from 'preact/hooks';
import {billText} from './bill-i18n.ts';
import type {BillProps} from './bill-types.ts';
export function BillEntry(props:Omit<BillProps,'close'>){
 const [module,setModule]=useState<typeof import('./bill-dialog.tsx')>(),[open,setOpen]=useState(false),[error,setError]=useState(false),loading=useRef(false),t=billText(props.locale);
 async function show(){if(loading.current)return;setError(false);if(module){setOpen(true);return;}loading.current=true;try{setModule(await import('./bill-dialog.tsx'));setOpen(true);}catch{setError(true);}finally{loading.current=false;}}
 return <><button class="bill-open" onClick={()=>void show()}>{t('View bill')}</button>{error&&<p role="alert">{t('Could not load or save the bill. Please try again.')}</p>}{module&&open&&<module.BillDialog {...props} close={()=>setOpen(false)}/>}</>;
}
