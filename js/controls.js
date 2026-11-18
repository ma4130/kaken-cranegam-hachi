// ボタンとスティックは同じ入力経路を使い、右→奥の順番を保つ。
export function installControlSwitch({mount,buttons,getState,onDown,onUp,onMode,onVector,onGrab}) {
  let mode='buttons',active=null,pointer=null,externalActive=false;
  try{mode=localStorage.getItem('hachi-control-mode')==='stick'?'stick':'buttons';}catch{}
  const toggle=document.createElement('div');toggle.className='control-switch';toggle.setAttribute('role','group');toggle.setAttribute('aria-label','操作方法');
  const choices=[['buttons','ボタン'],['stick','スティック']].map(([value,label])=>{
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',()=>{if(active||pointer!==null||externalActive)return;mode=value;onMode?.(mode);try{localStorage.setItem('hachi-control-mode',mode);}catch{}sync();});
    toggle.append(button);return {button,value};
  });
  const wrapper=document.createElement('div');wrapper.className='stick-wrapper';
  const stick=document.createElement('button');stick.className='joystick';stick.type='button';stick.setAttribute('aria-label','スティック。上下左右に動かせます');
  stick.innerHTML='<span class="stick-up" aria-hidden="true">↑</span><span class="stick-right" aria-hidden="true">→</span><span class="stick-groove" aria-hidden="true"></span><span class="stick-thumb" aria-hidden="true"></span>';
  const thumb=stick.querySelector('.stick-thumb');
  const hint=document.createElement('p');hint.className='stick-hint';
  const grab=document.createElement('button');grab.type='button';grab.className='primary stick-grab';grab.textContent='つかむ';grab.addEventListener('click',()=>{finish();onGrab?.();});wrapper.append(stick,hint,grab);mount.append(toggle,wrapper);
  function sync(){
    for(const {button,value} of choices){button.setAttribute('aria-pressed',String(mode===value));button.disabled=!!active||pointer!==null||externalActive;}
    for(const button of buttons)button.hidden=mode==='stick';
    wrapper.hidden=mode!=='stick';
    const state=getState();stick.disabled=!state.enabled;
    hint.textContent=state.enabled?'上下左右に動かして、つかむを押そう':'自分の番を待ってね';grab.disabled=!state.enabled;
    stick.dataset.axis=state.phase;
  }
  function finish(){
    const previous=active;active=null;pointer=null;thumb.style.transform='translate(0,0)';stick.classList.remove('held');
    if(previous)onVector?.(0,0);sync();
  }
  function move(e){
    if(pointer!==e.pointerId)return;
    const rect=stick.getBoundingClientRect(),radius=rect.width*.28;
    let x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;
    const length=Math.hypot(x,y);if(length>radius){x=x/length*radius;y=y/length*radius;}
    thumb.style.transform=`translate(${x}px,${y}px)`;
    const state=getState();if(!state.enabled)return;
    const dx=Math.abs(x)<radius*.25?0:Math.sign(x),dz=Math.abs(y)<radius*.25?0:Math.sign(y);
    const key=dx+','+dz;if(active!==key){active=key;onVector?.(dx,dz);stick.classList.toggle('held',!!(dx||dz));sync();}

  }
  stick.addEventListener('pointerdown',e=>{if(stick.disabled||pointer!==null)return;e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);sync();});
  stick.addEventListener('pointermove',move);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,()=>{if(pointer!==null)finish();});
  const keys=new Set();
  function keyVector(){onVector?.((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0));}
  stick.addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow')||!getState().enabled)return;e.preventDefault();e.stopPropagation();if(!keys.has(e.key)){keys.add(e.key);active='keyboard';keyVector();sync();}});
  stick.addEventListener('keyup',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();e.stopPropagation();keys.delete(e.key);keyVector();if(!keys.size){active=null;sync();}});
  stick.addEventListener('contextmenu',e=>e.preventDefault());
  for(const button of buttons){
    button.addEventListener('pointerdown',()=>{if(!button.disabled){externalActive=true;sync();}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{externalActive=false;sync();});
  }
  addEventListener('blur',finish);document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  sync();return {sync,getMode:()=>mode};
}
