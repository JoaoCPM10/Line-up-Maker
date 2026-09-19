// Sincroniza o DOM com "state": reconstrói os tokens do campo e os cards do
// banco do zero a cada chamada (não faz diff, não reaproveita elementos).
// Isso é uma decisão deliberada de simplicidade, não um descuido — qualquer
// animação em cima de elementos recriados (ex: wipe da foto) tem que ser
// disparada explicitamente depois do render(), nunca de forma passiva.

const pitchWrap = document.getElementById('pitchWrap');
const benchStrip = document.getElementById('benchStrip');

// Troca de posição entre titulares por clique: clique simples seleciona
// (índice guardado aqui, sobrevive a um render() já que não é reconstruído
// a cada chamada), clique em outro titular troca x/y/pos entre os dois —
// nome/número/foto ficam com cada jogador, só a posição no campo muda,
// mesmo princípio de "identidade presa ao índice" que o arrastar já usa.
// Clique duplo continua abrindo a modal de edição (ver o listener de
// clique no token abaixo pra como os dois gestos são diferenciados).
let swapSelectedIndex = null;

// Arrasto começa desligado: só clique (seleciona/troca/edita) funciona até o
// usuário ligar de propósito no botão dedicado — evita que um microarrasto
// sem querer (trackpad, clique rápido) mexa um ícone no meio de uma
// sequência de cliques pensada pra trocar posições (ver handleTokenSwapClick).
let dragEnabled = false;

function clearSwapSelection(){
  if(swapSelectedIndex === null) return;
  const prevEl = pitchWrap.querySelector(`.token[data-index="${swapSelectedIndex}"]`);
  if(prevEl) prevEl.classList.remove('swap-selected');
  swapSelectedIndex = null;
}

function handleTokenSwapClick(i){
  if(swapSelectedIndex === null){
    swapSelectedIndex = i;
    const el = pitchWrap.querySelector(`.token[data-index="${i}"]`);
    if(el) el.classList.add('swap-selected');
    return;
  }
  if(swapSelectedIndex === i){
    clearSwapSelection();
    return;
  }
  const a = state.starters[swapSelectedIndex], b = state.starters[i];
  [a.x, b.x] = [b.x, a.x];
  [a.y, b.y] = [b.y, a.y];
  [a.pos, b.pos] = [b.pos, a.pos];
  clearSwapSelection();
  render();
}

function render(){
  document.getElementById('hnameShow').textContent = state.teamName || "My Team";
  document.getElementById('hformShow').textContent = state.formation;
  const hb = document.getElementById('hbadgeShow');
  hb.innerHTML = state.badge ? `<img src="${state.badge}">` : "";

  document.documentElement.style.setProperty('--kit-tint', state.teamColor || '#2f6fed');

  const watermark = document.getElementById('pitchBadgeWatermark');
  if(state.badge){ watermark.src = state.badge; watermark.hidden = false; }
  else { watermark.hidden = true; watermark.removeAttribute('src'); }

  const portraitMode = state.orientation === 'portrait';
  pitchWrap.classList.toggle('portrait', portraitMode);
  document.getElementById('exportBtnLabel').textContent = portraitMode ? 'Export PNG (9:16)' : 'Export PNG (16:9)';

  pitchWrap.querySelectorAll('.token').forEach(n=>n.remove());
  state.starters.forEach((p,i)=>{
    const t = document.createElement('div');
    t.className='token';
    t.dataset.index = i;
    // eixo do gol (p.x) e eixo da largura do campo (p.y) trocam de lugar
    // entre left/top quando o campo está em pé (girado 90°)
    t.style.left = (portraitMode ? p.y : p.x)+'%';
    t.style.top = (portraitMode ? p.x : p.y)+'%';
    t.innerHTML = `
      <div class="circle ${p.photo?'has-photo':''}" style="--kit:${state.teamColor}">
        ${p.photo? `<img src="${p.photo}">` : `<span class="token-num">${p.number||''}</span>`}
      </div>
      <div class="tname">${p.name||'Player '+(i+1)}</div>
      <div class="tpos">${p.pos}</div>
    `;
    attachDrag(t,i);
    if(swapSelectedIndex === i) t.classList.add('swap-selected');
    // clique simples seleciona/troca/desmarca (handleTokenSwapClick); um
    // segundo clique rápido no MESMO ícone (dentro de 250ms) é tratado como
    // duplo clique e abre a modal em vez disso — cancela o clique simples
    // pendente antes de rodar, pra nunca disparar uma troca sem querer no
    // meio de um duplo clique em cima de outro ícone já selecionado
    let clickTimer = null;
    t.addEventListener('click', (ev)=>{
      if(t.dataset.dragged==='1'){ t.dataset.dragged='0'; return; }
      if(clickTimer){
        clearTimeout(clickTimer);
        clickTimer = null;
        clearSwapSelection();
        openModal('starter', i);
        return;
      }
      clickTimer = setTimeout(()=>{
        clickTimer = null;
        handleTokenSwapClick(i);
      }, 250);
    });
    pitchWrap.appendChild(t);
  });

  benchStrip.innerHTML='';
  state.bench.forEach((p,i)=>{
    const c = document.createElement('div');
    c.className='bench-card';
    c.dataset.index = i;
    c.innerHTML = `
      <div class="circle ${p.photo?'has-photo':''}" style="--kit:${state.teamColor}">
        ${p.photo? `<img src="${p.photo}">` : `<span class="num">${p.number||''}</span>`}
      </div>
      <div class="bname">${p.name||'Sub '+(i+1)}</div>
      <div class="bpos">${p.pos||''}</div>
    `;
    c.addEventListener('click', ()=>openModal('bench',i));
    benchStrip.appendChild(c);
  });
  const addBtn = document.createElement('div');
  addBtn.className='bench-add';
  addBtn.textContent='+';
  addBtn.title='Add substitute';
  addBtn.addEventListener('click', ()=>{
    if(state.bench.length>=9) return;
    // número automático seguindo a sequência atual (titulares + banco já
    // existentes); só na criação do slot, editar depois pela modal sempre
    // vale por cima
    const p = blankPlayer("");
    p.number = String(state.starters.length + state.bench.length + 1);
    state.bench.push(p);
    render();
  });
  benchStrip.appendChild(addBtn);
}

function attachDrag(el, index){
  let dragging=false, moved=false;
  el.addEventListener('pointerdown', e=>{
    if(!dragEnabled) return;
    dragging=true; moved=false;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e=>{
    if(!dragging) return;
    moved=true;
    const rect = pitchWrap.getBoundingClientRect();
    const rawX = ((e.clientX-rect.left)/rect.width)*100;
    const rawY = ((e.clientY-rect.top)/rect.height)*100;
    const portraitMode = state.orientation === 'portrait';
    // em pé, o eixo do gol (x) vem do ponteiro em Y e o da largura (y) vem do X
    let x = portraitMode ? rawY : rawX;
    let y = portraitMode ? rawX : rawY;
    x = Math.max(2,Math.min(98,x));
    y = Math.max(4,Math.min(96,y));
    state.starters[index].x=x;
    state.starters[index].y=y;
    el.style.left=(portraitMode?y:x)+'%';
    el.style.top=(portraitMode?x:y)+'%';
  });
  el.addEventListener('pointerup', e=>{
    dragging=false;
    if(moved) el.dataset.dragged='1';
  });
}
