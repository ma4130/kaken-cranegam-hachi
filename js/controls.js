// ボタンとスティックは同じ入力経路を使い、右→奥の順番を保つ。
export function installControlSwitch({mount,buttons,getState,onDown,onUp}) {
  let mode='buttons',active=null,pointer=null,externalActive=false;
  try{mode=localStorage.getItem('hachi-control-mode')==='stick'?'stick':'buttons';}catch{}
  const toggle=document.createElement('div');toggle.className='control-switch';toggle.setAttribute('role','group');toggle.setAttribute('aria-label','操作方法');
  const choices=[['buttons','ボタン'],['stick','スティック']].map(([value,label])=>{
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',()=>{if(active||pointer!==null||externalActive)return;mode=value;try{localStorage.setItem('hachi-control-mode',mode);}catch{}sync();});
    toggle.append(button);return {button,value};
  });
  const wrapper=document.createElement('div');wrapper.className='stick-wrapper';
  const stick=document.createElement('button');stick.className='joystick';stick.type='button';stick.setAttribute('aria-label','スティック。①右へ倒す、②上へ倒す。離すと決定');
  stick.innerHTML='<span class="stick-up" aria-hidden="true">② ↑</span><span class="stick-right" aria-hidden="true">① →</span><span class="stick-groove" aria-hidden="true"></span><span class="stick-thumb" aria-hidden="true"></span>';
  const thumb=stick.querySelector('.stick-thumb');
  const hint=document.createElement('p');hint.className='stick-hint';
  wrapper.append(stick,hint);mount.append(toggle,wrapper);
  function sync(){
    for(const {button,value} of choices){button.setAttribute('aria-pressed',String(mode===value));button.disabled=!!active||pointer!==null||externalActive;}
    for(const button of buttons)button.hidden=mode==='stick';
    wrapper.hidden=mode!=='stick';
    const state=getState();stick.disabled=!state.enabled;
    hint.textContent=state.phase==='x'?'① 右へ倒す → 離してストップ':state.phase==='z'?'② 上へ倒す → 離すとキャッチ':'自分の番を待ってね';
    stick.dataset.axis=state.phase;
  }
  function finish(){
    const previous=active;active=null;pointer=null;thumb.style.transform='translate(0,0)';stick.classList.remove('held');
    if(previous)onUp(previous);sync();
  }
  function move(e){
    if(pointer!==e.pointerId)return;
    const rect=stick.getBoundingClientRect(),radius=rect.width*.28;
    let x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;
    const length=Math.hypot(x,y);if(length>radius){x=x/length*radius;y=y/length*radius;}
    thumb.style.transform=`translate(${x}px,${y}px)`;
    if(active)return;
    const state=getState();
    if(!state.enabled)return;
    const matched=(state.phase==='x'&&x>radius*.25&&Math.abs(x)>=Math.abs(y))||(state.phase==='z'&&y< -radius*.25&&Math.abs(y)>=Math.abs(x));
    if(matched && onDown(state.phase)!==false){active=state.phase;stick.classList.add('held');sync();}
  }
  stick.addEventListener('pointerdown',e=>{if(stick.disabled||pointer!==null)return;e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);sync();});
  stick.addEventListener('pointermove',move);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,()=>{if(pointer!==null)finish();});
  stick.addEventListener('keydown',e=>{
    if(e.repeat||active)return;const state=getState();
    if(state.enabled&&((e.key==='ArrowRight'&&state.phase==='x')||(e.key==='ArrowUp'&&state.phase==='z'))){e.preventDefault();e.stopPropagation();if(onDown(state.phase)!==false){active=state.phase;stick.classList.add('held');sync();}}
  });
  stick.addEventListener('keyup',e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();finish();}});
  stick.addEventListener('contextmenu',e=>e.preventDefault());
  for(const button of buttons){
    button.addEventListener('pointerdown',()=>{if(!button.disabled){externalActive=true;sync();}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{externalActive=false;sync();});
  }
  addEventListener('blur',finish);document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  sync();return {sync};
}
