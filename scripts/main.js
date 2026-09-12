// Bootstrap: precisa rodar por último, depois de todos os outros scripts
// (usa "render" e "state", definidos em render.js e state.js).
render();
document.getElementById('formationSelect').value = state.formation;
