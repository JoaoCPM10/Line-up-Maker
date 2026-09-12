// Salvar/carregar a escalação inteira como arquivo .json local, sem
// servidor. "Salvar" baixa o estado atual; "Carregar" lê esse arquivo de
// volta e substitui o estado em memória.

function saveLineup(){
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lineup-${(state.teamName||'team').toLowerCase().replace(/\s+/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
document.getElementById('saveBtn').addEventListener('click', saveLineup);

document.getElementById('loadBtn').addEventListener('click', ()=>document.getElementById('loadFile').click());
document.getElementById('loadFile').addEventListener('change', e=>{
  const f = e.target.files[0];
  e.target.value = ''; // permite escolher o mesmo arquivo de novo depois
  if(!f) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    let loaded;
    try{
      loaded = JSON.parse(ev.target.result);
      if(!loaded || !Array.isArray(loaded.starters)) throw new Error('invalid format');
    }catch(err){
      alert('Could not open this file. Make sure it\'s a .json exported by this app.');
      return;
    }
    state = loaded;
    document.getElementById('teamName').value = state.teamName||'';
    document.getElementById('teamColor').value = state.teamColor||'#2f6fed';
    document.getElementById('formationSelect').value = state.formation||'4-4-2';
    document.getElementById('orientationSelect').value = state.orientation || 'landscape';
    document.getElementById('badgeUpload').innerHTML = state.badge? `<img src="${state.badge}">` : '+';
    render();
  };
  reader.readAsText(f);
});
