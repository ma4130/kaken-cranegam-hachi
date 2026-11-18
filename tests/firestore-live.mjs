// 専用プロジェクトに一時テスト部屋を作成。作成したデータとテスト用認証だけを後片付けする。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { firebaseConfig as config } from '../js/firebase-config.js';
assert.equal(config.projectId,'kaken-cranegam-hachi');
const base=`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
const authBase='https://identitytoolkit.googleapis.com/v1/accounts:';
const accounts=[];
async function account(){
  const response=await fetch(authBase+'signUp?key='+config.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
  assert.equal(response.status,200,'匿名認証');const user=await response.json();accounts.push(user);return user;
}
function field(value){
  if(value===null)return {nullValue:null};if(value instanceof Date)return {timestampValue:value.toISOString()};
  if(Array.isArray(value))return {arrayValue:{values:value.map(field)}};
  if(typeof value==='string')return {stringValue:value};if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number')return {integerValue:String(value)};
  return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,field(v)]))}};
}
async function request(user,path,method='GET',body){
  return fetch(base+'/'+path,{method,headers:{Authorization:'Bearer '+user.idToken,'Content-Type':'application/json'},body:body?JSON.stringify({fields:field(body).mapValue.fields}):undefined});
}
const room='RULETEST'+randomUUID().replaceAll('-','').slice(0,8),path='hachi_rooms/'+room,epoch=randomUUID();
let host,player,created=false,playerCreated=false;
const checks=[];
async function check(label,response,expected){assert.equal(response.status,expected,label);checks.push(label);}
try{
  host=await account();player=await account();
  const response=await request(host,path,'PATCH',{ownerUid:host.localId,expiresAt:new Date(Date.now()+3600000),epoch,phase:'idle',queue:[],cur:null,last:null,turn:'',t:Date.now()});
  await check('ホストが新しい部屋を作れる',response,200);created=true;
  await check('参加者は部屋の状態を読める',await request(player,path),200);
  await check('部屋の一覧は公開しない',await request(player,'hachi_rooms'),403);
  await check('参加者は部屋の進行を書き換えられない',await request(player,path+'?updateMask.fieldPaths=phase','PATCH',{phase:'auto'}),403);
  const data={name:'確認用',epoch,join:Date.now(),ping:Date.now(),ev:{n:1,k:'x',down:false,dur:0,turn:''}};
  await check('他の参加者のデータは書けない',await request(player,path+'/players/'+host.localId,'PATCH',data),403);
  await check('長すぎる名前は拒否する',await request(player,path+'/players/'+player.localId,'PATCH',{...data,name:'123456789'}),403);
  await check('別セッションの参加は拒否する',await request(player,path+'/players/'+player.localId,'PATCH',{...data,epoch:'wrong'}),403);
  await check('自分の参加データを作れる',await request(player,path+'/players/'+player.localId,'PATCH',data),200);playerCreated=true;
  await check('参加者は参加者一覧を取得できない',await request(player,path+'/players'),403);
  await check('ホストは順番待ちを取得できる',await request(host,path+'/players'),200);
  await check('不正な操作時間は拒否する',await request(player,path+'/players/'+player.localId,'PATCH',{...data,ev:{...data.ev,dur:10001}}),403);
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{
  if(playerCreated)await check('一時参加データを削除',await request(host,path+'/players/'+player.localId,'DELETE'),200);
  if(created)await check('一時部屋を削除',await request(host,path,'DELETE'),200);
  for(const user of accounts)await fetch(authBase+'delete?key='+config.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:user.idToken})});
}
