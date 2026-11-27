import {Management} from './Management.tsx';
import {render} from 'preact';
import {useEffect,useState,useRef} from 'preact/hooks';
import {request,ApiError} from '../../owner/src/api.ts';
import {SocialSignIn} from '../../owner/src/SocialSignIn.tsx';
import {translator} from '../../owner/src/i18n.ts';
import {platformText,platformError,type Locale} from '../../../packages/ui/src/platform-copy.ts';
import type {Data} from './types.ts';
import {Overview} from './Overview.tsx';
import {Venues} from './Venues.tsx';
import {Plans} from './Plans.tsx';
import './style.css';
function App(){
 const activity=useRef(Date.now()),renewed=useRef(Date.now());
 const sessionKey='cloud-menu-admin-session';
 function saved(){try{const s=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(s&&Date.now()-s.activity<300000){activity.current=s.activity;return s;}sessionStorage.removeItem(sessionKey);}catch{/* Storage may be unavailable; keep this session in memory. */}return null;}
 const [initial]=useState(saved);

 const [locale,setLocale]=useState<Locale>('en'),[token,setToken]=useState(initial?.token??''),[admin,setAdmin]=useState<Data|undefined>(initial?.admin),[view,setView]=useState('overview'),[venueTarget,setVenueTarget]=useState<{filters:Record<string,string>;id:string}>({filters:{},id:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[accountId,setAccountId]=useState('');const t=platformText(locale);
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 function logout(){try{sessionStorage.removeItem(sessionKey);}catch{/* Storage may be unavailable; keep this session in memory. */}setToken('');setAdmin(undefined);setView('overview');setAccountId('');}
 async function finish(accountToken:string){try{const r=await request(accountToken,'/v1/platform/auth/exchange','POST',{});activity.current=Date.now();renewed.current=Date.now();setToken(r.platform_token);setAdmin(r.admin);setError('');setAccountId('');}catch(e){setError(platformError(locale,e instanceof ApiError?e.code:undefined));setAccountId(e instanceof ApiError?String(e.details.account_id??''):'');}}
 async function call(url:string,method='GET',body?:unknown){try{return await request(token,url,method,body);}catch(e){if(e instanceof ApiError&&[401,403].includes(e.status)){logout();setError(platformError(locale,e.code));}throw e;}}
 useEffect(()=>{
 if(!token)return;
 const persist=()=>{try{sessionStorage.setItem(sessionKey,JSON.stringify({token,admin,activity:activity.current}));}catch{/* Storage may be unavailable; keep this session in memory. */}};
 persist();
 const active=()=>{if(Date.now()-activity.current>=300000){logout();return;}activity.current=Date.now();persist();};
 for(const event of ['pointerdown','keydown','scroll','touchstart'])window.addEventListener(event,active,{passive:true});
 let pending=false,live=true;
 const timer=setInterval(()=>{if(Date.now()-activity.current>=300000){logout();return;}if(!pending&&activity.current>renewed.current&&Date.now()-renewed.current>=30000){pending=true;void request(token,'/v1/platform/auth/refresh','POST',{}).then(r=>{if(live){renewed.current=Date.now();setToken(r.platform_token);}}).catch(e=>{if(live&&e instanceof ApiError&&[401,403].includes(e.status))logout();}).finally(()=>{pending=false;});}},1000);
 return()=>{live=false;clearInterval(timer);for(const event of ['pointerdown','keydown','scroll','touchstart'])window.removeEventListener(event,active);};
 },[token,admin]);
 const language=<label class="platform-language"><span class="sr-only">{t('Languages')}</span><select aria-label={t('Languages')} value={locale} onChange={e=>setLocale(e.currentTarget.value as Locale)}><option value="en">EN</option><option value="sw">SW</option></select></label>;
 if(!token)return <main class="platform-login"><header><a class="platform-brand" href="/admin/">Cloud-Menu<span>.</span></a>{language}</header><section class="cm-card"><span class="cm-eyebrow">{t('Platform administration')}</span><h1>{t('Platform sign-in')}</h1><p class="cm-muted">{t('Authorized administrators only.')}</p><form class="cm-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');void request(undefined,'/v1/owner/auth/login','POST',{email:f.get('email'),password:f.get('password')}).then(r=>finish(r.account_token)).catch(e=>setError(e instanceof ApiError&&e.code==='BUSINESS_DELETED'&&typeof e.details.detail==='string'?e.details.detail:platformError(locale,e instanceof ApiError?e.code:undefined))).finally(()=>setBusy(false));}}><label>{t('Email address')}<input name="email" type="email" autoComplete="username" required/></label><label>{t('Password')}<input name="password" type="password" autoComplete="current-password" required maxLength={72}/></label><button class="primary" disabled={busy}>{t(busy?'Working…':'Sign in')}</button></form>{error&&<p class="cm-alert" role="alert">{error}</p>}{accountId&&<label>{t('Your account ID')}<input readOnly value={accountId} onFocus={e=>e.currentTarget.select()}/></label>}<SocialSignIn t={translator(locale)} returnPath="/admin/" done={r=>finish(r.account_token)}/></section></main>;
 return <div class={`platform-shell ${view==='overview'?'overview-shell':''}`}><aside class="platform-nav"><a class="platform-brand" href="/admin/">Cloud-Menu<span>.</span></a><span class="cm-eyebrow">{t('Platform administration')}</span><nav>{[['overview','Platform overview'],['venues','Venues'],['plans','Billing plans'],['management',locale==='sw'?'Usimamizi':'Management']].map(([id,label])=><button aria-current={view===id?'page':undefined} onClick={()=>{setVenueTarget({filters:{},id:''});setView(id);}}>{t(label)}</button>)}</nav><div class="platform-profile"><span>{admin?.name}</span><small>{admin?.email}</small><button onClick={logout}>{t('Sign out')}</button></div></aside><main class="platform-main"><header class="platform-header"><div><span class="cm-eyebrow">Cloud-Menu</span><h1>{t(({overview:'Platform overview',venues:'Venues',plans:'Billing plans',management:locale==='sw'?'Usimamizi':'Management'} as Data)[view])}</h1></div>{language}</header>{view==='overview'&&<Overview call={call} locale={locale} openVenues={(filters={},id='')=>{setVenueTarget({filters,id});setView('venues');}}/>} {view==='venues'&&<Venues call={call} token={token} locale={locale} initialFilters={venueTarget.filters} initialVenue={venueTarget.id}/>} {view==='management'&&<Management call={call} token={token} locale={locale}/>} {view==='plans'&&<Plans call={call} locale={locale}/>}</main></div>;
}
render(<App/>,document.getElementById('app')!);
