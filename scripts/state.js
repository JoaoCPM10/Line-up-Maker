// Estado global do app + fábrica do estado inicial. Antes esse objeto
// literal estava escrito duas vezes (na primeira carga e de novo no botão
// "Clear all"), sempre com o risco de alguém atualizar um lugar e esquecer
// o outro — createInitialState() é a única fonte de verdade agora.

function createInitialState(){
  // números preenchidos automaticamente na criação (goleiro sempre 1, o
  // resto é só sequencial pela ordem gol->defesa->meio->ataque, não uma
  // escalação "realista"); editar manualmente pela modal sempre vale por
  // cima disso, o auto-preenchimento só acontece uma vez, na criação do
  // slot — nunca sobrescreve o que o usuário já digitou depois.
  const starters = makeStarters("4-4-2");
  starters.forEach((p,i)=>{ p.number = String(i+1); });
  const bench = Array.from({length:5}, ()=>blankPlayer(""));
  bench.forEach((p,i)=>{ p.number = String(starters.length+i+1); });
  return {
    teamName: "My Team",
    teamColor: "#2f6fed",
    badge: null,
    formation: "4-4-2",
    orientation: "landscape", // "landscape" | "portrait"
    starters,
    bench
  };
}

let state = createInitialState();
let editing = null; // {kind:'starter'|'bench', index}
