// Tudo relacionado à exportação em PNG: desenhar a escalação inteira num
// canvas fora de tela, as 3 variantes de export (completo / só ícones / sem
// campo) e o dropdown único que troca entre elas.

// Desenha texto letra por letra com espaçamento manual (canvas não tem
// letter-spacing nativo), centralizado entre x0 e x1. ctx.font/fillStyle
// já devem estar setados antes de chamar; mexe em ctx.textAlign (sempre
// deixa 'left' no final, que é o que o resto do código espera).
function drawSpacedLabelCentered(ctx, text, x0, x1, baselineY, spacing){
  ctx.textAlign = 'left';
  let total = 0;
  for(const ch of text) total += ctx.measureText(ch).width + spacing;
  total -= spacing; // sem espaçamento sobrando depois da última letra
  let lx = (x0+x1)/2 - total/2;
  for(const ch of text){ ctx.fillText(ch, lx, baselineY); lx += ctx.measureText(ch).width + spacing; }
}

// Limita a luminosidade (HSL) de uma cor hex a um teto — usada na fita do
// número do titular. Time com cor clara escolhida (amarelo, branco, ciano)
// deixaria o número branco ilegível se a fita usasse a cor crua; isso
// escurece mantendo o matiz (a fita continua "na cor do time", só não
// mais clara que o teto), garantindo contraste sem virar sempre a mesma
// cor neutra pra todo mundo.
function clampColorLightness(hex, maxL){
  let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0, s=0, l=(max+min)/2;
  if(max!==min){
    const d = max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  if(l <= maxL) return hex; // já está escura o bastante, mantém original
  l = maxL;
  function hue2rgb(p,q,t){
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  }
  let r2,g2,b2;
  if(s===0){ r2=g2=b2=l; }
  else{
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r2 = hue2rgb(p,q,h+1/3); g2 = hue2rgb(p,q,h); b2 = hue2rgb(p,q,h-1/3);
  }
  const toHex = v => Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0');
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

// Fita/bandeira com o número do titular: ponta em V à direita, achatada
// (sem sombra/gradiente), cor do time já com luminosidade limitada.
function drawNumberRibbon(ctx, x, y, w, h, color, number, fontSize){
  const notch = h*0.32;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x+w-notch, y);
  ctx.lineTo(x+w, y+h/2);
  ctx.lineTo(x+w-notch, y+h);
  ctx.lineTo(x, y+h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `700 ${fontSize}px 'Oswald', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // centraliza um pouco à esquerda da ponta, pra não ficar puxado pro recorte
  ctx.fillText(number, x + (w-notch*0.6)/2, y+h/2+1);
}

// Quebra de linha manual pro parágrafo corrido dos reservas — canvas não
// tem wrap nativo em fillText(). Quebra por palavra inteira, nunca no meio.
function wrapText(ctx, text, maxWidth){
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(word=>{
    const test = line ? line+' '+word : word;
    if(ctx.measureText(test).width > maxWidth && line){
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if(line) lines.push(line);
  return lines;
}

// Desenha a escalação inteira no canvas. Com onlyIcons=true, pula o
// gramado, as marcações do campo, o cabeçalho e o banco — só os círculos
// dos titulares na posição da formação, com fundo transparente, pra colar
// por cima de qualquer coisa no vídeo (não só do campo desenhado pelo app).
async function renderLineupToCanvas(cv, onlyIcons, noPitch){
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high'; // melhora a reamostragem de fotos e escudo ao desenhar em tamanho menor
  const portrait = state.orientation === 'portrait';
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  cv.width = W; cv.height = H;
  ctx.clearRect(0,0,W,H); // canvas começa transparente; sem desenhar nada por cima, continua transparente

  // Lista de nomes à esquerda: só no export completo em paisagem (não no
  // retrato, que já é estreito, nem no só-ícones, que precisa ficar limpo).
  // Quando ativa, o campo perde a faixa esquerda pra lista e cada jogador
  // deixa de mostrar o nome embaixo do ícone (o nome já está na lista).
  const showNameList = !onlyIcons && !portrait;

  // Fator de escala sobre a referência original (1280x720): tanto paisagem
  // (1920x1080) quanto retrato (1080x1920) são 1.5x essa referência, então
  // todo valor fixo em pixel (raio dos círculos, fontes, faixas de
  // cabeçalho/banco) escala igual nas duas orientações.
  const S = 1.5;
  const headerH = 54*S;    // espaço reservado no topo pro nome/escudo/formação
  // faixa de ícones do banco embaixo do campo: só existe quando NÃO tem a
  // lista de nomes lateral (retrato, que é estreito e não cabe a lista) —
  // com a lista, o banco já aparece nela, a faixa só duplicaria e tomaria
  // espaço à toa. Nunca aparece no export só-ícones.
  const needsBenchStrip = !onlyIcons && !showNameList;
  const benchH = needsBenchStrip ? 64*S : 0;
  const fieldBottom = H - benchH; // o campo termina aqui, sem invadir a faixa do banco quando ela existe

  const listW = showNameList ? Math.round(W*0.22) : 0; // faixa da lista de nomes, só quando ativa

  // painel da lista: fundo neutro fixo atrás de toda a coluna esquerda
  // (inclusive atrás do cabeçalho, que continua no mesmo lugar de sempre)
  if(showNameList){
    ctx.fillStyle = '#10151a';
    ctx.fillRect(0,0,listW,fieldBottom);
  }

  // pitch stripes (grama vai até o limite do campo, não embaixo do banco,
  // nem embaixo da lista de nomes quando ela existe; em pé, as listras
  // giram 90° junto com o resto do campo). No modo sem campo, não pinta
  // nada ali — o canvas já começa transparente (clearRect lá em cima) e
  // fica assim, só a área da grama mesmo, não o painel da lista/banco.
  if(!onlyIcons && noPitch){
    // de propósito sem desenhar nada: área do campo fica transparente
  } else if(!onlyIcons){
    const stripes=12;
    if(portrait){
      const stripeH = fieldBottom/stripes;
      for(let i=0;i<stripes;i++){
        ctx.fillStyle = i%2===0 ? '#1b4332' : '#204a3a';
        ctx.fillRect(0,i*stripeH,W,stripeH);
      }
    } else {
      const stripeW = (W-listW)/stripes;
      for(let i=0;i<stripes;i++){
        ctx.fillStyle = i%2===0 ? '#1b4332' : '#204a3a';
        ctx.fillRect(listW+i*stripeW,0,stripeW,fieldBottom);
      }
    }
  }

  // Área onde os jogadores ficam (mesmas margens sempre, com ou sem campo
  // desenhado, pra manter a posição de cada jogador idêntica entre as duas
  // exportações). No retrato, giram 90° (gols em cima/embaixo em vez de
  // esquerda/direita). Em paisagem com lista de nomes, o campo começa depois
  // da coluna da lista.
  const marginGoal = 15*S, marginSide = 10*S;
  let X0,X1,Y0,Y1;
  if(portrait){
    Y0 = headerH + marginGoal; Y1 = fieldBottom - marginGoal;
    X0 = marginSide; X1 = W - marginSide;
  } else {
    X0 = listW + marginGoal; X1 = W - marginGoal;
    Y0 = headerH; Y1 = fieldBottom - marginSide;
  }

  // carregado uma única vez, reaproveitado na marca d'água e no cabeçalho
  const badgeImg = onlyIcons ? null : await loadImg(state.badge);

  // marca d'água do escudo: grande, bem apagada, atrás das marcações e dos
  // jogadores (desenhada antes deles). Não entra no modo só-ícones (precisa
  // ficar limpo pra colar sobre qualquer coisa no vídeo) nem no modo sem
  // campo (em paisagem o escudo já aparece com mais destaque no rodapé da
  // lista; em retrato simplesmente não tem escudo nesse export, e tudo bem).
  if(!onlyIcons && !noPitch && badgeImg){
    const wmCenterX = (X0+X1)/2, wmCenterY = (Y0+Y1)/2;
    const wmBox = Math.min(X1-X0, Y1-Y0) * 0.5; // ~50% da menor dimensão da área do campo
    const scale = Math.min(wmBox/badgeImg.width, wmBox/badgeImg.height);
    const dw = badgeImg.width*scale, dh = badgeImg.height*scale;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(badgeImg, wmCenterX-dw/2, wmCenterY-dh/2, dw, dh);
    ctx.restore();
  }

  if(!onlyIcons && !noPitch){
    const goalA = portrait ? Y0 : X0, goalB = portrait ? Y1 : X1;
    const widthA = portrait ? X0 : Y0, widthB = portrait ? X1 : Y1;
    const widthMid = (widthA+widthB)/2;
    const centerX = (X0+X1)/2, centerY = (Y0+Y1)/2;

    ctx.strokeStyle='rgba(255,255,255,.5)';
    ctx.lineWidth=2*S;
    ctx.strokeRect(X0,Y0,X1-X0,Y1-Y0);

    const goalMid = (goalA+goalB)/2;
    ctx.beginPath();
    if(portrait){ ctx.moveTo(widthA,goalMid); ctx.lineTo(widthB,goalMid); }
    else{ ctx.moveTo(goalMid,widthA); ctx.lineTo(goalMid,widthB); }
    ctx.stroke();

    ctx.beginPath(); ctx.arc(centerX,centerY,68*S,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(centerX,centerY,3*S,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fill();

    const boxDepth = (goalB-goalA)*0.10, boxSpan = (widthB-widthA)*0.46;
    const boxW0 = widthMid-boxSpan/2, boxW1 = widthMid+boxSpan/2;
    [[goalA, goalA+boxDepth], [goalB-boxDepth, goalB]].forEach(([g0,g1])=>{
      if(portrait) ctx.strokeRect(boxW0,g0,boxW1-boxW0,g1-g0);
      else ctx.strokeRect(g0,boxW0,g1-g0,boxW1-boxW0);
    });
  }

  if(!onlyIcons){
    // sem o escudo pequeno do lado do nome do time (removido a pedido: o
    // escudo já aparece com destaque no rodapé da lista); nome sempre
    // começa na mesma posição, sem recuo pra abrir espaço pro escudo
    ctx.fillStyle='#eef4ef';
    ctx.font=`600 ${22*S}px 'Oswald', sans-serif`;
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillText(state.teamName||'My Team', 28*S, 38*S);
    ctx.font=`${12*S}px 'Inter', sans-serif`;
    ctx.fillStyle='rgba(255,255,255,.75)';
    ctx.fillText(state.formation, 28*S, 55*S);
  }

  // lista de nomes: "STARTING XI" com fita numerada (cor do time, achatada,
  // luminosidade limitada pra sempre ter contraste com o número branco) e
  // nome maior centralizado; "SUBSTITUTIONS" como parágrafo corrido, bem
  // mais compacto, que sobra mais espaço pros titulares se destacarem.
  // Titular é sempre 11 (regra do futebol) — tamanho fixo generoso, não
  // precisa escalar. Só o parágrafo do banco se adapta ao espaço restante.
  if(showNameList){
    const listX0 = 14*S, listX1 = listW - 14*S;
    // respiro extra abaixo do cabeçalho: o texto da formação já desce um
    // pouco além de Y0, sem isso "STARTING XI" quase encosta nele
    const listTop = Y0 + 16*S;
    const labelH = 26*S, dividerGap = 10*S, sectionGap = 22*S;
    const ribbonW = 40*S, ribbonH = 26*S, starterRowH = 34*S;
    const nameFontSize = 16*S, numberFontSize = 14*S;
    const safeRibbonColor = clampColorLightness(state.teamColor || '#2f6fed', 0.42);

    let cy = listTop;

    if(state.starters.length){
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${17*S}px 'Oswald', sans-serif`;
      ctx.textBaseline = 'alphabetic';
      drawSpacedLabelCentered(ctx, 'STARTING XI', listX0, listX1, cy+labelH*0.7, 1.5*S);
      cy += labelH;
      ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(listX0, cy); ctx.lineTo(listX1, cy); ctx.stroke();
      cy += dividerGap;

      state.starters.forEach((p,i)=>{
        const rowY = cy;
        drawNumberRibbon(ctx, listX0, rowY+(starterRowH-ribbonH)/2, ribbonW, ribbonH, safeRibbonColor, p.number||'–', numberFontSize);
        // nome centralizado no espaço que sobra à direita da fita (não na
        // coluna inteira — a fita ocupa uma faixa fixa à esquerda)
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${nameFontSize}px 'Inter', sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const nameX0 = listX0 + ribbonW + 6*S, nameX1 = listX1;
        ctx.fillText(p.name || ('Player '+(i+1)), (nameX0+nameX1)/2, rowY+starterRowH/2, nameX1-nameX0);
        cy += starterRowH;
      });
    }

    if(state.bench.length){
      if(state.starters.length) cy += sectionGap;
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${13*S}px 'Oswald', sans-serif`;
      ctx.textBaseline = 'alphabetic';
      drawSpacedLabelCentered(ctx, 'SUBSTITUTIONS', listX0, listX1, cy, 1*S);
      cy += 16*S;

      // parágrafo corrido "12. Nome, 13. Nome, ..." (sem número quando o
      // jogador não tem um definido, pra não inventar um que pode colidir
      // com outro já usado). Recua a fonte só o necessário pra caber no
      // espaço restante até o fim da coluna; nada é reservado pro escudo
      // aqui de antemão — ele usa o que sobrar DEPOIS deste parágrafo.
      const availableForSubs = Y1 - cy;
      let subsFontSize = 11*S;
      let subsLines = [];
      const fullText = state.bench.map((p,i)=>{
        const name = p.name || ('Sub '+(i+1));
        return p.number ? `${p.number}. ${name}` : name;
      }).join(', ');
      while(subsFontSize > 6*S){
        ctx.font = `500 ${subsFontSize}px 'Inter', sans-serif`;
        subsLines = wrapText(ctx, fullText, listX1-listX0);
        const neededH = subsLines.length * (subsFontSize*1.5);
        if(neededH <= availableForSubs || availableForSubs <= 0) break;
        subsFontSize -= 0.5*S;
      }
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const subsLineH = subsFontSize*1.5;
      subsLines.forEach((line,i)=>{
        ctx.fillText(line, listX0, cy + i*subsLineH + subsFontSize);
      });
      cy += subsLines.length * subsLineH;
    }

    // escudo em destaque: ocupa o que sobrar de verdade depois do conteúdo
    // até o fim da coluna, em vez de um valor fixo reservado de antemão —
    // com o banco compacto agora, geralmente sobra bem mais espaço do que
    // antes, e um valor fixo deixaria um vão vazio sem necessidade.
    if(badgeImg){
      const leftoverH = Y1 - cy;
      const margin = 16*S;
      const maxSize = 150*S;
      const shieldSize = Math.min(maxSize, leftoverH - margin*2, listW*0.5);
      if(shieldSize > 20*S){
        const bscale = Math.min(shieldSize/badgeImg.width, shieldSize/badgeImg.height);
        const dw = badgeImg.width*bscale, dh = badgeImg.height*bscale;
        const cx = listW/2, cyCenter = cy + margin + dh/2;
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.drawImage(badgeImg, cx-dw/2, cyCenter-dh/2, dw, dh);
        ctx.restore();
      }
    }
  }

  // players — a posição já vem calculada como "distância do gol" (p.x) e
  // "espalhamento na linha" (p.y); no retrato os dois eixos só trocam de
  // lugar entre a tela X e Y, a lógica de generateFormation não muda nada.
  // Desenhados sempre, com ou sem o resto do campo.
  for(const p of state.starters){
    const cx = portrait ? X0 + (p.y/100)*(X1-X0) : X0 + (p.x/100)*(X1-X0);
    const cy = portrait ? Y0 + (p.x/100)*(Y1-Y0) : Y0 + (p.y/100)*(Y1-Y0);
    const r=40*S;
    ctx.beginPath(); ctx.arc(cx,cy,r+2,0,Math.PI*2);
    ctx.fillStyle=state.teamColor; ctx.fill();
    const img = await loadImg(p.photo);
    if(img){
      drawCircleImage(ctx,img,cx,cy,r);
    } else {
      ctx.fillStyle='#fff';
      ctx.font=`600 ${31*S}px 'Oswald', sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.number||'', cx, cy+1);
    }
    ctx.strokeStyle='#eef4ef'; ctx.lineWidth=3*S;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();

    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    let labelY = cy+r+16*S;
    if(!showNameList){
      // nome só aparece embaixo do ícone quando NÃO tem lista lateral
      // (a lista já mostra o nome nesse caso)
      ctx.fillStyle='#eef4ef';
      ctx.font=`600 ${12.5*S}px 'Inter', sans-serif`;
      ctx.fillText(p.name||'', cx, labelY);
      labelY += 12*S;
    }
    ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.font=`${9.5*S}px 'Inter', sans-serif`;
    ctx.fillText(p.pos||'', cx, showNameList ? cy+r+16*S : labelY);
  }

  if(needsBenchStrip){
    // faixa de ícones do banco (fundo sólido, separado do gramado; só
    // existe em retrato, ver needsBenchStrip acima)
    const benchY = fieldBottom + benchH/2 + 4*S;
    ctx.fillStyle='#10151a';
    ctx.fillRect(0,fieldBottom,W,benchH);
    ctx.textAlign='left'; ctx.font=`${10*S}px 'Inter', sans-serif`; ctx.fillStyle='rgba(255,255,255,.6)';
    ctx.fillText('BENCH', 14*S, fieldBottom+16*S);
    let bx = 14*S;
    ctx.textAlign='center';
    for(const p of state.bench){
      const r=15*S;
      ctx.beginPath(); ctx.arc(bx+r,benchY,r,0,Math.PI*2);
      ctx.fillStyle=state.teamColor; ctx.fill();
      const img = await loadImg(p.photo);
      if(img){ drawCircleImage(ctx,img,bx+r,benchY,r); }
      else{
        ctx.fillStyle='#fff'; ctx.font=`600 ${11*S}px 'Oswald', sans-serif`; ctx.textBaseline='middle';
        ctx.fillText(p.number||'', bx+r, benchY+1);
      }
      ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.5*S;
      ctx.beginPath(); ctx.arc(bx+r,benchY,r,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#eef4ef'; ctx.font=`${9.5*S}px 'Inter', sans-serif`; ctx.textBaseline='alphabetic';
      ctx.fillText((p.name||'').split(' ')[0]||'', bx+r, benchY+26*S);
      bx += 78*S;
    }
  }
}

function downloadCanvas(cv, filename){
  cv.toBlob(blob=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function exportPNG(){
  const cv = document.getElementById('exportCanvas');
  await renderLineupToCanvas(cv, false);
  downloadCanvas(cv, `lineup-${(state.teamName||'team').toLowerCase().replace(/\s+/g,'-')}.png`);
}
async function exportIconsPNG(){
  const cv = document.getElementById('exportCanvas');
  await renderLineupToCanvas(cv, true);
  downloadCanvas(cv, `lineup-icons-${(state.teamName||'team').toLowerCase().replace(/\s+/g,'-')}.png`);
}
async function exportNoPitchPNG(){
  const cv = document.getElementById('exportCanvas');
  await renderLineupToCanvas(cv, false, true);
  downloadCanvas(cv, `lineup-no-pitch-${(state.teamName||'team').toLowerCase().replace(/\s+/g,'-')}.png`);
}

// Dropdown único de export: substitui os 3 botões separados que existiam
// antes (Export PNG / ícones / sem campo), que eram parecidos demais um
// do outro na barra e fáceis de confundir num clique rápido.
const exportWrap = document.getElementById('exportWrap');
const exportMainBtn = document.getElementById('exportMainBtn');
const exportMenu = document.getElementById('exportMenu');
function closeExportMenu(){
  exportMenu.classList.remove('open');
  exportMainBtn.classList.remove('open');
  exportMainBtn.setAttribute('aria-expanded', 'false');
}
exportMainBtn.addEventListener('click', e=>{
  e.stopPropagation();
  const willOpen = !exportMenu.classList.contains('open');
  exportMenu.classList.toggle('open', willOpen);
  exportMainBtn.classList.toggle('open', willOpen);
  exportMainBtn.setAttribute('aria-expanded', String(willOpen));
});
document.addEventListener('click', e=>{
  if(!exportWrap.contains(e.target)) closeExportMenu();
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape') closeExportMenu();
});
document.getElementById('exportBtn').addEventListener('click', ()=>{ closeExportMenu(); exportPNG(); });
document.getElementById('exportIconsBtn').addEventListener('click', ()=>{ closeExportMenu(); exportIconsPNG(); });
document.getElementById('exportNoPitchBtn').addEventListener('click', ()=>{ closeExportMenu(); exportNoPitchPNG(); });
