import { connectRoom } from './net.js';
import { installControlSwitch } from './controls.js';
const $=id=>document.getElementById(id);
const room=(new URLSearchParams(location.search).get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
const show=id=>document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id===id));
const read=(store,key,fallback)=>{try{return JSON.parse(store.getItem(key))??fallback;}catch{return fallback;}};
let controls=null;
let net=null,data=null,joined=false,seen=false,busy=false,holding=null,sentTurn='',sequence=0,stopped=false;
const collection=read(localStorage,'hachi-collection',[]);
let lastSeen=read(sessionStorage,'hachi-result-'+room,'');
const sessionKey='hachi-joined-'+room;
$('room-label').textContent=room?'部屋 '+room:'';
$('name').value=read(localStorage,'hachi-name','');
function error(e){console.error(e);$('connection-message').textContent='接続できませんでした。通信を確認して「もう一度つなぐ」を押してください。';stopped=true;show('unavailable');$('right').disabled=$('back').disabled=true;}
function render(){
  if(stopped)return;
  if(!data || Date.now()-data.t>150000){show('unavailable');return;}
  if(holding && (data.phase!==holding.k || data.turn!==holding.turn)){
    $(holding.k==='x'?'right':'back').classList.remove('held');holding=null;
  }
  const saved=read(sessionStorage,sessionKey,null);
  joined=!!(saved && saved.uid===net?.uid && saved.epoch===data.epoch);
  if(!joined){show('join-view');return;}
  const current=data.cur?.id===net.uid;
  const position=data.queue.findIndex(p=>p.id===net.uid);
  if(current || position>=0){seen=true;sessionStorage.setItem('hachi-seen-'+room,JSON.stringify(data.epoch));}
  if(read(sessionStorage,'hachi-seen-'+room,'')===data.epoch)seen=true;
  if(data.last?.id===net.uid){
    const key=data.epoch+':'+data.last.n;
    if(key!==lastSeen){
      lastSeen=key;sessionStorage.setItem('hachi-result-'+room,JSON.stringify(key));
      if(data.last.prize){collection.push(data.last.prize.name);localStorage.setItem('hachi-collection',JSON.stringify(collection.slice(-100)));navigator.vibrate?.([70,40,100]);}
    }
    $('last-result').textContent=data.last.prize?data.last.prize.name+'のはっちーをゲット！':'おしい！次はまんなかをねらってみよう。';
  }
  if(current){
    show('play-view');
    $('instruction').textContent=data.phase==='x'?'① よこに動かそう':data.phase==='z'?'② おくに動かそう':'つかめるかな…？';
    $('remaining').textContent='のこり '+data.cur.left+' 回';
    const locked=sentTurn===data.turn+':'+data.phase;
    $('right').disabled=!navigator.onLine || data.phase!=='x' || locked;
    $('back').disabled=!navigator.onLine || data.phase!=='z' || locked;
    controls?.sync();
  }else if(position>=0 || !seen){
    show('wait');$('wait-position').textContent=position===0?'次はきみの番！':position>0?'前に '+position+' 人いるよ':'参加を受け付けています…';
  }else{
    show('done');$('my-collection').replaceChildren(...[...new Set(collection)].map(name=>{const span=document.createElement('span');span.textContent='★ '+name;return span;}));
  }
}
async function join(){
  if(!net || !data || busy)return;
  busy=true;$('join').disabled=$('again').disabled=true;
  try{
    const name=($('name').value.trim()||'ゲスト').slice(0,8);
    const initial={name,epoch:data.epoch,join:Date.now(),ev:{n:++sequence,k:'x',down:false,dur:0,turn:''}};
    await net.setPlayer(initial);
    sessionStorage.setItem(sessionKey,JSON.stringify({uid:net.uid,epoch:data.epoch}));localStorage.setItem('hachi-name',JSON.stringify(name));
    joined=true;seen=false;sessionStorage.removeItem('hachi-seen-'+room);sentTurn='';$('connection-message').textContent='';render();
  }catch(e){error(e);}finally{busy=false;$('join').disabled=$('again').disabled=false;}
}
$('join-form').addEventListener('submit',e=>{e.preventDefault();join();});
$('again').addEventListener('click',join);
$('retry').addEventListener('click',()=>location.reload());
$('leave').addEventListener('click',async()=>{if(!net)return;try{await net.removePlayer(net.uid);sessionStorage.removeItem(sessionKey);joined=false;seen=false;render();}catch(e){error(e);}});
function release(){
  if(!holding)return;
  const h=holding;holding=null;$(h.k==='x'?'right':'back').classList.remove('held');
  sentTurn=h.turn+':'+h.k;
  const dur=Math.min(10000,Math.max(0,Math.round(performance.now()-h.start)));
  net.setPlayer({ev:{n:++sequence,k:h.k,down:false,dur,turn:h.turn}}).catch(error);render();
}
function beginHold(k){
  const button=$(k==='x'?'right':'back');
  if(holding||button.disabled||!net||!data)return false;
  holding={k,start:performance.now(),turn:data.turn};button.classList.add('held');navigator.vibrate?.(25);
  net.setPlayer({ev:{n:++sequence,k,down:true,dur:0,turn:data.turn}}).catch(error);
  return true;
}
for(const [id,k] of [['right','x'],['back','z']]){
  const button=$(id);const down=()=>beginHold(k);
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(button.disabled)return;button.setPointerCapture(e.pointerId);down();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
  button.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();down();}});
  button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();release();}});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
controls=installControlSwitch({mount:$('controller-controls'),buttons:[$('right'),$('back')],
  getState:()=>({phase:data?.phase,enabled:!!(net&&data&&data.cur?.id===net.uid&&navigator.onLine&&!stopped&&sentTurn!==data.turn+':'+data.phase&&(data.phase==='x'||data.phase==='z'))}),
  onDown:beginHold,onUp:release,
});
addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
addEventListener('offline',()=>{$('connection-message').textContent='通信が切れています。つなぎ直しています…';release();render();});
addEventListener('online',()=>{$('connection-message').textContent='';render();});
if(!room){show('unavailable');$('retry').hidden=true;}
else connectRoom(room,'controller',error).then(n=>{
  net=n;sequence=Date.now();net.onRoom(r=>{data=r;render();});
  setInterval(()=>{
    render();if(joined&&seen&&data&&(data.cur?.id===net.uid||data.queue.some(p=>p.id===net.uid)))net.setPlayer({}).catch(error);
  },60000);
}).catch(error);
