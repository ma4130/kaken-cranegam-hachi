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
function error(e){console.error(e);$('connection-message').textContent='接続できませんでした。通信を確認して「もう一度つなぐ」を押してください。';stopped=true;show('unavailable');}
function render(){
  if(stopped)return;
  if(!data || Date.now()-data.t>150000){show('unavailable');return;}
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
    $('instruction').textContent=data.phase==='free'?'自由に動かそう':data.phase==='x'?'① よこに動かそう':data.phase==='z'?'② おくに動かそう':'つかめるかな…？';
    $('remaining').textContent='のこり '+data.cur.left+' 回';
    controls?.sync();
    if(controls?.getMode()==='stick'&&data.phase==='x'&&sentTurn!==data.turn+':mode'){sentTurn=data.turn+':mode';sendStick(100);}
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
let stickVector={x:0,z:0};
function sendStick(code){if(!net||!data||data.cur?.id!==net.uid)return;net.setPlayer({ev:{n:++sequence,k:'x',down:true,dur:code,turn:data.turn}}).catch(error);}
setInterval(()=>{if(controls?.getMode()==='stick'&&data?.phase==='free'&&(stickVector.x||stickVector.z))sendStick(101+(stickVector.x+1)+(stickVector.z+1)*3);},1000);
controls=installControlSwitch({mount:$('controller-controls'),buttons:[],
  getState:()=>({phase:data?.phase,enabled:!!(net&&data&&data.cur?.id===net.uid&&navigator.onLine&&!stopped&&sentTurn!==data.turn+':'+data.phase&&['x','z','free'].includes(data.phase))}),
  onMode:mode=>sendStick(mode==='stick'?100:111),
  onVector:(x,z)=>{stickVector={x,z};sendStick(101+(x+1)+(z+1)*3);},
  onGrab:()=>sendStick(110),
});
addEventListener('offline',()=>{$('connection-message').textContent='通信が切れています。つなぎ直しています…';render();});
addEventListener('online',()=>{$('connection-message').textContent='';render();});
if(!room){show('unavailable');$('retry').hidden=true;}
else connectRoom(room,'controller',error).then(n=>{
  net=n;sequence=Date.now();net.onRoom(r=>{data=r;render();});
  setInterval(()=>{
    render();if(joined&&seen&&data&&(data.cur?.id===net.uid||data.queue.some(p=>p.id===net.uid)))net.setPlayer({}).catch(error);
  },60000);
}).catch(error);
