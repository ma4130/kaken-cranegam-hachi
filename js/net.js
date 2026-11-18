// はっちー専用プロジェクトのみを使用する。元ゲームの設定は読み込まない。
import { firebaseConfig } from './firebase-config.js';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
export async function connectRoom(room, role, onError) {
  const [{initializeApp,getApps,getApp},authSDK,fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),import(`${SDK}/firebase-auth.js`),import(`${SDK}/firebase-firestore.js`),
  ]);
  if(firebaseConfig.projectId !== 'kaken-cranegam-hachi') throw new Error('専用プロジェクトの設定を確認してください');
  const exists=getApps().some(app=>app.name===role);
  const app=exists?getApp(role):initializeApp(firebaseConfig,role);
  const auth=exists?authSDK.getAuth(app):authSDK.initializeAuth(app,{persistence:authSDK.browserSessionPersistence});
  await auth.authStateReady();
  const user=auth.currentUser || (await authSDK.signInAnonymously(auth)).user;
  const db=fs.getFirestore(app),ref=fs.doc(db,'hachi_rooms',room);
  const players=fs.collection(ref,'players');
  let tail=Promise.resolve();
  // ボタンの押下・解放を必ず同じ順番で送る。失敗を成功扱いにしない。
  const write=fn=>{const result=tail.then(fn);tail=result.catch(onError);return result;};
  return {
    uid:user.uid,
    create: data => fs.setDoc(ref,{...data,ownerUid:user.uid,expiresAt:fs.Timestamp.fromMillis(Date.now()+23*60*60*1000)}),
    setRoom: data => write(()=>fs.updateDoc(ref,data)),
    onRoom: cb=>fs.onSnapshot(ref,s=>cb(s.exists()?s.data():null),onError),
    onPlayers: cb=>fs.onSnapshot(players,s=>cb(Object.fromEntries(s.docs.map(d=>[d.id,d.data()]))),onError),
    setPlayer: data=>write(()=>fs.setDoc(fs.doc(players,user.uid),{...data,ping:Date.now()},{merge:true})),
    removePlayer: id=>write(()=>fs.deleteDoc(fs.doc(players,id))),
  };
}
