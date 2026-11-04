import {ServiceDesk} from './ServiceDesk.tsx';
import {render} from 'preact';

import {useEffect,useState} from 'preact/hooks';

import './staff.css';

import {AdminMenu} from './admin-menu.tsx';

import {AdminTables} from './admin-tables.tsx';

import {Dashboard} from '../../owner/src/operations/Dashboard.tsx';

import {Inventory} from '../../owner/src/operations/Inventory.tsx';

import {MenuEditor} from '../../owner/src/operations/MenuEditor.tsx';

import {opText,type Locale} from '../../owner/src/operations/i18n.ts';

import {translator} from '../../owner/src/i18n.ts';

import {request} from '../../owner/src/api.ts';

type Data=Record<string,any>;

function StaffApp(){

 const [token,setToken]=useState(sessionStorage.getItem('staff_token')??''),[role,setRole]=useState(''),[locale,setLocale]=useState<Locale>('en'),[tab,setTab]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[venue,setVenue]=useState<Data>();const t=opText(locale),manager=['MANAGER','OWNER'].includes(role);

 useEffect(()=>{if(!token)location.replace('/owner/?login');},[token]);
 function logout(){sessionStorage.removeItem('staff_token');sessionStorage.removeItem('staff_role');setToken('');setRole('');setVenue(undefined);setTab('');}

 useEffect(()=>{document.documentElement.lang=locale;},[locale]);

 useEffect(()=>{if(!token)return;let active=true;void request(token,'/v1/staff/me').then(r=>{if(!active)return;setRole(r.staff.role);setVenue(r.venue);setTab(['MANAGER','OWNER'].includes(r.staff.role)?'dashboard':'orders');}).catch(()=>{if(active){logout();setError(t('A session expired. Sign in again.'));}});return()=>{active=false;};},[token]);

 async function login(e:SubmitEvent){e.preventDefault();const form=new FormData(e.currentTarget as HTMLFormElement);setBusy(true);setError('');try{const data=await request(undefined,'/v1/staff/auth/login','POST',{venue_code:form.get('venue_code'),staff_id:form.get('staff_id')||undefined,pin:form.get('pin')});sessionStorage.setItem('staff_token',data.staff_token);setToken(data.staff_token);}catch{setError(t('Check venue, staff identifier and PIN. Try again later if locked.'));}finally{setBusy(false);}}

 return <main class="staff-main"><header class="staff-header"><div><strong>Cloud-Menu</strong><p class="cm-muted">{venue?.name} {venue&&`· ${t(({OWNER:'Owner',MANAGER:'Manager',KITCHEN:'Kitchen',BAR:'Bar',WAITER:'Waiter'} as Data)[role])}`}</p></div><div class="cm-row"><label><span class="sr-only">{t('Languages')}</span><select aria-label={t('Languages')} value={locale} onChange={e=>setLocale(e.currentTarget.value as Locale)}><option value="en">EN</option><option value="sw">SW</option></select></label>{token&&<button onClick={logout}>{t('Sign out')}</button>}</div></header>{!token?<form class="staff-login cm-form" onSubmit={e=>void login(e as SubmitEvent)}><h1>{t('Welcome back')}</h1><label>{t('Venue code')}<input name="venue_code" required autoComplete="organization"/></label><label>{t('Staff identifier')}<input placeholder={locale==='sw'?'Jina la mfanyakazi':'Staff name or ID'} name="staff_id" autoComplete="username"/></label><label>{t('PIN')}<input name="pin" required type="password" inputMode="numeric" minLength={4} maxLength={12} autoComplete="current-password"/></label><button class="primary" disabled={busy}>{t('Sign in')}</button>{error&&<p role="alert">{error}</p>}</form>:!role?<p role="status">{t('Working…')}</p>:<><nav class="staff-tabs" aria-label={t('Workspace')}>{[...(manager?[['dashboard','Dashboard']]:[]),...(['OWNER','MANAGER','KITCHEN','BAR'].includes(role)?[['inventory','Inventory']]:[]),['orders','Orders'],...(manager?[['menu','Menu'],['tables','Tables & QR']]:[])].map(([id,label])=><button aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{t(label)}</button>)}</nav><h1>{t(({dashboard:'Venue dashboard',inventory:'Inventory',orders:'Recent orders',menu:'Menu',tables:'Tables & QR'} as Data)[tab]??'Workspace')}</h1>{tab==='dashboard'&&manager&&<Dashboard token={token} locale={locale}/>} {tab==='inventory'&&<Inventory token={token} locale={locale}/>} {tab==='orders'&&<ServiceDesk token={token} locale={locale} role={role}/>} {tab==='menu'&&manager&&<StaffMenu token={token} locale={locale}/>} {tab==='tables'&&manager&&<AdminTables token={token}/>}</>}</main>;

}

function StaffMenu({token,locale}:{token:string;locale:Locale}){const [menu,setMenu]=useState<Data>({categories:[],items:[]}),[busy,setBusy]=useState(false),[error,setError]=useState('');async function load(){const r=await request(token,'/v1/admin/menu');setMenu({...r,items:r.categories.flatMap((c:Data)=>c.items)});}useEffect(()=>{void load().catch(()=>setError(opText(locale)('Could not load data. Please try again.')));},[token]);async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch{setError(opText(locale)('Could not load data. Please try again.'));}finally{setBusy(false);}}return <>{error&&<p role="alert">{error}</p>}<MenuEditor token={token} menu={menu} locale={locale} t={translator(locale)} busy={busy} run={run} saved={load}/><details class="staff-advanced"><summary>{opText(locale)('Advanced menu tools')}</summary><AdminMenu token={token} onSaved={load}/></details></>;}

render(<StaffApp/>,document.getElementById('app')!);

