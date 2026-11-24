import './style.css';
import {createViewer} from './viewer';
import {City,Feature,Place,Terrain,centerOf} from './types';
import {icons} from './icons';

const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;
const icon=(name:string)=>'<i data-i="'+name+'">'+(icons[name]||'')+'</i>';
document.querySelectorAll<HTMLElement>('i[data-i]').forEach(i=>i.innerHTML=icons[i.dataset.i!]||'');
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const normalize=(s:string)=>s.toLocaleLowerCase('bs').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
const base=import.meta.env.BASE_URL;
const modal=$<HTMLDialogElement>('#dialog');
function dialog(title:string,body:string){$('#dialog-body').innerHTML='<h2>'+title+'</h2>'+body;modal.showModal()}
$('#dialog-close').onclick=()=>modal.close();modal.onclick=e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close()}};
$('#about').onclick=()=>dialog('O atlasu','<p>Sanski Most 3D je interaktivni atlas grada na Sani. Istraži stvarne ulice, pronađi znamenitost ili pokreni vođeni obilazak.</p><p>Gradski model obuhvata 3 × 3 km oko 44,7667° N i 16,6670° E. Reljef okoline prikazan je na području 10,8 × 10,8 km.</p>');
$('#sources').onclick=()=>dialog('Izvori i podaci','<p><b>Geometrija grada</b><br>5.064 tlocrta zgrada i 629 cestovnih segmenata iz priloženog OSM izvoza i dopunskih rubnih pojasa. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors, ODbL 1.0</a>. <a href="'+base+'data/city.json" download>Preuzmi lokalnu bazu</a>.</p><p><b>Visine i modeli</b><br>Za 38 generičkih zgrada obračun koristi OSM broj etaža. Preostalih 5.026 visina je procijenjeno. Džamija ima zasebnu rekonstrukciju s munarama od 51,5 m. Fasade, krovovi, dopunska stabla, svjetiljke i promet su proceduralni. <a href="'+base+'data/landmarks-sources.txt" target="_blank">Izvori za znamenitosti</a>.</p><p><b>Reljef</b><br>Copernicus DEM GLO-30, lokalna mreža od 60 m s nadmorskim visinama u EGM2008. Vodena površina je izravnata za prikaz. Satelitska podloga od 14. augusta 2026. sadrži obrađene podatke Sentinel-2. Contains modified Copernicus Sentinel data 2026. <a href="'+base+'data/terrain-license.txt" target="_blank">Atribucija i uslovi korištenja</a>.</p>');
$('#help').onclick=()=>dialog('Upravljanje mapom','<p><b>Mišem</b><br>Povuci lijevom tipkom za pomjeranje, desnom za rotaciju. Točkićem približi ili udalji prikaz.</p><p><b>Na dodir</b><br>Povuci jednim prstom za pomjeranje. Približi ili razmakni dva prsta za zum, a zakreni ih za rotaciju.</p><p><b>Tastaturom</b><br>Kada je mapa u fokusu, strelice pomjeraju pogled, + i − mijenjaju zum, a Home vraća početni pogled. Tipka / otvara pretragu.</p>');
const sidebar=$('.sidebar'),input=$<HTMLInputElement>('#query');
function openSide(){sidebar.classList.add('open')}
$('#mobile-open').onclick=()=>{openSide();input.focus()};$('#close-side').onclick=()=>sidebar.classList.remove('open');
document.addEventListener('keydown',e=>{if(e.key==='/'&&e.target!==input&&!modal.open){e.preventDefault();openSide();input.focus()}if(e.key==='Escape'){sidebar.classList.remove('open');$('#layer-pop').hidden=true;$('#layers-btn').setAttribute('aria-expanded','false');$('#detail').hidden=true}});
const catalog=[
  {id:'w346178044',name:'Hamzibegova džamija',category:'Vjerski objekat',icon:'landmark',art:'mosque',description:'Džamija s četiri munare od 51,5 m. Položaj munara i centralne kupole prati kartirane konture.'},
  {id:'w56396323',name:'Gradski most',category:'Most',icon:'milestone',art:'bridge',description:'Most preko Sane u centru grada. Položaj i pravac mosta preuzeti su iz OpenStreetMapa.'},
  {id:'w40699044',name:'Gradski park',category:'Park i priroda',icon:'trees',art:'park',description:'Park generala Mehmeda Alagića na obali Sane. Granica parka i kartirane staze prate OSM podatke.'},
  {id:'w226624055',name:'Stadion Podgrmeča',category:'Sport i rekreacija',icon:'goal',art:'stadium',description:'Fudbalski teren na stadionu Podgrmeča. Podloga prati kartirani obris, a linije i golovi su modelirani.'}
];
async function start(){
  const [city,dem]=await Promise.all([local<City>('city.json'),local<Terrain>('terrain.json')]);
  if(city.buildings.length<1||!dem.heights.length)throw Error('Lokalne geografske datoteke su prazne.');
  const features=new Map<string,Feature>();for(const f of [...city.buildings,...city.roads,...city.areas,...city.waterways])features.set(f.id,f);
  const places=new Map<string,Place>(),featured:Place[]=[];
  for(const a of catalog){const feature=features.get(a.id);if(!feature)throw Error('Nedostaje znamenitost '+a.name);const p={...a,pos:centerOf(feature.points),tags:feature.tags};places.set(p.id,p);featured.push(p)}
  const museumNames:Record<string,string>={park:'Park',school:'Škola',hospital:'Zdravstvo',pharmacy:'Apoteka',place_of_worship:'Vjerski objekat',restaurant:'Restoran',cafe:'Kafić',hotel:'Hotel',supermarket:'Prodavnica',pitch:'Sportski teren',stadium:'Stadion',river:'Rijeka',parking:'Parking',cemetery:'Groblje',bank:'Banka',fuel:'Benzinska pumpa',bridge:'Most',village:'Naselje',suburb:'Naselje'};
  for(const poi of city.pois){if(places.has(poi.id))continue;places.set(poi.id,{id:poi.id,name:poi.name,category:museumNames[poi.kind]||'Lokacija',icon:'map-pin',pos:[poi.x,poi.z],tags:poi.tags})}
  for(const r of city.roads){if(!r.name)continue;const old=places.get(r.id);if(old?.art)continue;places.set(r.id,{id:r.id,name:r.name,category:r.bridge?'Most':'Ulica',icon:r.bridge?'milestone':'route',pos:centerOf(r.points),tags:r.tags})}
  for(const b of city.buildings){if(places.get(b.id)?.art)continue;const old=places.get(b.id);places.set(b.id,{...old,id:b.id,name:b.name||old?.name||'Zgrada',category:old?.category||'Građevina',icon:old?.icon||'building-2',pos:centerOf(b.points),height:b.height,heightSource:b.heightSource,tags:b.tags})}
  let selected:Place|undefined,tab='places',night=false,step=-1,timer=0;
  const saved=new Set<string>();try{const ids=JSON.parse(localStorage.getItem('sanski.saved')||'[]');if(Array.isArray(ids))ids.forEach(id=>{if(typeof id==='string'&&places.has(id))saved.add(id)})}catch{}
  const photo=new Image();photo.src=base+"data/ground.jpg";await photo.decode();
  const viewer=createViewer($('#map'),city,dem,photo,id=>{const p=places.get(id);if(p)choose(p,false)});
  const searchable=[...places.values()].filter(p=>p.name!=='Zgrada'||p.tags?.['addr:housenumber']);
  function term(p:Place){return normalize([p.name,p.tags?.name,p.tags?.['addr:street'],p.tags?.['addr:housenumber'],p.category].filter(Boolean).join(' '))}
  const searchIndex=searchable.map(p=>({p,value:term(p)}));
  $('#places').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-id]');if(b)choose(places.get(b.dataset.id!)!,true)};
  input.oninput=renderList;input.onkeydown=e=>{if(e.key==='Enter')$('#places button')?.click()};
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab!;input.value='';renderList()});
  const labels=featured.map(p=>{const el=document.createElement('button');el.className='pin';el.dataset.art=p.art;el.innerHTML=icon(p.icon)+esc(p.name);el.onclick=()=>choose(p,true);$('#labels').append(el);return {p,el}});
  const sana=city.waterways.find(w=>w.name==='Sana'&&w.points.some(([x,z])=>Math.abs(x)<420&&z>260&&z<620));
  const riverAnchor=sana?.points.filter(([x,z])=>Math.abs(x)<420&&z>260&&z<620).sort((a,b)=>Math.abs(a[1]-460)-Math.abs(b[1]-460))[0];
  const river=document.createElement('span');river.className='river-label';river.textContent='Sana';$('#labels').append(river);
  const mini=$<HTMLCanvasElement>('#mini'),ctx=mini.getContext('2d')!,back=document.createElement('canvas');back.width=240;back.height=148;
  const mg=back.getContext('2d')!;mg.fillStyle='#d9dfc7';mg.fillRect(0,0,240,148);mg.translate(120,74);mg.scale(.075,.075);
  function miniPath(f:Feature){mg.beginPath();for(const points of [f.points,...f.holes||[]])points.forEach(([x,z],i)=>i?mg.lineTo(x,z):mg.moveTo(x,z))}
  for(const a of city.areas.filter(a=>['water','forest','park'].includes(a.kind))){miniPath(a);mg.fillStyle=a.kind==='water'?'#7eb3ab':'#b5c99e';mg.fill('evenodd')}
  for(const b of city.buildings){miniPath(b);mg.fillStyle='#c5c7b5';mg.fill()}
  mg.strokeStyle='#f5f4e4';mg.lineWidth=8;for(const r of city.roads){miniPath(r);mg.stroke()}
  viewer.onMove(mapUpdate);mapUpdate();viewer.onManual(()=>{if(step>=0)stopTour()});
  $('#night').onclick=()=>setNight(true);$('#day').onclick=()=>setNight(false);
  $('#plus').onclick=()=>{stopTour();viewer.zoom(.73)};$('#minus').onclick=()=>{stopTour();viewer.zoom(1.37)};
  $('#home').onclick=()=>{stopTour();viewer.home();$('#perspective').textContent='2D';$('#detail').hidden=true;selected=undefined;renderList()};
  $('#compass').onclick=()=>{stopTour();viewer.north()};$('#perspective').onclick=()=>{stopTour();$('#perspective').textContent=viewer.top()?'3D':'2D'};
  const layerOpts=[['buildings','Građevine','building-2'],['trees','Vegetacija','trees'],['cars','Saobraćaj','car-front'],['labels','Oznake lokacija','map-pin']];
  $('#layer-list').innerHTML=layerOpts.map(([id,n,i])=>'<button class="layer" data-layer="'+id+'" aria-pressed="true">'+icon(i)+n+'<span class="switch"></span></button>').join('');
  $('#layer-list').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-layer]');if(b){const v=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(v));viewer.layer(b.dataset.layer!,v)}};
  $('#layers-btn').onclick=()=>{const l=$('#layer-pop');l.hidden=!l.hidden;$('#layers-btn').setAttribute('aria-expanded',String(!l.hidden))};
  document.addEventListener('pointerdown',e=>{if(!(e.target as HTMLElement).closest('#layer-pop,#layers-btn')){$('#layer-pop').hidden=true;$('#layers-btn').setAttribute('aria-expanded','false')}});
  $('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{dialog('Cijeli ekran','<p>Ovaj preglednik ograničava prikaz preko cijelog ekrana.</p>')}};
  function stopTour(){window.clearTimeout(timer);step=-1;viewer.setTourRotate(false);$('#tour-progress').hidden=true;$('#tour').innerHTML=icon('play')+'Pokreni obilazak'}
  $('#tour').onclick=()=>{if(step>=0){stopTour();return}sidebar.classList.remove('open');$('#tour').innerHTML=icon('square')+'Završi obilazak';advance()};$('#next').onclick=advance;$('#stop').onclick=stopTour;
  renderList();$('#loading').hidden=true;document.documentElement.dataset.ready='true';
}
start().catch((err:Error)=>{console.error(err);$('#loading').innerHTML='<strong>Mapa se nije učitala</strong><span>'+esc(err.message)+'</span><button class="floating" id="retry">Pokušaj ponovo</button>';$('#retry').onclick=()=>location.reload()});

