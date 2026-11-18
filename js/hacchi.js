// 提供された4種類のはっちーを、画像テクスチャを使わず立体で表現する。
import * as THREE from 'three';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

const sphere = new THREE.SphereGeometry(1, 20, 14);
const cube = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
const materials = {};
function material(name, color, extra = {}) {
  return materials[name] ||= new THREE.MeshStandardMaterial({color, roughness: .83, ...extra});
}
const red=material('hood',0x791f24), redLight=material('cuff',0x922e30);
const cream=material('face',0xffe7ad), yellow=material('hair',0xffd52d);
const gold=material('crest',0xffd32e,{roughness:.42,metalness:.15});
const black=material('ink',0x28201d), steel=material('steel',0xb8c3c0,{metalness:.55,roughness:.36});
const brown=material('belt',0xa67640), pink=material('pink',0xf8aabe);
const glass=material('glass',0x8fc2c9,{transparent:true,opacity:.39,depthWrite:false,roughness:.2});
const templates=new Map();
function mesh(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){
  const o=new THREE.Mesh(geometry,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);
  parent.add(o);return o;
}
function oval(p,m,x,y,z,sx,sy,sz){return mesh(p,sphere,m,x,y,z,sx,sy,sz);}
function box(p,m,x,y,z,sx,sy,sz){return mesh(p,cube,m,x,y,z,sx,sy,sz);}
function rod(p,m,start,end,r){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),v=b.clone().sub(a);
  const o=mesh(p,cylinder,m,...a.clone().add(b).multiplyScalar(.5).toArray(),r,v.length(),r);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;
}
function line(p,m,points,r=.012){
  const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));
  return mesh(p,new THREE.TubeGeometry(curve,Math.max(8,points.length*5),r,6,false),m);
}
function flatShape(p,m,draw,x=0,y=0,z=0,depth=.04){
  const shape=new THREE.Shape();draw(shape);
  return mesh(p,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.012,curveSegments:10}),m,x,y,z);
}
function crest(parent,x,y,z,scale=1){
  const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);parent.add(group);
  mesh(group,new THREE.TorusGeometry(.238,.012,6,36),steel,0,.005,.012);
  flatShape(group,gold,s=>{
    s.moveTo(-.195,.17);s.lineTo(-.055,.105);s.lineTo(0,.025);s.lineTo(.055,.105);s.lineTo(.195,.17);
    s.lineTo(.115,-.025);s.lineTo(.04,-.06);s.lineTo(.165,-.115);s.lineTo(.07,-.15);
    s.lineTo(0,-.09);s.lineTo(-.07,-.15);s.lineTo(-.165,-.115);s.lineTo(-.04,-.06);s.lineTo(-.115,-.025);s.closePath();
  },0,0,.025,.035);
  line(group,black,[[-.15,-.105,.085],[0,-.065,.085],[.15,-.105,.085]],.008);
  line(group,black,[[-.16,.14,.082],[-.07,.04,.082],[0,.005,.082],[.07,.04,.082],[.16,.14,.082]],.007);
  for(const side of [-1,1])line(group,steel,[[side*.19,.1,0],[side*.22,.23,-.015],[side*.18,.32,-.04]],.016);
  return group;
}
function hand(p,start,end){rod(p,red,start,end,.115);oval(p,redLight,...end,.12,.13,.115);}
function body(g,kind,pose){
  // 背中まで丸い赤いフード。顔・前髪・目はそれぞれ独立した立体。
  oval(g,red,0,.79,-.025,.46,.68,.36);
  oval(g,red,0,1.69,-.035,.72,.72,.6);
  oval(g,yellow,0,1.72,.25,.615,.615,.37);
  oval(g,cream,0,1.61,.445,.535,.535,.295);
  for(const side of [-1,1]){
    oval(g,red,side*.265,.17,.09,.225,.17,.31);
    oval(g,redLight,side*.27,.21,.31,.18,.095,.1);
  }
  // 頬から離れたカーブと厚みのある前髪。
  flatShape(g,yellow,s=>{
    s.moveTo(-.28,2.14);s.bezierCurveTo(-.04,2.33,.25,2.25,.35,2.08);
    s.bezierCurveTo(.2,2.13,.04,1.89,-.17,1.77);s.bezierCurveTo(-.12,1.97,-.17,2.04,-.28,2.14);
  },0,0,.704,.038);
  flatShape(g,yellow,s=>{
    s.moveTo(-.3,2.15);s.bezierCurveTo(-.55,2.08,-.65,1.68,-.47,1.33);
    s.bezierCurveTo(-.54,1.78,-.28,1.92,-.3,2.15);
  },0,0,.635,.04);
  flatShape(g,yellow,s=>{
    s.moveTo(.28,2.14);s.bezierCurveTo(.57,2.05,.65,1.65,.47,1.3);
    s.bezierCurveTo(.5,1.69,.42,1.91,.28,2.14);
  },0,0,.635,.04);
  for(const side of [-1,1])oval(g,black,side*.205,1.58,.723,.047,.061,.027);
  line(g,black,[[-.085,1.375,.72],[0,1.348,.735],[.085,1.38,.72]],.012);
  // 布の縫い目と、帽子の黄色い兜飾り。
  line(g,redLight,[[-.42,2.23,-.16],[0,2.39,-.22],[.42,2.23,-.16]],.009);
  crest(g,0,2.27,.76,.96);
  if(kind!=='mechanical'){
    mesh(g,new THREE.TorusGeometry(.415,.043,7,28),brown,0,.57,0,1,1,.78).rotation.x=Math.PI/2;
    oval(g,brown,.445,.46,.18,.115,.21,.105);
    box(g,gold,0,.57,.345,.13,.09,.025);
  }
  // すべてのコースに、はっちーらしい短い手足を付ける。
  const wave=pose===1;
  if(kind==='electric'){
    hand(g,[-.37,1.04,.01],[-.48,wave?1.32:.89,.33]);
    hand(g,[.37,1.03,.01],[.49,pose===2?1.22:.99,.32]);
    line(g,black,[[-.65,.97,.39],[-.25,.87,.48],[.12,.88,.47],[.48,1.0,.38],[.7,1.12,.28]],.023);
    flatShape(g,gold,s=>{s.moveTo(0,.16);s.lineTo(-.08,.015);s.lineTo(-.015,.025);s.lineTo(-.04,-.12);s.lineTo(.09,.06);s.lineTo(.02,.04);s.closePath();},.7,1.12,.32,.018);
  }else if(kind==='mechanical'){
    hand(g,[-.37,1.03,.02],[-.44,.91,.44]);hand(g,[.37,1.03,.02],[.47,.87,.44]);
    // 溶接用の保護メガネ。レンズを透かして、目と顔が見える。
    line(g,black,[[-.6,1.66,.34],[-.7,1.68,-.05],[-.6,1.67,-.38]],.035);
    line(g,black,[[.6,1.66,.34],[.7,1.68,-.05],[.6,1.67,-.38]],.035);
    const visor=new THREE.Shape();
    visor.moveTo(-.52,-.12);visor.quadraticCurveTo(-.5,-.23,-.32,-.23);visor.lineTo(.32,-.23);visor.quadraticCurveTo(.5,-.23,.52,-.12);visor.lineTo(.55,.17);visor.lineTo(-.55,.17);visor.closePath();
    mesh(g,new THREE.ShapeGeometry(visor,12),glass,0,1.64,.8);
    line(g,steel,[[-.55,1.81,.8],[-.52,1.52,.8],[-.33,1.41,.8],[.33,1.41,.8],[.52,1.52,.8],[.55,1.81,.8]],.025);
    rod(g,steel,[-.55,1.81,.8],[.55,1.81,.8],.025);
    const shield=new THREE.Group();shield.position.set(-.47,.87,.59);shield.rotation.z=.23;g.add(shield);
    box(shield,black,0,0,0,.43,.52,.09);box(shield,steel,0,.075,.058,.3,.19,.025);box(shield,glass,0,.075,.078,.24,.13,.012);
    rod(g,black,[.43,.96,.51],[.54,.6,.63],.066);rod(g,steel,[.54,.6,.63],[.37,.42,.78],.034);
    line(g,black,[[.48,.83,.25],[.76,.57,.04],[.73,.25,-.23],[1,.18,-.35]],.018);
    // 足元の小さな鋼材と火花。
    box(g,steel,0,.105,.64,1.18,.07,.28);box(g,steel,0,.23,.64,1.18,.07,.28);box(g,steel,0,.17,.64,1.18,.13,.045);
    for(const [dx,dy] of [[-.1,.11],[.08,.13],[.15,.05]])rod(g,gold,[.36,.39,.79],[.36+dx,.39+dy,.79],.014);
  }else if(kind==='chemical'){
    hand(g,[-.37,1.05,.01],[-.68,wave?1.25:1.11,.21]);hand(g,[.37,1.03,.01],[.4,.8,.3]);
    const flask=new THREE.Group();flask.position.set(-.73,wave?1.05:.91,.3);flask.rotation.z=-.17;g.add(flask);
    mesh(flask,new THREE.CylinderGeometry(.07,.19,.3,20),pink,0,0,0);
    rod(flask,pink,[0,.14,0],[0,.32,0],.058);mesh(flask,new THREE.TorusGeometry(.065,.012,6,20),cream,0,.32,0).rotation.x=Math.PI/2;
    for(let i=0;i<3;i++)box(flask,black,-.025,.03-i*.055,.16,.06-i*.01,.008,.012);
    // 参照イラストの胸元の小さな飾り。
    crest(g,.22,1.05,.37,.48);
    oval(g,material('water',0x6ac4c7),.44,2.33,.13,.045,.1,.035);
  }else if(kind==='power'){
    hand(g,[-.38,1.02,.01],[-.61,1.24,.27]);hand(g,[.38,1.03,.01],[.53,1.38,.24]);
    crest(g,.21,.99,.36,.47);
    rod(g,material('handle',0x33a9b4),[.46,1.4,.34],[.58,1.56,.34],.055);
    rod(g,steel,[.58,1.56,.34],[.83,1.91,.32],.022);
    // 背面から伸びるプラグと電線も、立体で見える。
    line(g,black,[[.38,.55,-.2],[.74,.55,-.32],[.87,.87,-.28],[1.02,.87,-.18]],.021);
    const plug=box(g,black,1.03,.89,-.18,.16,.13,.1);plug.rotation.z=-.4;
    rod(g,steel,[1.0,.94,-.18],[1.02,1.04,-.18],.012);rod(g,steel,[1.07,.91,-.18],[1.1,1.01,-.18],.012);
    oval(g,redLight,-.04,.69,-.31,.36,.54,.16);
  }
  // 後ろ姿にも、フードの合わせ目と足の丸みが残る。
  line(g,redLight,[[0,1.96,-.626],[0,1.47,-.6],[0,1.17,-.4]],.009);
}

function makeTemplate(kind,pose){
  const source=new THREE.Group();body(source,kind,pose);source.scale.setScalar(.86);source.updateMatrixWorld(true);
  const buckets=new Map();
  source.traverse(o=>{
    if(!o.isMesh)return;
    if(!buckets.has(o.material))buckets.set(o.material,[]);
    const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    buckets.get(o.material).push(geometry.applyMatrix4(o.matrixWorld));
  });
  const result=new THREE.Group();
  for(const [mat,geometries] of buckets){
    const merged=mergeGeometries(geometries,false);
    if(!merged)throw new Error('はっちーの立体を作成できませんでした');
    geometries.forEach(g=>g.dispose());
    const part=new THREE.Mesh(merged,mat);part.castShadow=!mat.transparent;part.receiveShadow=true;result.add(part);
  }
  const bounds=new THREE.Box3().setFromObject(result);
  result.userData={r:kind==='power'?.77:.73,h:bounds.max.y,kind,pose,isHacchi:true};
  return result;
}
export function buildHacchi(kind,{pose=0}={}){
  const key=kind+':'+pose;
  if(!templates.has(key))templates.set(key,makeTemplate(kind,pose));
  return templates.get(key).clone(true);
}

export function makeHacchiThumbnails(kinds){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(144,144);renderer.setPixelRatio(1);
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0xb9a689,2.4));
  const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(-3,5,6);scene.add(light);
  const camera=new THREE.PerspectiveCamera(32,1,.1,20);camera.position.set(1.1,2.2,5.1);camera.lookAt(0,1.12,0);
  const images=new Map();
  for(const kind of kinds){const model=buildHacchi(kind);scene.add(model);renderer.render(scene,camera);images.set(kind,renderer.domElement.toDataURL('image/png'));scene.remove(model);}
  renderer.dispose();renderer.forceContextLoss();return images;
}
