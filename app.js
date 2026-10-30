'use strict';
(() => {
const $ = id => document.getElementById(id);
const {tr} = WaveI18n;
const TAU = 2 * Math.PI;
const configurations = {
 transverse:{min:.5,max:3,step:.1,f:1,v:4,unit:'Hz',factor:1,timeUnit:'s',timeFactor:1,rate:.25,window:4,get caption(){return tr('Příčné mechanické vlnění')},get legend(){return tr('Výchylka struny')},get note(){return tr('Oranžová částice kmitá na místě. Vlna přenáší energii směrem doprava.')},amplitudeUnit:'m'},
 sound:{min:40,max:240,step:10,f:80,v:340,unit:'Hz',factor:1,timeUnit:'ms',timeFactor:1000,rate:.004,window:.05,get caption(){return tr('Podélné mechanické vlnění')},get legend(){return tr('Částice vzduchu')},get note(){return tr('Částice vzduchu kmitají podél směru šíření. Postupují oblasti zhuštění a zředění, ne částice od zdroje až k uchu.')},amplitudeUnit:'mm'},
 em:{min:50,max:300,step:10,f:100,v:299792458,unit:'MHz',factor:1e6,timeUnit:'ns',timeFactor:1e9,rate:4e-9,window:40e-9,get caption(){return tr('Lineárně polarizovaná vlna ve vakuu')},get legend(){return tr('Elektrické pole E')},get note(){return tr('Elektrické pole E a magnetické pole B kmitají ve fázi, kolmo na sebe i na směr šíření. Oranžový bod sleduje hodnotu E v místě, nikoli částici.')},amplitudeUnit:'V/m'}
};
const state = {mode:'transverse',emView:'linear',f:1,v:4,a:.4,phi:0,probe:4,time:0,running:!matchMedia('(prefers-reduced-motion: reduce)').matches,slow:false};
let scene, camera, renderer, orbit, wave, magnetic, curtain, points, reference, probeSphere, probeGuide, rulerGroup, lambdaGroup, lambdaLabel, baseGroup, probeRing, sourceSphere, shellGroup, grid, axisLabel, fieldArrows=[], shells=[];
let graphicsReady=false, lastFrame=0, labelTextures=[];
const fmt=(v,d=2)=>v.toLocaleString(WaveI18n.locale(),{maximumFractionDigits:d,minimumFractionDigits:d});
const cfg=()=>configurations[state.mode];
const frequency=()=>state.f*cfg().factor;
const wavelength=()=>state.v/frequency();
const phaseAt=(x,t=state.time)=>TAU*(frequency()*t-x/wavelength())+state.phi;
const sample=(x,t=state.time)=>(spherical()?1:state.a)*Math.sin(phaseAt(x,t));
const realAmplitude=()=>state.a*(state.mode==='sound'?.001:1);
const circular=()=>state.mode==='em'&&state.emView==='circular';
const spherical=()=>state.mode==='em'&&state.emView==='wavefronts';
const byMode=()=>spherical()?'sin θ':circular()?'Eᵧ':state.mode==='em'?'E':'u';
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,4000);}
function modal(title,html){$('dialog-title').textContent=title;$('dialog-body').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();closeMenu();}
$('close-dialog').onclick=()=>$('dialog').close();
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}});
function closeMenu(){$('menu').hidden=true;$('menu-button').setAttribute('aria-expanded','false');}
$('menu-button').onclick=()=>{const open=$('menu').hidden;$('menu').hidden=!open;$('menu-button').setAttribute('aria-expanded',String(open));};
document.addEventListener('click',e=>{if(!e.target.closest('#menu')&&!e.target.closest('#menu-button'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('menu').hidden){closeMenu();$('menu-button').focus();}});
function updateReadouts(){
 const c=cfg(),f=frequency(),l=wavelength();
 $('frequency-value').textContent=`${fmt(state.f, state.mode==='transverse'?1:0)} ${c.unit}`;
 $('f-min').textContent=`${fmt(c.min,c.min%1?1:0)} ${c.unit}`;$('f-max').textContent=`${c.max} ${c.unit}`;
 $('period-value').textContent=`${fmt(c.timeFactor/f)} ${c.timeUnit}`;
 $('wavelength-value').textContent=`${fmt(l)} m`;
 $('amplitude-value').textContent=`${fmt(state.a)} ${c.amplitudeUnit}`;
 $('phase-value').textContent=`${Math.round(state.phi*180/Math.PI)}°`;
 $('probe-value').textContent=`${fmt(state.probe,1)} m`;
 $('velocity-value').textContent=state.mode==='em'?'299 792 458 m/s':`${fmt(state.v,state.v%1?1:0)} m/s`;
 $('frequency-explanation').textContent=state.mode==='em'?tr`${fmt(state.f,0)} milionů kmitů za sekundu.`:tr`${fmt(state.f,state.f%1?1:0)} ${WaveI18n.language()==='en'?(state.f===1?'oscillation':'oscillations'):(Number.isInteger(state.f)?(state.f===1?'celý kmit':state.f>=2&&state.f<=4?'kmity':'kmitů'):'kmitu')} za sekundu.`;
 $('relationship').textContent=state.mode==='em'?`c ≈ ${fmt(l)} m × ${state.f} MHz`:`${fmt(state.v,1)} m/s ≈ ${fmt(l)} m × ${fmt(state.f,1)} Hz`;
 $('rate-note').textContent=state.mode==='em'?tr`Zpomalený model: 1 s animace = ${fmt(c.rate*c.timeFactor/(state.slow?4:1),1)} ns děje. Pole E a B mají samostatná měřítka; jejich výšky nelze přímo porovnávat.`:tr`Zpomalený model: 1 s animace = ${fmt(c.rate*c.timeFactor/(state.slow?4:1),state.mode==='sound'?0:3)} ${c.timeUnit} děje.${state.mode==='sound'?tr(' Výchylka částic je pro viditelnost zvětšena 300×.'):tr(' Svislé měřítko výchylky ve 3D je zvětšeno 3×.')}`;
 $('time-caption').textContent=tr`Jeden kmit trvá T = ${fmt(c.timeFactor/f)} ${c.timeUnit}. Celá osa ukazuje ${fmt(c.window*c.timeFactor,0)} ${c.timeUnit}.`;
 $('physical-note').textContent=c.note;
 $('mode-caption').textContent=c.caption;$('wave-legend').textContent=c.legend;$('field-legend').hidden=state.mode!=='em';
 $('velocity').disabled=state.mode!=='transverse';
 $('velocity-note').textContent=state.mode==='em'?tr('Ve vakuu je rychlost světla c konstantní.'):state.mode==='sound'?tr('Model vzduchu s pevnou rychlostí zvuku 340 m/s.'):tr('Model struny: změnou rychlosti zkoumáš jiné prostředí.');
 $('particles').disabled=state.mode==='em';$('intro-probe').textContent=state.mode==='em'?tr('V prostoru sleduje hodnotu pole. V grafu ukazuje její průběh. Na kružnici její fáze oběhne jednu otáčku.'):tr('V prostoru kmitá. V grafu píše svůj příběh. Na kružnici jeho fáze oběhne jednu otáčku.');
 updateEMReadouts();
 $('play').textContent=state.running?tr('Pozastavit'):tr('Spustit');
 if(graphicsReady) rebuildMeasurements();
}
function updateEMReadouts(){
 const em=state.mode==='em',circ=circular(),sphere=spherical();
 $('em-views').hidden=!em;
 document.querySelectorAll('[data-em-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emView===state.emView)));
 $('amplitude').disabled=sphere;$('reference').disabled=sphere;
 $('amplitude-value').textContent=sphere?tr('Nezobrazuje se'):`${fmt(state.a)} ${cfg().amplitudeUnit}`;
 $('amplitude-note').textContent=sphere?tr('Vlnoplochy ukazují pouze fázi. Jas slupek nevyjadřuje intenzitu záření.'):tr('Větší amplituda nemění frekvenci.');
 $('probe-label').textContent=sphere?tr('Vzdálenost od zdroje'):tr('Sledované místo');$('probe-symbol').textContent=sphere?'r₀':tr('x₀');
 $('polar-caption').textContent=circ?tr('Zde kružnice ukazuje otáčení konce vektoru E v rovině yz. Žádná částice po ní neobíhá.'):sphere?tr('Kružnice je pomocný ukazatel fáze v označené vzdálenosti od zdroje.'):tr('Kružnice je matematická pomůcka. Částice neobíhá po kruhu.');
 $('polar-title').textContent=circ?tr('Otáčení elektrického pole'):sphere?tr('Fáze v místě'):tr('Kmit jako otáčení');
 $('time-title').textContent=circ?tr('Složka Eᵧ v čase'):sphere?tr('Fáze v čase'):tr('Kmit v čase');
 $('time-canvas').setAttribute('aria-label',sphere?tr('Graf sinusu fáze ve sledované vzdálenosti. Nezobrazuje intenzitu záření.'):tr`Časový graf ${byMode()} ve sledovaném místě s označenou periodou T.`);
 $('polar-canvas').setAttribute('aria-label',circ?tr('Pohled na otáčení elektrického pole v rovině yz. Vodorovná složka Ez, svislá Ey.'):tr('Polární ukazatel fáze; svislý průmět odpovídá časovému grafu.'));
 if(circ){
  $('mode-caption').textContent=tr('Kruhová polarizace ve vakuu');
  $('physical-note').textContent=tr('Šroubovice spojuje konce vektorů E v různých místech ve stejném čase. V jednom místě se E otáčí po kružnici. Není to vlákno ani dráha fotonu.');
  $('intro-probe').textContent=tr('Oranžový bod je konec vektoru E v jednom místě. Graf ukazuje jeho složku Eᵧ, kružnice otáčení celého vektoru.');
  $('wave-legend').textContent=tr('Konce vektorů E');
 }
 if(sphere){
  $('mode-caption').textContent=tr('Schéma stejné fáze od zdroje');
  $('wave-legend').textContent=tr('Stejná fáze: sin θ = 1');$('field-legend').hidden=true;
  $('physical-note').textContent=tr('Rozpínající se slupky označují stejnou fázi vlny; jejich rozestup je λ. Nejsou to bubliny hmoty ani jednotlivé fotony. Jde o schéma vlnoploch, nikoli úplné pole antény.');
  $('intro-probe').textContent=tr('Oranžový bod označuje pevnou vzdálenost od zdroje. Jedna slupka za periodu T projde tímto místem; níže sleduješ fázi.');
  $('rate-note').textContent=tr`Zpomalený model: 1 s animace = ${fmt(cfg().rate*1e9/(state.slow?4:1),1)} ns děje. Barva a průhlednost slupek slouží čitelnosti, ne měření intenzity.`;
  $('time-caption').textContent=tr`Graf sin θ ukazuje jen fázi. Slupka projde bodem při sin θ = 1, jednou za T = ${fmt(1e9/frequency())} ns.`;
 }
}
document.querySelectorAll('[data-em-view]').forEach(b=>b.onclick=()=>{state.emView=b.dataset.emView;updateReadouts();setView('3d');});
$('em-explanation').onclick=()=>modal(tr('Šroubovice a bubliny: co opravdu vidíme?'),tr`<p><b>Frekvence není tvar.</b> Je to počet opakování děje za sekundu. Tvar obrázku závisí na tom, kterou vlastnost vlny zobrazujeme.</p><p><b>Lineární polarizace:</b> elektrické pole v jednom místě kmitá podél přímky. Spojené konce jeho vektorů vytvoří sinusovku.</p><p><b>Kruhová polarizace:</b> směr E se otáčí, jeho velikost zůstává A. Konce vektorů podél směru šíření vytvoří v jednom okamžiku šroubovici. To není trajektorie fotonu.</p><p class="math">Eᵧ = A sin θ, E_z = A cos θ</p><p><b>Kulové vlnoplochy:</b> každá slupka spojuje místa se stejnou fází. Rozestup je λ a slupky se vzdalují rychlostí c. Je to schéma šíření od lokalizovaného zdroje v homogenním prostředí, použitelné daleko od zdroje. Skutečná anténa obvykle vyzařuje různě do různých směrů; toto schéma nezobrazuje její vektorové pole ani blízkou oblast.</p><p>Šroubovice popisuje <b>polarizaci</b>, slupky <b>geometrii vlnoploch</b>. Nejsou to dvě alternativní teorie světla. Ani jeden obrázek neznamená, že světlo tvoří řetízek bublin.</p><p><a href="https://farside.ph.utexas.edu/teaching/jk1/Electromagnetism/node72.html" target="_blank" rel="noopener">Polarizace: University of Texas</a> · <a href="https://phys.libretexts.org/Bookshelves/Electricity_and_Magnetism/Electromagnetics_I_%28Ellingson%29/09%3A_Plane_Waves_in_Loseless_Media/9.03%3A_Types_of_Waves" target="_blank" rel="noopener">Vlnoplochy: S. Ellingson</a></p>`);
function setMode(mode){state.mode=mode;state.f=cfg().f;state.v=cfg().v;state.time=0;
 const c=cfg();Object.assign($('frequency'),{min:c.min,max:c.max,step:c.step,value:c.f});$('velocity').value=state.v;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));updateReadouts();}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);setView('3d');});
for(const [id,key] of [['frequency',tr('f')],['amplitude','a'],['probe','probe'],['velocity',tr('v')]])$(id).addEventListener('input',()=>{state[key]=Number($(id).value);if(id==='frequency'||id==='velocity')state.time=0;updateReadouts();});
$('phase').addEventListener('input',()=>{state.phi=Number($('phase').value)*Math.PI/180;updateReadouts();});
$('slow').onchange=()=>{state.slow=$('slow').checked;updateReadouts();};
$('play').onclick=()=>{state.running=!state.running;updateReadouts();};
$('step').onclick=()=>{state.running=false;state.time+=1/frequency()/8;updateReadouts();};
$('reset').onclick=()=>{Object.assign(state,{emView:'linear',a:.4,phi:0,probe:4,slow:false,running:!matchMedia('(prefers-reduced-motion: reduce)').matches});$('amplitude').value=.4;$('phase').value=0;$('probe').value=4;$('slow').checked=false;$('particles').checked=true;$('rulers').checked=true;$('reference').checked=false;setMode('transverse');setView('3d');closeMenu();};
function equationText(){if(spherical())return tr`θ(r,t) = 2π(ft − r/λ) + φ₀; λ = c/f = ${wavelength()} m. Slupky: sin θ = 1. Zobrazení fáze, nikoli intenzity.`;if(circular())return `E = (0, A sin θ, A cos θ); B = (0, −A cos θ/c, A sin θ/c); θ = 2π(ft − x/λ) + φ₀; A = ${state.a} V/m; f = ${frequency()} Hz; λ = ${wavelength()} m; φ₀ = ${state.phi} rad`;return `${byMode()}(x,t) = A sin(2π(ft − x/λ) + φ₀)\nf = ${frequency()} Hz; λ = ${wavelength()} m; v = ${state.v} m/s; A = ${realAmplitude()} ${state.mode==='em'?'V/m':'m'}; φ₀ = ${Math.round(state.phi*180/Math.PI)}°; T = ${1/frequency()} s`;}
$('copy').onclick=async()=>{closeMenu();try{await navigator.clipboard.writeText(equationText());notify(tr('Rovnice zkopírována.'));}catch{modal(tr('Rovnice ke zkopírování'),tr('<p>Vyber text a zkopíruj jej ručně.</p><pre id="copy-text" style="white-space:pre-wrap"></pre>'));$('copy-text').textContent=equationText();}};
$('equation-button').onclick=()=>{if(spherical()||circular()){ $('em-explanation').click();return;}modal(tr('Od kružnice k postupující vlně'),tr`<p class="math">${byMode()}(x,t) = A sin[2π(ft − x/λ) + φ₀]</p><p><b>A</b> určuje největší výchylku${state.mode==='em'?tr(' elektrického pole'):''}. <b>f</b> říká, kolikrát za sekundu se děj zopakuje. <b>λ</b> říká, po jaké vzdálenosti se opakuje tvar vlny. <b>φ₀</b> posune počáteční fázi.</p><p class="math">T = 1/f &nbsp;&nbsp; λ = v/f &nbsp;&nbsp; ω = 2πf</p><p>Pro sledované místo x₀ je úhel fázoru θ = 2π(ft − x₀/λ) + φ₀. Jeho poloměr r = A. Kartézské složky jsou A cos θ a A sin θ; svislý průmět je právě okamžitá hodnota v grafu.</p><p>Znaménko minus před x/λ znamená postup vlny ve směru kladné osy x. Při změně frekvence začíná čas znovu; porovnáváme ustálené vlny, ne přechod mezi nimi.</p>${state.mode==='em'?tr('<p>Pro rovinnou vlnu ve vakuu platí B₀ = E₀/c. Na 3D obrázku má B jiné měřítko než E, aby byla obě pole viditelná. Dvě sinusovky nejsou dráhy fotonů.</p>'):''}`);};
$('help').onclick=()=>modal(tr('Tři pohledy, jeden děj'),tr('<ol><li><b>Začni frekvencí.</b> Posuň ji nahoru. Částice nebo pole kmitají rychleji a vrcholy vlny jsou blíž u sebe.</li><li><b>Pozastav děj.</b> Oranžový bod ve 3D, bod na časovém grafu a svislý průmět fázoru mají stejnou hodnotu.</li><li><b>Krokuj po osmině periody.</b> Osm kroků znamená jeden celý kmit a jednu otáčku fázoru.</li><li><b>Otoč 3D pohled.</b> Na počítači táhni myší. Na mobilu táhni jedním prstem, stránku posouvej mimo scénu. Pro přesný pohled použij tlačítka Zepředu a Shora.</li></ol><p>Pokročilé možnosti odhalí amplitudu, fázi a místo měření. Klávesami šipek můžeš otočit zaměřenou 3D scénu, klávesami + a − přiblížit. Při zapnutém omezení pohybu v systému začíná animace pozastavená.</p>'));
$('about').onclick=()=>modal(tr('O programu'),tr('<p>Interaktivní laboratoř frekvence pro středoškolskou fyziku. Modeluje ideální harmonické vlnění bez útlumu a disperze.</p><p><b>Luděk Sušický</b><br>biolog, středoškolský a vysokoškolský učitel informatických předmětů</p><p>Verze 3.0 · 30. 10. 2026<br>Aplikace: MIT. 3D vykreslování: Three.js (licence MIT).</p>'));
// Reuse geometry buffers. Frequency never changes the frame rate or simulation clock scale.
function lineGeometry(count){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));return g;}
function tubeGeometry(){const g=lineGeometry(361*6);const ids=[];for(let i=0;i<360;i++)for(let j=0;j<6;j++){const a=i*6+j,b=i*6+(j+1)%6,c=a+6,d=b+6;ids.push(a,b,c,b,d,c);}g.setIndex(ids);return g;}
function setTube(array,i,x,y,magnetic,z=0){for(let j=0;j<6;j++){const u=.035*Math.cos(j/6*TAU),v=.035*Math.sin(j/6*TAU);array.set(magnetic?[x,z+u,y+v]:[x,y+u,z+v],(i*6+j)*3);}}
function label(text,color='#a9bdce',size=1){const source=WaveI18n.source(text);text=tr(source);const c=document.createElement('canvas'),ctx=c.getContext('2d');ctx.font='32px sans-serif';c.width=Math.ceil(ctx.measureText(text).width)+28;c.height=64;ctx.font='32px sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,c.width/2,43);const texture=new THREE.CanvasTexture(c);labelTextures.push(texture);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));s.scale.set(c.width/64*.65*size,.65*size,1);s.userData.label={source,color,size};return s;}
function segment(a,b,color,opacity=1){return new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));}
function setView(view){if(!graphicsReady)return;const sphere=spherical(),target=new THREE.Vector3(sphere?0:6,0,0);const positions=sphere?{'3d':[24,18,28],front:[0,0,40],top:[0,40,.01]}:{'3d':[11,4.8,9],front:[6,0,12],top:[6,12,.01]};camera.position.set(...positions[view]);if(camera.aspect<1.5){const v=camera.position.clone().sub(target).multiplyScalar(1.4);camera.position.copy(v.add(target));}orbit.maxDistance=sphere?70:29;orbit.minDistance=sphere?20:9;orbit.target.copy(target);orbit.update();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));}
function rebuildMeasurements(){if(!graphicsReady)return;const l=wavelength();lambdaGroup.scale.x=l;lambdaGroup.position.x=1;lambdaLabel.position.set(1+l/2,-1.5,0);lambdaLabel.visible=$('rulers').checked;}
function init3D(){
 try{
 if(!window.THREE)throw new Error('Three.js unavailable');
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,.1,100);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);$('stage').prepend(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
 orbit=new THREE.OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.enablePan=false;orbit.minDistance=9;orbit.maxDistance=29;orbit.maxPolarAngle=Math.PI*.9;orbit.target.set(6,0,0);
 scene.add(new THREE.AmbientLight(0xb9e7ff,.9));const light=new THREE.PointLight(0x9eefff,1.2);light.position.set(5,7,5);scene.add(light);
 grid=new THREE.GridHelper(14,28,0x294354,0x152b3c);grid.position.set(6,-1.25,0);scene.add(grid);
 baseGroup=new THREE.Group();scene.add(baseGroup);baseGroup.add(segment([0,0,0],[12.6,0,0],0x617c91));baseGroup.add(new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(12,0,0),.7,0x8caec4,.25,.13));
 axisLabel=label('x / m');axisLabel.position.set(12.1,-.7,0);baseGroup.add(axisLabel);
 rulerGroup=new THREE.Group();scene.add(rulerGroup);
 for(let x=0;x<=12;x+=2){rulerGroup.add(segment([x,-.08,0],[x,.08,0],0x90a8ba));const t=label(String(x),'#9aafc1',.65);t.position.set(x,-.38,0);rulerGroup.add(t);}
 rulerGroup.add(segment([0,-1,0],[0,1.9,0],0x486c80));const yl=label(tr('výchylka / pole'),'#a9bdce',.75);yl.position.set(0,2.1,0);rulerGroup.add(yl);
 const zl=label('z','#a9bdce',.6);zl.position.set(0,0,1.8);rulerGroup.add(zl);rulerGroup.add(segment([0,0,0],[0,0,1.5],0x486c80));
 wave=new THREE.Mesh(tubeGeometry(),new THREE.MeshStandardMaterial({color:0x66e1ef,emissive:0x1a899d,emissiveIntensity:.55,roughness:.3}));scene.add(wave);
 magnetic=new THREE.Mesh(tubeGeometry(),new THREE.MeshBasicMaterial({color:0xbaadff}));scene.add(magnetic);
 reference=new THREE.Line(lineGeometry(361),new THREE.LineDashedMaterial({color:0x9d8ec9,dashSize:.1,gapSize:.12,transparent:true,opacity:.6}));scene.add(reference);
 const ribbon=new THREE.BufferGeometry();ribbon.setAttribute('position',new THREE.BufferAttribute(new Float32Array(360*18),3));curtain=new THREE.Mesh(ribbon,new THREE.MeshBasicMaterial({color:0x4cd3e8,transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}));scene.add(curtain);
 points=new THREE.Points(lineGeometry(145),new THREE.PointsMaterial({color:0x89e6f1,size:.065,transparent:true,opacity:.88}));scene.add(points);
 probeSphere=new THREE.Mesh(new THREE.SphereGeometry(.13,20,16),new THREE.MeshBasicMaterial({color:0xffb48a}));scene.add(probeSphere);
 probeGuide=new THREE.Line(lineGeometry(2),new THREE.LineDashedMaterial({color:0xffb48a,transparent:true,opacity:.55,dashSize:.07,gapSize:.07}));scene.add(probeGuide);
 for(let i=0;i<25;i++){const e=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(i/2,0,0),1,0x66e1ef,.09,.05);const b=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(i/2,0,0),1,0xbaadff,.09,.05);scene.add(e,b);fieldArrows.push([e,b]);}
 lambdaGroup=new THREE.Group();lambdaGroup.add(segment([0,-1.3,0],[1,-1.3,0],0x66e1ef));lambdaGroup.add(segment([0,-1.2,0],[0,-1.4,0],0x66e1ef));lambdaGroup.add(segment([1,-1.2,0],[1,-1.4,0],0x66e1ef));scene.add(lambdaGroup);lambdaLabel=label(tr('λ'),'#66e1ef',.7);scene.add(lambdaLabel);
 const ringPoints=[];for(let i=0;i<=96;i++)ringPoints.push(new THREE.Vector3(0,Math.sin(i/96*TAU),Math.cos(i/96*TAU)));
 probeRing=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints),new THREE.LineBasicMaterial({color:0xffb48a,transparent:true,opacity:.6}));scene.add(probeRing);
 shellGroup=new THREE.Group();scene.add(shellGroup);
 const shellGeo=new THREE.SphereGeometry(1,48,24);
 const shellRingGeo=new THREE.BufferGeometry().setFromPoints(ringPoints);
 for(let i=0;i<16;i++){
  const group=new THREE.Group();const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,uniforms:{fade:{value:1}},vertexShader:'varying vec3 n;varying vec3 view;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);view=-p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'uniform float fade;varying vec3 n;varying vec3 view;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(view))),2.5);gl_FragColor=vec4(0.40,0.88,0.94,(0.018+0.4*rim)*fade);}'});group.add(new THREE.Mesh(shellGeo,mat));
  for(let j=0;j<3;j++){const line=new THREE.Line(shellRingGeo,new THREE.LineBasicMaterial({color:0x66e1ef,transparent:true,opacity:.3,depthWrite:false}));if(j===1)line.rotation.y=Math.PI/2;if(j===2)line.rotation.z=Math.PI/2;group.add(line);}shellGroup.add(group);shells.push(group);
 }
 sourceSphere=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshBasicMaterial({color:0xf5f7ff}));shellGroup.add(sourceSphere);
 const sourceLabel=label(tr('zdroj'),'#dceaf4',1.6);sourceLabel.position.set(0,-.9,0);shellGroup.add(sourceLabel);
 const radialLabel=label('r / m','#dceaf4',1.5);radialLabel.position.set(12.4,-1.2,0);shellGroup.add(radialLabel);
 graphicsReady=true;setView('3d');rebuildMeasurements();orbit.addEventListener('start',()=>document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false')));
 const resize=()=>{const w=$('stage').clientWidth,h=$('stage').clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);const selected=document.querySelector('[data-view][aria-pressed=true]');if(selected)setView(selected.dataset.view);};new ResizeObserver(resize).observe($('stage'));resize();
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();graphicsReady=false;$('fallback').hidden=false;});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{graphicsReady=true;$('fallback').hidden=true;});
 }catch(error){$('fallback').hidden=false;$('export').disabled=true;console.warn('3D fallback:',error.message);}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('stage').addEventListener('keydown',e=>{if(!graphicsReady)return;const delta={ArrowLeft:-.1,ArrowRight:.1};if(e.key in delta){const p=camera.position.clone().sub(orbit.target);p.applyAxisAngle(new THREE.Vector3(0,1,0),delta[e.key]);camera.position.copy(orbit.target).add(p);}else if(['ArrowUp','ArrowDown'].includes(e.key))camera.position.y+=e.key==='ArrowUp'?.6:-.6;else if(['+','=','-'].includes(e.key)){const p=camera.position.clone().sub(orbit.target).multiplyScalar(e.key==='-'?1.08:.92);camera.position.copy(orbit.target).add(p);}else return;e.preventDefault();orbit.update();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
$('export').onclick=()=>{closeMenu();if(!graphicsReady)return notify(tr('3D snímek nyní není dostupný.'));renderer.render(scene,camera);const out=document.createElement('canvas');out.width=renderer.domElement.width;out.height=renderer.domElement.height+100;const c=out.getContext('2d');c.fillStyle='#0c1a2b';c.fillRect(0,0,out.width,out.height);c.drawImage(renderer.domElement,0,70);c.fillStyle='#edf5f9';c.font='20px sans-serif';c.fillText(tr`Frekvence · ${$('mode-caption').textContent}`,20,28);c.font='15px sans-serif';c.fillText(`f = ${state.f} ${cfg().unit}    λ = ${fmt(wavelength())} m    t = ${fmt(state.time*cfg().timeFactor)} ${cfg().timeUnit}`,20,52);const link=document.createElement('a');link.download='frekvence.png';link.href=out.toDataURL('image/png');link.click();};
function update3D(){if(!graphicsReady)return;
 const isSound=state.mode==='sound',isEM=state.mode==='em',circ=circular(),sphere=spherical(),visualAmplitude=state.a*3;
 const positions=wave.geometry.attributes.position.array,bp=magnetic.geometry.attributes.position.array,rp=reference.geometry.attributes.position.array,cp=curtain.geometry.attributes.position.array;
 for(let i=0;i<=360;i++){const x=i/30,y=visualAmplitude*Math.sin(phaseAt(x)),ry=visualAmplitude*Math.sin(phaseAt(x)-state.phi);const z=circ?visualAmplitude*Math.cos(phaseAt(x)):0;setTube(positions,i,x,y,false,z);setTube(bp,i,x,y,true,-z);rp.set([x,ry,circ?visualAmplitude*Math.cos(phaseAt(x)-state.phi):0],i*3);if(i<360){const nx=x+1/30,ny=visualAmplitude*Math.sin(phaseAt(nx));cp.set([x,0,0,x,y,0,nx,ny,0,x,0,0,nx,ny,0,nx,0,0],i*18);}}
 for(const line of [wave,magnetic,reference]){line.geometry.attributes.position.needsUpdate=true;line.geometry.computeBoundingSphere();}wave.geometry.computeVertexNormals();magnetic.geometry.computeVertexNormals();reference.computeLineDistances();curtain.geometry.attributes.position.needsUpdate=true;curtain.geometry.computeBoundingSphere();
 wave.visible=!isSound&&!sphere;magnetic.visible=isEM&&!sphere;curtain.visible=!isSound&&!circ&&!sphere;reference.visible=$('reference').checked&&!isSound&&!sphere;
 const pp=points.geometry.attributes.position.array;
 for(let i=0;i<145;i++){const x=i/12,u=visualAmplitude*Math.sin(phaseAt(x));pp.set(isSound?[x+.3*state.a*Math.sin(phaseAt(x)),0,0]:[x,u,0],i*3);}points.geometry.attributes.position.needsUpdate=true;points.geometry.computeBoundingSphere();points.visible=!isEM&&(isSound||$('particles').checked);
 const val=sample(state.probe);probeSphere.position.set(state.probe+(isSound?.3*val:0),(isSound||sphere)?0:val*3,circ?visualAmplitude*Math.cos(phaseAt(state.probe)):0);probeSphere.scale.setScalar(sphere?2:1);probeRing.visible=circ;probeRing.position.set(state.probe,0,0);probeRing.scale.setScalar(visualAmplitude);
 const gp=probeGuide.geometry.attributes.position.array;gp.set([state.probe,0,0,probeSphere.position.x,probeSphere.position.y,probeSphere.position.z]);probeGuide.visible=!sphere;probeGuide.geometry.attributes.position.needsUpdate=true;probeGuide.geometry.computeBoundingSphere();probeGuide.computeLineDistances();
 fieldArrows.forEach(([e,b],i)=>{e.visible=b.visible=isEM&&!sphere;const f=WavePhysics.field(phaseAt(i/2),visualAmplitude,circ),length=Math.hypot(f.ey,f.ez);e.setDirection(new THREE.Vector3(0,f.ey,f.ez).normalize());b.setDirection(new THREE.Vector3(0,f.by,f.bz).normalize());for(const arrow of [e,b])arrow.setLength(Math.max(.001,length),Math.min(.12,length*.4),.06);});
 shellGroup.visible=sphere;grid.visible=!sphere;axisLabel.visible=!sphere;
 if(sphere){const lambda=wavelength(),offset=WavePhysics.phaseRadius(state.time,state.v,lambda,state.phi);shells.forEach((shell,i)=>{const radius=offset+i*lambda;shell.visible=radius>.03&&radius<=12;if(shell.visible){shell.scale.setScalar(radius);const fade=Math.min(1,radius/.5,(12-radius)/.7);shell.children.forEach((child,j)=>{if(j===0)child.material.uniforms.fade.value=Math.max(0,fade);else child.material.opacity=.14*Math.max(0,fade);});}});}

 rulerGroup.visible=$('rulers').checked&&!sphere;lambdaGroup.visible=$('rulers').checked;lambdaLabel.visible=lambdaGroup.visible;
 orbit.update();renderer.render(scene,camera);
}
function canvasSetup(id){const el=$(id),r=el.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);if(el.width!==Math.round(r.width*d)||el.height!==Math.round(r.height*d)){el.width=Math.round(r.width*d);el.height=Math.round(r.height*d);}const ctx=el.getContext('2d');ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.font='11px "Segoe UI",sans-serif';ctx.lineWidth=1;return {c:ctx,w:r.width,h:r.height};}
function stroke(c,pts,color,width=1,dash=[]){c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.setLineDash([]);}
function dot(c,x,y,color,r=4){c.beginPath();c.fillStyle=color;c.arc(x,y,r,0,TAU);c.fill();}
function text(c,t,x,y,color='#a9bdce',align='left'){c.fillStyle=color;c.textAlign=align;c.fillText(t,x,y);}
function drawTime(){const {c,w,h}=canvasSetup('time-canvas'),left=45,right=w-20,top=38,bottom=h-40,mid=(top+bottom)/2,scale=(bottom-top)/(spherical()?2.4:1.4);const conf=cfg(),windowSize=conf.window,local=state.time%windowSize,start=state.time-local;const xAt=t=>left+(t-start)/windowSize*(right-left),yAt=v=>mid-v*scale;
 for(let i=0;i<=4;i++){const x=left+(right-left)*i/4;stroke(c,[[x,top],[x,bottom]],'#25394b');text(c,fmt((start+windowSize*i/4)*conf.timeFactor,conf.timeUnit==='s'?1:0),x,bottom+20,'#8fa7ba','center');}for(const v of spherical()?[-1,0,1]:[-.6,0,.6]){stroke(c,[[left,yAt(v)],[right,yAt(v)]],v===0?'#527088':'#25394b');text(c,fmt(v,1),left-8,yAt(v)+4,'#8fa7ba','right');}
 text(c,spherical()?tr('sin θ (bez jednotky)'):`${byMode()} / ${conf.amplitudeUnit}`,left,19);text(c,`t / ${conf.timeUnit}`,right,h-7,'#a9bdce','right');
 const pts=[],refs=[];for(let i=0;i<=300;i++){const t=start+i/300*windowSize;pts.push([left+i/300*(right-left),yAt(sample(state.probe,t))]);refs.push([left+i/300*(right-left),yAt(state.a*Math.sin(phaseAt(state.probe,t)-state.phi))]);}if($('reference').checked&&!spherical())stroke(c,refs,'#a091cd',1,[4,4]);stroke(c,pts,'#66e1ef',2);
 const x=xAt(state.time),y=yAt(sample(state.probe));stroke(c,[[x,top],[x,bottom]],'#b88b6e',1,[3,4]);dot(c,x,y,'#ffb48a',5);
 const periodPixels=(right-left)/windowSize/frequency(),bx=left+8,by=top+7;stroke(c,[[bx,by+4],[bx,by],[bx+periodPixels,by],[bx+periodPixels,by+4]],'#ffb48a');text(c,tr('T'),bx+periodPixels/2,by-5,'#ffb48a','center');
}
function drawPolar(){const {c,w,h}=canvasSetup('polar-canvas'),cx=w*.42,cy=h*.51,maxR=Math.min(h*.31,w*.23),r=spherical()?maxR:maxR*state.a/.6,theta=phaseAt(state.probe),px=cx+r*Math.cos(theta),py=cy-r*Math.sin(theta),projectX=w-43;
 for(const rr of [maxR/3,maxR*2/3,maxR]){c.beginPath();c.strokeStyle='#2b4256';c.arc(cx,cy,rr,0,TAU);c.stroke();}stroke(c,[[cx-maxR-12,cy],[cx+maxR+12,cy]],'#466178');stroke(c,[[cx,cy-maxR-12],[cx,cy+maxR+12]],'#466178');text(c,spherical()?'cos θ':circular()?'E_z':'A cos θ',cx+maxR+4,cy+18,'#8fa7ba','right');text(c,spherical()?'sin θ':circular()?'Eᵧ':'A sin θ',cx,cy-maxR-21,'#a9bdce','center');
 c.beginPath();c.arc(cx,cy,r,0,TAU);c.strokeStyle='#66e1ef';c.globalAlpha=.6;c.stroke();c.globalAlpha=1;stroke(c,[[cx,cy],[px,py]],'#ffb48a',2);dot(c,px,py,'#ffb48a',5);dot(c,cx,cy,'#a9bdce',2);
 stroke(c,[[projectX,cy-maxR],[projectX,cy+maxR]],'#3f596e');stroke(c,[[px,py],[projectX,py]],'#a78870',1,[3,4]);dot(c,projectX,py,'#ffb48a',5);text(c,byMode(),projectX,cy-maxR-13,'#ffb48a','center');
 const angle=((theta%TAU)+TAU)%TAU; c.beginPath();c.strokeStyle='#ffb48a';c.arc(cx,cy,19,0,-angle,true);c.stroke();text(c,`θ = ${fmt(angle*180/Math.PI,0)}°`,16,h-14,'#ffb48a');text(c,spherical()?tr('Jednotkový fázor'):`A = ${fmt(state.a)} ${cfg().amplitudeUnit}`,w-15,h-14,'#a9bdce','right');
}
let priorReadout=-1;
function animate(now){requestAnimationFrame(animate);const dt=lastFrame?Math.min((now-lastFrame)/1000,.08):0;lastFrame=now;if(document.hidden)return;if(state.running)state.time+=dt*cfg().rate/(state.slow?4:1);update3D();drawTime();drawPolar();if(now-priorReadout>100){$('clock').textContent=`t = ${fmt(state.time*cfg().timeFactor)} ${cfg().timeUnit}`;priorReadout=now;}}
document.addEventListener('visibilitychange',()=>lastFrame=0);
// Installation always has a useful fallback; no fabricated browser prompt.
let installPrompt=null;
let installed=false;
const standalone=()=>navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
function installState(){$('install').hidden=installed||standalone();}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;installState();});
window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;installState();notify(tr('Aplikace je nainstalována.'));});
$('install').onclick=async()=>{closeMenu();if(installPrompt){const p=installPrompt;installPrompt=null;try{await p.prompt();await p.userChoice;return;}catch{/* Manual instructions remain available. */}}
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 modal(tr('Instalovat na plochu'),tr`${location.protocol==='file:'||!isSecureContext?tr('<p>Pro instalaci otevři aplikaci přes HTTPS. Otevření souboru z disku instalaci neumožňuje.</p>'):''}${ios?tr('<ol><li>Otevři tuto stránku v Safari.</li><li>Otevři Sdílet (případně nejprve nabídku Další).</li><li>Vyber Přidat na plochu. Pokud volba chybí, najdeš ji přes Upravit akce.</li><li>Je-li dostupná volba Otevřít jako webovou aplikaci, nech ji zapnutou a potvrď Přidat.</li></ol>'):tr('<ol><li>Otevři nabídku prohlížeče.</li><li>Vyber Instalovat aplikaci nebo Přidat na plochu.</li><li>Potvrď instalaci. Pokud volba chybí, zkus aktuální Chrome nebo Edge.</li></ol><p>Na iPhonu a iPadu použij Safari: Sdílet, Přidat na plochu.</p>')}<p>Jakmile menu zobrazí „Připraveno bez internetu“, jsou uloženy všechny modely i vizualizace pro offline použití. Prohlížeč může uložená data později odstranit.</p>`);};
installState();
const displayMode=matchMedia('(display-mode: standalone)');
if(displayMode.addEventListener)displayMode.addEventListener('change',installState);
else displayMode.addListener(installState);
window.addEventListener('pageshow',installState);
let offlineState='preparing';
function updateOfflineStatus(){const keys={preparing:'Příprava offline režimu…',ready:'Připraveno bez internetu',failed:'Offline uložení se nezdařilo; zkus znovu načíst stránku.',unsupported:'Offline instalace vyžaduje HTTPS nebo localhost.'};$('offline-status').textContent=tr(keys[offlineState]);}
if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol)&&isSecureContext){window.addEventListener('load',async()=>{try{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;offlineState='ready';updateOfflineStatus();}catch{offlineState='failed';updateOfflineStatus();}});}else {offlineState='unsupported';updateOfflineStatus();}

function refreshLanguage(){
 updateReadouts();
 if(graphicsReady)scene.traverse(sprite=>{
  if(!sprite.userData.label)return;
  const {source,color,size}=sprite.userData.label,c=sprite.material.map.image,ctx=c.getContext('2d');
  const value=tr(source);ctx.font='32px sans-serif';c.width=Math.ceil(ctx.measureText(value).width)+28;
  ctx.font='32px sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(value,c.width/2,43);
  sprite.material.map.needsUpdate=true;sprite.scale.set(c.width/64*.65*size,.65*size,1);
 });
 if($('dialog').open)$('dialog').close();
 $('toast').hidden=true;
 updateOfflineStatus();drawTime();drawPolar();update3D();
}
window.addEventListener('languagechange',refreshLanguage);
init3D();updateReadouts();requestAnimationFrame(animate);
})();
