import {render} from 'preact';
import {useState} from 'preact/hooks';
import '../../guest-pwa/src/style.css';
import {AdminMenu} from './admin-menu.tsx';
function StaffApp(){
 const [token,setToken]=useState(sessionStorage.getItem('staff_token')??''),[role,setRole]=useState(sessionStorage.getItem('staff_role')??''),[error,setError]=useState('');
 async function login(e:SubmitEvent){e.preventDefault();const form=new FormData(e.currentTarget as HTMLFormElement);const response=await fetch('/v1/staff/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({venue_code:form.get('venue_code'),staff_id:form.get('staff_id')||undefined,pin:form.get('pin')})});const data=await response.json();if(!response.ok){setError(data.code);return;}sessionStorage.setItem('staff_token',data.staff_token);sessionStorage.setItem('staff_role',data.role);setToken(data.staff_token);setRole(data.role);}
 return <main><header><strong>Cloud-Menu Staff</strong>{token&&<button onClick={()=>{sessionStorage.clear();setToken('');}}>Sign out</button>}</header>{!token?<form onSubmit={e=>void login(e as SubmitEvent)}><h1>Welcome back</h1><label>Venue code<input name="venue_code" required autoComplete="organization"/></label><label>Staff identifier<input name="staff_id" autoComplete="username"/></label><label>PIN<input name="pin" required type="password" inputMode="numeric" minLength={4} maxLength={12} autoComplete="current-password"/></label><button class="primary">Sign in</button>{error&&<p role="alert">{error}</p>}</form>:<><h1>{role}</h1>{["MANAGER","OWNER"].includes(role)&&<AdminMenu token={token}/>}<p>Signed in. Sprint 1 provides menu and table administration. The full KDS and waiter dashboard are scheduled for Sprint 2.</p></>}</main>;
}
render(<StaffApp/>,document.getElementById('app')!);
