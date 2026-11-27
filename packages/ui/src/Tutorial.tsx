import {useEffect,useRef,useState} from 'preact/hooks';
import './tutorial.css';

type Step = [selector:string, english:string, swahili:string];
const guides = {
  register: [
    ['input[name="name"]','Enter the name you use as the venue owner.','Andika jina lako kama mmiliki.'],
    ['input[type="email"]','Use the email address you will sign in with.','Andika barua pepe utakayotumia kuingia.'],
    ['input[type="password"]','Choose a password of at least 12 characters, then create your account.','Chagua nenosiri lenye angalau herufi 12, kisha fungua akaunti.']
  ],
  venue: [
    ['input[name="name"]','Enter the business name guests should see.','Andika jina la biashara litakaloonekana kwa wageni.'],
    ['input[name="slug"]','Review your suggested website address. You can edit it here.','Hakiki anwani ya tovuti iliyopendekezwa. Unaweza kuibadili hapa.'],
    ['select[name="venue_type"]','Choose your venue type, set your tip preference, then select Create venue.','Chagua aina ya eneo, amua kuhusu bakshishi, kisha unda eneo.']
  ],
  owner: [
    ['.owner-header','Check the venue name before making changes.','Hakiki jina la eneo kabla ya kufanya mabadiliko.'],
    ['.owner-nav','Use Menu to add categories, prices and photos. Open Tables & QR codes to create table stickers.','Fungua Menyu kuongeza makundi, bei na picha. Fungua Meza na QR kutengeneza vibandiko.'],
    ['.setup-steps','Follow the setup steps to review your website and publish it when ready.','Fuata hatua za usanidi kuhakiki tovuti na kuichapisha ikiwa tayari.']
  ],
  menu: [
    ['.search','Find a dish by name or browse the menu categories.','Tafuta chakula kwa jina au angalia makundi ya menyu.'],
    ['.item-title-button','Open an item to see its details, choose options and add it to your cart.','Fungua bidhaa kuona maelezo, chagua machaguo na uiongeze kwenye kikapu.'],
    ['.cart-bar','Open your cart to check quantities and the total before submitting your order.','Fungua kikapu kuhakiki idadi na jumla kabla ya kutuma agizo.']
  ],
  item: [
    ['dialog[open] fieldset','Select the options you want. Required choices are marked with a selection range.','Chagua machaguo unayotaka. Angalia idadi inayohitajika.'],
    ['dialog[open] textarea','Add preparation instructions or choose a quick note.','Ongeza maelekezo ya maandalizi au chagua dokezo.'],
    ['dialog[open] button.primary','Add this item to your cart when the choices and price look right.','Ongeza bidhaa kwenye kikapu baada ya kuhakiki machaguo na bei.']
  ],
  cart: [
    ['.cart-panel input[type="number"]','Check how many of each item you want.','Hakiki idadi ya kila bidhaa.'],
    ['.cart-panel strong','Review the total, then submit your order when ready.','Hakiki jumla, kisha tuma agizo ukiwa tayari.']
  ]
} satisfies Record<string,Step[]>;

export function Tutorial({guide,locale}:{guide:keyof typeof guides;locale:'en'|'sw'}){
  const [index,setIndex]=useState(-1);
  const [steps,setSteps]=useState<Step[]>([]);
  const dialog=useRef<HTMLDialogElement>(null);
  const sw=locale==='sw';
  useEffect(()=>{
    if(index<0)return;
    const box=dialog.current;
    const target=document.querySelector<HTMLElement>(steps[index][0]);
    if(!box||!target){setIndex(-1);return;}
    if(!box.open)box.showModal();
    target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    const position=()=>{
      const r=target.getBoundingClientRect();
      const left=Math.max(0,r.left-4), right=Math.min(innerWidth,r.right+4);
      const top=Math.max(0,r.top-4), bottom=Math.min(innerHeight,r.bottom+4);
      box.style.setProperty('--tour-hole',`polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${left}px ${top}px,${right}px ${top}px,${right}px ${bottom}px,${left}px ${bottom}px,${left}px ${top}px)`);
      box.dataset.side=top>innerHeight-bottom?'top':'bottom';
    };
    position();
    window.addEventListener('resize',position);
    window.addEventListener('scroll',position,true);
    return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
  },[index,steps]);
  const close=()=>{dialog.current?.close();setIndex(-1);};
  function start(){
    const visible=guides[guide].filter(([selector])=>document.querySelector(selector)?.getClientRects().length);
    if(visible.length){setSteps(visible);setIndex(0);}
  }
  return <><button class="cm-button secondary" type="button" onClick={start}>{sw?'Mwongozo':'Tutorial'}</button>
    {index>=0&&<dialog class="cm-tour" ref={dialog} aria-label={sw?'Mwongozo':'Tutorial'} onCancel={e=>{e.preventDefault();e.stopPropagation();close();}}>
      <section class="cm-tour-card"><small>{index+1} / {steps.length}</small>
        <p aria-live="polite">{steps[index][sw?2:1]}</p>
        <button type="button" class="cm-button secondary" onClick={close}>{sw?'Ruka':'Skip tutorial'}</button>
        <button type="button" class="cm-button" onClick={()=>index+1<steps.length?setIndex(index+1):close()}>{index+1<steps.length?(sw?'Endelea':'Next'):(sw?'Maliza':'Finish')}</button>
      </section></dialog>}</>;
}
