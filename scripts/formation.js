// Geração de formação: puramente matemático, sem DOM e sem estado global.
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
    if(countInLine>=4 && (posInLine===0 || posInLine===countInLine-1)) return 'FB';
    return 'CB';
  }
  if(lineIndex===numLines-1) return 'FW';           // linha mais adiantada
  if(lineIndex===1) return 'DM';                     // logo depois da defesa
  return 'MF';
}

function generateFormation(key){
  const lines = key.split('-').map(Number);
  const n = lines.length;
  const positions = [{x:6,y:50,r:'GK'}];
  const MAX_SPAN = 76;   // span usado antes para linhas cheias (mantém o comportamento nelas)
  const STEP = 24;       // distância ideal entre jogadores vizinhos de uma linha
  lines.forEach((count,i)=>{
    const x = n>1 ? 18 + i*(64/(n-1)) : 50;
    // linhas com poucos jogadores usam um span menor (proporcional ao STEP),
    // centralizado em 50%, em vez de sempre ocupar o span máximo do campo
    const span = count>1 ? Math.min(MAX_SPAN, STEP*(count-1)) : 0;
    for(let p=0;p<count;p++){
      const y = count>1 ? 50 - span/2 + p*(span/(count-1)) : 50;
      positions.push({x, y, r: roleForLine(i,n,count,p)});
    }
  });
  return positions;
}

function blankPlayer(role){ return {number:"", name:"", pos:role||"", photo:null}; }
function makeStarters(key){
  return generateFormation(key).map(p=>({x:p.x,y:p.y,number:"",name:"",pos:p.r,photo:null}));
}
