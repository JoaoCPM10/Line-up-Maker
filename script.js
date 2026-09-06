// Todas as formações são derivadas dos próprios números (ex: "4-2-3-1" = 4 linhas
// de 4, 2, 3 e 1 jogador), evitando coordenadas fixas erradas ou digitadas à mão.
const FORMATION_KEYS = [
  "2-3-4-1","4-2-3-1","4-3-3","4-4-2","4-1-4-1","4-3-1-2","4-4-1-1","4-5-1",
  "4-2-2-2","4-3-2-1","4-1-3-2","4-1-2-3","4-2-4","4-2-1-3",
  "3-5-2","3-4-3","3-4-2-1","3-4-1-2","3-1-4-2","3-5-1-1","3-3-1-3","3-3-3-1","3-2-4-1",
  "5-3-2","5-2-3","5-4-1"
];

function roleForLine(lineIndex, numLines, countInLine, posInLine){
  if(lineIndex===0){
    // linha de defesa: pontas viram laterais quando a linha tem 4+ jogadores
    if(countInLine>=4 && (posInLine===0 || posInLine===countInLine-1)) return 'LAT';
    return 'ZAG';
  }
  if(lineIndex===numLines-1) return 'ATA';           // linha mais adiantada
  if(lineIndex===1) return 'VOL';                     // logo depois da defesa
  return 'MEI';
}

function generateFormation(key){
  const lines = key.split('-').map(Number);
  const n = lines.length;
  const positions = [{x:6,y:50,r:'GOL'}];
  const GAP = 16; // distância vertical fixa entre jogadores de uma mesma linha
  lines.forEach((count,i)=>{
    const x = n>1 ? 18 + i*(64/(n-1)) : 50;
    for(let p=0;p<count;p++){
      const y = 50 + (p - (count-1)/2) * GAP;
      positions.push({x, y, r: roleForLine(i,n,count,p)});
    }
  });
  return positions;
}

function blankPlayer(role){ return {number:"", name:"", pos:role||"", photo:null}; }
function makeStarters(key){
  return generateFormation(key).map(p=>({x:p.x,y:p.y,number:"",name:"",pos:p.r,photo:null}));
}

let state = {
  teamName:"Meu Time",
  teamColor:"#2f6fed",
  badge:null,
  formation:"4-4-2",
  starters: makeStarters("4-4-2"),
  bench: Array.from({length:5},()=>blankPlayer(""))
};

let editing = null; // {kind:'starter'|'bench', index}

const pitchWrap = document.getElementById('pitchWrap');
const benchStrip = document.getElementById('benchStrip');

function resizeImageFile(file, size, cb){
  const reader = new FileReader();
  reader.onload = e=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width=size; c.height=size;
      const ctx = c.getContext('2d');
      const s = Math.min(img.width,img.height);
      const sx=(img.width-s)/2, sy=(img.height-s)/2;
      ctx.drawImage(img,sx,sy,s,s,0,0,size,size);
      cb(c.toDataURL('image/jpeg',0.85));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function render(){
  document.getElementById('hnameShow').textContent = state.teamName || "Meu Time";
  document.getElementById('hformShow').textContent = state.formation;
  const hb = document.getElementById('hbadgeShow');
  hb.innerHTML = state.badge ? `<img src="${state.badge}">` : "";

  pitchWrap.querySelectorAll('.token').forEach(n=>n.remove());
  state.starters.forEach((p,i)=>{
    const t = document.createElement('div');
    t.className='token';
    t.style.left = p.x+'%';
    t.style.top = p.y+'%';
    t.innerHTML = `
      <div class="circle" style="--kit:${state.teamColor}">
        ${p.photo? `<img src="${p.photo}">` : `<span class="token-num">${p.number||''}</span>`}
      </div>
      <div class="tname">${p.name||'Jogador '+(i+1)}</div>
      <div class="tpos">${p.pos}</div>
    `;
    attachDrag(t,i);
    t.addEventListener('click', (ev)=>{ if(t.dataset.dragged==='1'){t.dataset.dragged='0';return;} openModal('starter',i); });
    pitchWrap.appendChild(t);
  });

  benchStrip.innerHTML='';
  state.bench.forEach((p,i)=>{
    const c = document.createElement('div');
    c.className='bench-card';
    c.innerHTML = `
      <div class="circle" style="--kit:${state.teamColor}">
        ${p.photo? `<img src="${p.photo}">` : `<span class="num">${p.number||''}</span>`}
      </div>
      <div class="bname">${p.name||'Reserva '+(i+1)}</div>
      <div class="bpos">${p.pos||''}</div>
    `;
    c.addEventListener('click', ()=>openModal('bench',i));
    benchStrip.appendChild(c);
  });
  const addBtn = document.createElement('div');
  addBtn.className='bench-add';
  addBtn.textContent='+';
  addBtn.title='Adicionar reserva';
  addBtn.addEventListener('click', ()=>{
    if(state.bench.length>=9) return;
    state.bench.push(blankPlayer(""));
    render();
  });
  benchStrip.appendChild(addBtn);
}

function attachDrag(el, index){
  let dragging=false, moved=false;
  el.addEventListener('pointerdown', e=>{
    dragging=true; moved=false;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e=>{
    if(!dragging) return;
    moved=true;
    const rect = pitchWrap.getBoundingClientRect();
    let x = ((e.clientX-rect.left)/rect.width)*100;
    let y = ((e.clientY-rect.top)/rect.height)*100;
    x = Math.max(2,Math.min(98,x));
    y = Math.max(4,Math.min(96,y));
    state.starters[index].x=x;
    state.starters[index].y=y;
    el.style.left=x+'%';
    el.style.top=y+'%';
  });
  el.addEventListener('pointerup', e=>{
    dragging=false;
    if(moved) el.dataset.dragged='1';
  });
}

function openModal(kind, index){
  editing = {kind, index};
  const p = kind==='starter'? state.starters[index] : state.bench[index];
  document.getElementById('modalTitle').textContent = kind==='starter' ? 'Editar titular' : 'Editar reserva';
  document.getElementById('modalNumber').value = p.number||'';
  document.getElementById('modalPos').value = p.pos||'';
  document.getElementById('modalName').value = p.name||'';
  const prev = document.getElementById('modalPhotoPrev');
  prev.innerHTML = p.photo? `<img src="${p.photo}">` : 'foto';
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(){
  document.getElementById('modalOverlay').classList.remove('open');
  editing=null;
}

document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e=>{ if(e.target.id==='modalOverlay') closeModal(); });

document.getElementById('modalSave').addEventListener('click', ()=>{
  if(!editing) return;
  const p = editing.kind==='starter'? state.starters[editing.index] : state.bench[editing.index];
  p.number = document.getElementById('modalNumber').value.trim();
  p.pos = document.getElementById('modalPos').value.trim().toUpperCase();
  p.name = document.getElementById('modalName').value.trim();
  const img = document.getElementById('modalPhotoPrev').querySelector('img');
  p.photo = img ? img.src : null;
  closeModal();
  render();
});

document.getElementById('modalRemovePhoto').addEventListener('click', ()=>{
  document.getElementById('modalPhotoPrev').innerHTML='foto';
});
document.getElementById('modalPhotoBtn').addEventListener('click', ()=>document.getElementById('modalPhotoFile').click());
document.getElementById('modalPhotoFile').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  resizeImageFile(f, 160, dataUrl=>{
    document.getElementById('modalPhotoPrev').innerHTML = `<img src="${dataUrl}">`;
  });
});

document.getElementById('teamName').addEventListener('input', e=>{ state.teamName=e.target.value; render(); });
document.getElementById('teamColor').addEventListener('input', e=>{ state.teamColor=e.target.value; render(); });
document.getElementById('formationSelect').addEventListener('change', e=>{
  const key = e.target.value;
  const preset = generateFormation(key);
  state.starters.forEach((p,i)=>{
    p.x=preset[i].x; p.y=preset[i].y; p.pos=preset[i].r;
  });
  state.formation = key;
  render();
});
document.getElementById('badgeUpload').addEventListener('click', ()=>document.getElementById('badgeFile').click());
document.getElementById('badgeFile').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  resizeImageFile(f, 120, dataUrl=>{ state.badge=dataUrl; document.getElementById('badgeUpload').innerHTML=`<img src="${dataUrl}">`; render(); });
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(!confirm('Limpar toda a escalação atual?')) return;
  state = {
    teamName:"Meu Time", teamColor:"#2f6fed", badge:null,
    formation:"4-4-2", starters: makeStarters("4-4-2"),
    bench: Array.from({length:5},()=>blankPlayer(""))
  };
  document.getElementById('teamName').value = state.teamName;
  document.getElementById('teamColor').value = state.teamColor;
  document.getElementById('formationSelect').value = state.formation;
  document.getElementById('badgeUpload').innerHTML='+';
  render();
});

// ---------- Export PNG ----------
function drawCircleImage(ctx,img,cx,cy,r){
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img,cx-r,cy-r,r*2,r*2);
  ctx.restore();
}
function loadImg(src){
  return new Promise(res=>{
    if(!src){res(null);return;}
    const img = new Image();
    img.onload=()=>res(img);
    img.onerror=()=>res(null);
    img.src=src;
  });
}

async function exportPNG(){
  const cv = document.getElementById('exportCanvas');
  const ctx = cv.getContext('2d');
  const W=1280,H=720;
  ctx.clearRect(0,0,W,H);

  const benchH = 64;              // altura reservada para a faixa do banco
  const fieldBottom = H - benchH; // o campo termina aqui, sem invadir o banco

  // pitch stripes (só até o limite do campo, não embaixo do banco)
  const stripes=12, stripeW=W/stripes;
  for(let i=0;i<stripes;i++){
    ctx.fillStyle = i%2===0 ? '#1b4332' : '#204a3a';
    ctx.fillRect(i*stripeW,0,stripeW,fieldBottom);
  }
  // lines
  ctx.strokeStyle='rgba(255,255,255,.5)';
  ctx.lineWidth=2;
  const padX=W*0.012, padTop=H*0.075, padBot=benchH+10;
  ctx.strokeRect(padX,padTop,W-padX*2,fieldBottom-padTop-(padBot-benchH));
  const fieldBoxBottom = fieldBottom - (padBot-benchH);
  ctx.beginPath();
  ctx.moveTo(W/2,padTop); ctx.lineTo(W/2,fieldBoxBottom); ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2,(padTop+fieldBoxBottom)/2,68,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2,(padTop+fieldBoxBottom)/2,3,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fill();
  const boxH=(fieldBoxBottom-padTop)*0.46, boxY=padTop+(fieldBoxBottom-padTop-boxH)/2;
  ctx.strokeRect(padX,boxY,W*0.10,boxH);
  ctx.strokeRect(W-padX-W*0.10,boxY,W*0.10,boxH);

  // header
  const badgeImg = await loadImg(state.badge);
  if(badgeImg){
    ctx.save();
    ctx.beginPath(); ctx.arc(46,42,20,0,Math.PI*2); ctx.closePath(); ctx.clip();
    ctx.drawImage(badgeImg,26,22,40,40);
    ctx.restore();
    ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(46,42,20,0,Math.PI*2); ctx.stroke();
  }
  ctx.fillStyle='#eef4ef';
  ctx.font="600 22px 'Oswald', sans-serif";
  ctx.textBaseline='alphabetic';
  ctx.fillText(state.teamName||'Meu Time', badgeImg?78:28, 38);
  ctx.font="12px 'Inter', sans-serif";
  ctx.fillStyle='rgba(255,255,255,.75)';
  ctx.fillText(state.formation, badgeImg?78:28, 55);

  // players
  const areaX0=padX, areaX1=W-padX, areaY0=padTop, areaY1=fieldBoxBottom;
  const areaW=areaX1-areaX0, areaH=areaY1-areaY0;
  for(const p of state.starters){
    const cx = areaX0 + (p.x/100)*areaW;
    const cy = areaY0 + (p.y/100)*areaH;
    const r=26;
    ctx.beginPath(); ctx.arc(cx,cy,r+2,0,Math.PI*2);
    ctx.fillStyle=state.teamColor; ctx.fill();
    const img = await loadImg(p.photo);
    if(img){
      drawCircleImage(ctx,img,cx,cy,r);
    } else {
      ctx.fillStyle='#fff';
      ctx.font="600 20px 'Oswald', sans-serif";
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.number||'', cx, cy+1);
    }
    ctx.strokeStyle='#eef4ef'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();

    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#eef4ef';
    ctx.font="600 12.5px 'Inter', sans-serif";
    ctx.fillText(p.name||'', cx, cy+r+16);
    ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.font="9.5px 'Inter', sans-serif";
    ctx.fillText(p.pos||'', cx, cy+r+28);
  }

  // bench strip bar (fundo sólido, separado do gramado, sem sobrepor a linha de fundo)
  const benchY = fieldBottom + benchH/2 + 4;
  ctx.fillStyle='#10151a';
  ctx.fillRect(0,fieldBottom,W,benchH);
  ctx.textAlign='left'; ctx.font="10px 'Inter', sans-serif"; ctx.fillStyle='rgba(255,255,255,.6)';
  ctx.fillText('BANCO', 14, fieldBottom+16);
  let bx = 14;
  ctx.textAlign='center';
  for(const p of state.bench){
    const r=15;
    ctx.beginPath(); ctx.arc(bx+r,benchY,r,0,Math.PI*2);
    ctx.fillStyle=state.teamColor; ctx.fill();
    const img = await loadImg(p.photo);
    if(img){ drawCircleImage(ctx,img,bx+r,benchY,r); }
    else{
      ctx.fillStyle='#fff'; ctx.font="600 11px 'Oswald', sans-serif"; ctx.textBaseline='middle';
      ctx.fillText(p.number||'', bx+r, benchY+1);
    }
    ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(bx+r,benchY,r,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#eef4ef'; ctx.font="9.5px 'Inter', sans-serif"; ctx.textBaseline='alphabetic';
    ctx.fillText((p.name||'').split(' ')[0]||'', bx+r, benchY+26);
    bx += 78;
  }

  cv.toBlob(blob=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download = `escalacao-${(state.teamName||'time').toLowerCase().replace(/\\s+/g,'-')}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
document.getElementById('exportBtn').addEventListener('click', exportPNG);

// ---------- Save / Load lineups ----------
async function refreshSavedList(){
  const section = document.getElementById('savedSection');
  const row = document.getElementById('savedRow');
  try{
    const idx = await window.storage.get('lineups:index', false);
    const list = idx ? JSON.parse(idx.value) : [];
    if(list.length===0){ section.style.display='none'; return; }
    section.style.display='block';
    row.innerHTML='';
    list.forEach(name=>{
      const chip = document.createElement('div');
      chip.className='saved-chip';
      chip.innerHTML = `<span>${name}</span>`;
      const loadBtn = document.createElement('button');
      loadBtn.textContent='abrir';
      loadBtn.style.fontSize='11px';
      loadBtn.addEventListener('click', ()=>loadLineup(name));
      const delBtn = document.createElement('button');
      delBtn.textContent='×';
      delBtn.addEventListener('click', (ev)=>{ev.stopPropagation();deleteLineup(name);});
      chip.appendChild(loadBtn);
      chip.appendChild(delBtn);
      row.appendChild(chip);
    });
  }catch(err){ section.style.display='none'; }
}
async function saveLineup(){
  const name = prompt('Nome para salvar esta escalação:', state.teamName||'Escalação');
  if(!name) return;
  try{
    await window.storage.set('lineup:'+name, JSON.stringify(state), false);
    let idx=[];
    try{ const r = await window.storage.get('lineups:index', false); idx = r? JSON.parse(r.value):[]; }catch(e){}
    if(!idx.includes(name)) idx.push(name);
    await window.storage.set('lineups:index', JSON.stringify(idx), false);
    refreshSavedList();
  }catch(err){ alert('Não foi possível salvar agora.'); }
}
async function loadLineup(name){
  try{
    const r = await window.storage.get('lineup:'+name, false);
    if(!r) return;
    state = JSON.parse(r.value);
    document.getElementById('teamName').value = state.teamName;
    document.getElementById('teamColor').value = state.teamColor;
    document.getElementById('formationSelect').value = state.formation;
    document.getElementById('badgeUpload').innerHTML = state.badge? `<img src="${state.badge}">` : '+';
    render();
  }catch(err){ alert('Não foi possível abrir esta escalação.'); }
}
async function deleteLineup(name){
  try{
    await window.storage.delete('lineup:'+name, false);
    let idx=[];
    try{ const r = await window.storage.get('lineups:index', false); idx = r? JSON.parse(r.value):[]; }catch(e){}
    idx = idx.filter(n=>n!==name);
    await window.storage.set('lineups:index', JSON.stringify(idx), false);
    refreshSavedList();
  }catch(err){}
}
document.getElementById('saveBtn').addEventListener('click', saveLineup);

render();
document.getElementById('formationSelect').value = state.formation;
refreshSavedList();