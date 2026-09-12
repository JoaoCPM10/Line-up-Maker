// Modal de edição de jogador (titular ou reserva): abrir, fechar, salvar,
// upload de foto manual e sugestões de nome/foto enquanto o usuário digita.

function openModal(kind, index){
  editing = {kind, index};
  const p = kind==='starter'? state.starters[index] : state.bench[index];
  document.getElementById('modalTitle').textContent = kind==='starter' ? 'Edit starter' : 'Edit substitute';
  document.getElementById('modalNumber').value = p.number||'';
  document.getElementById('modalPos').value = p.pos||'';
  document.getElementById('modalName').value = p.name||'';
  const prev = document.getElementById('modalPhotoPrev');
  prev.innerHTML = p.photo? `<img src="${p.photo}">` : 'foto';
  clearTimeout(nameSuggestTimer);
  const suggestions = document.getElementById('nameSuggestions');
  suggestions.hidden = true; suggestions.innerHTML='';
  document.getElementById('modalOverlay').classList.add('open');
  const nameInput = document.getElementById('modalName');
  nameInput.focus();
  nameInput.select();
}
function closeModal(){
  clearTimeout(nameSuggestTimer);
  const suggestions = document.getElementById('nameSuggestions');
  suggestions.hidden = true; suggestions.innerHTML='';
  document.getElementById('modalOverlay').classList.remove('open');
  editing=null;
}

document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e=>{ if(e.target.id==='modalOverlay') closeModal(); });

document.getElementById('modalSave').addEventListener('click', ()=>{
  if(!editing) return;
  const p = editing.kind==='starter'? state.starters[editing.index] : state.bench[editing.index];
  const photoBefore = p.photo;
  p.number = document.getElementById('modalNumber').value.trim();
  p.pos = document.getElementById('modalPos').value.trim().toUpperCase();
  p.name = document.getElementById('modalName').value.trim();
  const img = document.getElementById('modalPhotoPrev').querySelector('img');
  p.photo = img ? img.src : null;
  const photoChanged = p.photo && p.photo !== photoBefore;
  const { kind, index } = editing;
  closeModal();
  render();
  // wipe radial só no ícone que de fato ganhou/trocou de foto agora — não é
  // uma reação passiva a qualquer <img> nova, porque render() reconstrói
  // todos os jogadores do zero a cada mudança (mesmo sem relação com foto)
  if(photoChanged){
    const selector = kind==='starter'
      ? `.token[data-index="${index}"] .circle img`
      : `.bench-card[data-index="${index}"] .circle img`;
    const newImg = document.querySelector(selector);
    if(newImg) newImg.classList.add('photo-wipe-in');
  }
});

document.getElementById('modalRemovePhoto').addEventListener('click', ()=>{
  document.getElementById('modalPhotoPrev').innerHTML='foto';
});
document.getElementById('modalPhotoBtn').addEventListener('click', ()=>document.getElementById('modalPhotoFile').click());
document.getElementById('modalPhotoFile').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  resizeImageFile(f, 320, dataUrl=>{
    document.getElementById('modalPhotoPrev').innerHTML = `<img src="${dataUrl}">`;
  });
});

let nameSuggestTimer = null;
document.getElementById('modalName').addEventListener('input', e=>{
  clearTimeout(nameSuggestTimer);
  const value = e.target.value;
  const box = document.getElementById('nameSuggestions');
  if(value.trim().length < 3){ box.hidden = true; box.innerHTML=''; return; }
  nameSuggestTimer = setTimeout(async ()=>{
    const candidates = await searchPlayerPhoto(value);
    renderNameSuggestions(candidates);
  }, 500);
});
