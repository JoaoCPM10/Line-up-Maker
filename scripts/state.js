// Estado global do app + fábrica do estado inicial. Antes esse objeto
// literal estava escrito duas vezes (na primeira carga e de novo no botão
// "Clear all"), sempre com o risco de alguém atualizar um lugar e esquecer
// o outro — createInitialState() é a única fonte de verdade agora.

function createInitialState(){
  return {
    teamName: "My Team",
    teamColor: "#2f6fed",
    badge: null,
    formation: "4-4-2",
    orientation: "landscape", // "landscape" | "portrait"
    starters: makeStarters("4-4-2"),
    bench: Array.from({length:5}, ()=>blankPlayer(""))
  };
}

let state = createInitialState();
let editing = null; // {kind:'starter'|'bench', index}
