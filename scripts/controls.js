// Painel de controles do topo: nome do time (+ sugestão de escudo), cor da
// camisa, formação, orientação, upload de escudo e o botão "Clear all".

let teamSuggestTimer = null;
document.getElementById('teamName').addEventListener('input', e=>{
  state.teamName = e.target.value;
  render();
  clearTimeout(teamSuggestTimer);
  const value = e.target.value;
  const box = document.getElementById('teamSuggestions');
  if(value.trim().length < 3){ box.hidden = true; box.innerHTML=''; return; }
  teamSuggestTimer = setTimeout(async ()=>{
    const candidates = await searchTeamBadge(value);
    renderTeamSuggestions(candidates);
  }, 500);
});
document.getElementById('teamName').addEventListener('blur', ()=>{
  // pequeno atraso pra não fechar antes do clique numa sugestão registrar
  setTimeout(()=>{
    const box = document.getElementById('teamSuggestions');
    box.hidden = true; box.innerHTML='';
  }, 150);
});
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
// Dois ícones (paisagem/retrato) no lugar do dropdown de texto que existia
// antes — mais direto pro usuário. syncOrientationButtons() é a única fonte
// de verdade de qual dos dois fica destacado, chamada tanto no clique quanto
// sempre que "state.orientation" muda por outro caminho (reset, carregar
// arquivo), pra nunca ficar com o botão errado marcado.
const orientLandscapeBtn = document.getElementById('orientLandscapeBtn');
const orientPortraitBtn = document.getElementById('orientPortraitBtn');
function syncOrientationButtons(){
  const isPortrait = state.orientation === 'portrait';
  orientLandscapeBtn.classList.toggle('primary', !isPortrait);
  orientLandscapeBtn.setAttribute('aria-pressed', String(!isPortrait));
  orientPortraitBtn.classList.toggle('primary', isPortrait);
  orientPortraitBtn.setAttribute('aria-pressed', String(isPortrait));
}
orientLandscapeBtn.addEventListener('click', ()=>{
  state.orientation = 'landscape';
  syncOrientationButtons();
  render();
});
orientPortraitBtn.addEventListener('click', ()=>{
  state.orientation = 'portrait';
  syncOrientationButtons();
  render();
});
document.getElementById('badgeUpload').addEventListener('click', ()=>document.getElementById('badgeFile').click());
document.getElementById('badgeFile').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  resizeImageFile(f, 120, dataUrl=>{ state.badge=dataUrl; document.getElementById('badgeUpload').innerHTML=`<img src="${dataUrl}">`; render(); }, 'image/png');
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(!confirm('Clear the entire current lineup?')) return;
  state = createInitialState();
  document.getElementById('teamName').value = state.teamName;
  document.getElementById('teamColor').value = state.teamColor;
  document.getElementById('formationSelect').value = state.formation;
  syncOrientationButtons();
  document.getElementById('badgeUpload').innerHTML='+';
  render();
});
