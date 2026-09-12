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

  // lista de nomes (titulares depois banco): sem faixa de cor, hierarquia
  // só por tipografia (tamanho/peso), número solto antes do nome nos
  // titulares, banco menor e apagado. Linhas escalam pra preencher o
  // espaço disponível (fica maior com poucos jogadores, menor com muitos).
  if(showNameList){
    const listX0 = 14*S, listX1 = listW - 14*S;
    // respiro extra abaixo do cabeçalho: o texto da formação já desce um
    // pouco além de Y0, sem isso "STARTERS" quase encosta nele
    const listTop = Y0 + 16*S;
    // escudo no rodapé é decorativo: só reserva espaço pra ele se sobrar
    // altura suficiente pra manter a lista legível (escala >= 0.8); com
    // elenco grande (banco sem limite de tamanho no app), solta o espaço
    // reservado e prioriza os nomes em vez de forçar a lista a espremer
    let listBottomReserved = badgeImg ? 120*S : 0;

    const totalNames = state.starters.length + state.bench.length;
    let scale = 1, starterRowH = 0, benchRowH = 0;
    if(totalNames > 0){
      const naturalStarterRowH = 27*S, naturalBenchRowH = 16*S;
      // constantes fixas (não escalam com "scale") repetidas exatamente
      // como no desenho abaixo, pra o cálculo bater com o espaço realmente
      // ocupado — se divergirem, a lista pode invadir a área reservada
      // pro escudo ou faltar altura sem ninguém perceber
      const labelH = 22*S, dividerGap = 10*S, sectionGap = 20*S, benchLabelGap = 14*S;
      // só as linhas (rowH) escalam de verdade; label/divisor/gaps ficam do
      // mesmo tamanho sempre. Por isso a escala não pode ser "disponível /
      // total", tem que descontar antes o que não escala:
      // disponível = fixo + escala*linhas  =>  escala = (disponível-fixo)/linhas
      const fixedSum = (state.starters.length ? labelH + dividerGap : 0)
                      + (state.bench.length ? (state.starters.length?sectionGap:0) + benchLabelGap : 0);
      const rowSum = state.starters.length*naturalStarterRowH + state.bench.length*naturalBenchRowH;
      let availableH = (Y1 - listBottomReserved) - listTop;
      scale = (availableH - fixedSum) / rowSum;
      if(listBottomReserved > 0 && scale < 0.8){
        listBottomReserved = 0;
        availableH = (Y1 - listBottomReserved) - listTop;
        scale = (availableH - fixedSum) / rowSum;
      }
      scale = Math.max(0.55, Math.min(1.6, scale));
      starterRowH = naturalStarterRowH*scale; benchRowH = naturalBenchRowH*scale;

      let cy = listTop;

      if(state.starters.length){
        // "STARTERS": só tipografia, centralizado na largura da coluna,
        // com linha divisória sutil embaixo
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${15*S}px 'Inter', sans-serif`;
        ctx.textBaseline = 'alphabetic';
        drawSpacedLabelCentered(ctx, 'STARTERS', listX0, listX1, cy+labelH*0.7, 1.5*S);
        cy += labelH;
        ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(listX0, cy); ctx.lineTo(listX1, cy); ctx.stroke();
        cy += dividerGap;

        state.starters.forEach((p,i)=>{
          ctx.fillStyle = 'rgba(255,255,255,.4)';
          ctx.font = `600 ${12*scale}px 'Inter', sans-serif`;
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(p.number||'–', listX0+22*S, cy+starterRowH/2);
          ctx.fillStyle = '#fff';
          ctx.font = `700 ${13.5*scale}px 'Inter', sans-serif`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(p.name || ('Player '+(i+1)), listX0+32*S, cy+starterRowH/2, listX1-listX0-32*S);
          cy += starterRowH;
        });
      }

      if(state.bench.length){
        if(state.starters.length) cy += sectionGap;
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.font = `600 ${10.5*S}px 'Inter', sans-serif`;
        ctx.textBaseline = 'alphabetic';
        drawSpacedLabelCentered(ctx, 'BENCH', listX0, listX1, cy, 1*S);
        cy += benchLabelGap;

        state.bench.forEach((p,i)=>{
          ctx.fillStyle = 'rgba(255,255,255,.5)';
          ctx.font = `500 ${11*scale*0.85}px 'Inter', sans-serif`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(p.name || ('Sub '+(i+1)), listX0, cy+benchRowH/2, listX1-listX0);
          cy += benchRowH;
        });
      }
    }

    // escudo em destaque, ancorado embaixo da lista, só quando existe um
    // escudo de verdade e sobrou espaço reservado pra ele (ver acima: com
    // banco muito grande, esse espaço é liberado pra lista primeiro).
    // Antes era uma marca d'água quase invisível (alpha .14); agora é bem
    // mais visível, pra funcionar como identificação real, não só textura.
    if(badgeImg && listBottomReserved > 0){
      const shieldSize = 110*S;
      const scale = Math.min(shieldSize/badgeImg.width, shieldSize/badgeImg.height);
      const dw = badgeImg.width*scale, dh = badgeImg.height*scale;
      const cx = listW/2, cyBottom = Y1 - dh*0.4;
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(badgeImg, cx-dw/2, cyBottom-dh/2, dw, dh);
      ctx.restore();
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
