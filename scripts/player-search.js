// Busca de foto de jogador e escudo de time em APIs públicas gratuitas,
// direto do navegador (sem chave, sem servidor próprio), e a renderização
// das sugestões clicáveis que essas buscas alimentam.

// Busca de foto por nome digitado: TheSportsDB primeiro, porque devolve
// foto já recortada com fundo transparente e time associado; se não achar
// nada (ou a API estiver fora do ar), cai para o resumo da Wikipédia.
// Nenhuma das duas é garantida por contrato, então isso é best-effort: se
// falhar, o app segue funcionando com upload manual normalmente.
async function searchPlayerPhoto(name){
  name = name.trim();
  if(name.length < 3) return [];

  // As duas fontes são combinadas (não é mais "TheSportsDB OU Wikipédia"),
  // pra homônimos aparecerem mesmo quando cada fonte só tem uma das pessoas
  // cadastrada com foto.
  const candidates = [];

  try{
    const res = await fetch('https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=' + encodeURIComponent(name));
    if(res.ok){
      const data = await res.json();
      const players = (data && data.player) || [];
      // TheSportsDB cobre vários esportes; sem isso, um "Julio" jogador de
      // basquete apareceria aqui do mesmo jeito. Exige o campo confirmando
      // futebol (não basta estar ausente/diferente).
      const soccerOnly = players.filter(pl => (pl.strSport||'').toLowerCase()==='soccer');
      const withPhoto = soccerOnly.filter(pl => pl.strCutout || pl.strThumb || pl.strRender);
      candidates.push(...withPhoto.slice(0,5).map(pl => ({
        label: pl.strPlayer,
        sub: pl.strTeam || pl.strNationality || '',
        photo: pl.strCutout || pl.strThumb || pl.strRender
      })));
    }
  }catch(err){ /* API instável ou sem internet: segue pra próxima fonte */ }

  // Busca de verdade na Wikipédia (não é mais "adivinha o título exato"):
  // um nome sozinho (ex: "Julio") quase sempre cai numa página de
  // desambiguação sem foto nenhuma, então a versão antiga não achava nada
  // pra nomes assim. Esse endpoint devolve várias páginas que combinam com
  // o texto digitado, cada uma já com sua miniatura — é por aqui que
  // homônimos aparecem mesmo quando o TheSportsDB só tem um deles com foto.
  try{
    // busca bruta bem mais ampla que o número final de sugestões (5): nomes
    // genéricos (ex: "João") têm rei, santo, cidade, etc. nos primeiros
    // resultados por relevância, empurrando jogadores de futebol pra fora
    // de um corte pequeno antes mesmo do filtro de futebol atuar
    const res = await fetch('https://en.wikipedia.org/w/rest.php/v1/search/page?q=' + encodeURIComponent(name) + '&limit=50');
    if(res.ok){
      const data = await res.json();
      const pages = (data && data.pages) || [];
      // Busca de texto livre traz qualquer página que combine (cantor, ator,
      // etc. — foi o que aconteceu com "Julio Iglesias" num teste). Sem sinal
      // nenhum de que é jogador na descrição, prefere não sugerir a arriscar
      // sugerir a pessoa errada.
      const soccerOnly = pages.filter(pg => /footballer|football player|soccer player/i.test(pg.description||''));
      candidates.push(...soccerOnly.filter(pg => pg.thumbnail && pg.thumbnail.url).map(pg=>{
        const url = pg.thumbnail.url;
        return {
          label: pg.title,
          sub: pg.description || 'Wikipedia',
          photo: url.startsWith('//') ? 'https:'+url : url
        };
      }));
    }
  }catch(err){ /* sem internet ou API fora do ar: segue só com o que já tem */ }

  // remove duplicata óbvia (mesmo nome já achado no TheSportsDB)
  const seen = new Set();
  return candidates.filter(c=>{
    const key = c.label.toLowerCase();
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0,5);
}

// Busca de escudo por nome de time digitado: mesmo princípio da busca de
// foto de jogador — TheSportsDB primeiro (devolve escudo, liga e país, úteis
// pra diferenciar times com nome parecido em países diferentes), Wikipédia
// como fallback. Nada aplica sozinho, é sempre sugestão clicável.
async function searchTeamBadge(name){
  name = name.trim();
  if(name.length < 3) return [];

  try{
    const res = await fetch('https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=' + encodeURIComponent(name));
    if(res.ok){
      const data = await res.json();
      const teams = (data && data.teams) || [];
      const withBadge = teams.filter(t => t.strTeamBadge || t.strBadge);
      if(withBadge.length){
        return withBadge.slice(0,3).map(t => ({
          label: t.strTeam,
          sub: [t.strLeague, t.strCountry].filter(Boolean).join(' · '),
          photo: t.strTeamBadge || t.strBadge
        }));
      }
    }
  }catch(err){ /* API instável ou sem internet: segue pro fallback */ }

  try{
    const title = name.replace(/\s+/g,'_');
    const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
    if(res.ok){
      const data = await res.json();
      if(data && data.thumbnail && data.thumbnail.source){
        return [{ label: data.title, sub: 'Wikipedia', photo: data.thumbnail.source }];
      }
    }
  }catch(err){ /* sem artigo ou sem internet: sem sugestão */ }

  return [];
}

function renderTeamSuggestions(candidates){
  const box = document.getElementById('teamSuggestions');
  if(!candidates.length){ box.hidden = true; box.innerHTML=''; return; }
  box.innerHTML = candidates.map((c,i)=>`
    <div class="suggestion" data-i="${i}">
      <img src="${c.photo}">
      <div class="suggestion-text">
        <span class="suggestion-name">${c.label}</span>
        <span class="suggestion-sub">${c.sub}</span>
      </div>
    </div>
  `).join('');
  box.hidden = false;
  box.querySelectorAll('.suggestion').forEach(el=>{
    el.addEventListener('click', ()=>{
      const c = candidates[+el.dataset.i];
      urlToDataUrl(c.photo, 160, dataUrl=>{
        if(dataUrl){
          state.teamName = c.label;
          state.badge = dataUrl;
          document.getElementById('teamName').value = c.label;
          document.getElementById('badgeUpload').innerHTML = `<img src="${dataUrl}">`;
          render();
        }
        box.hidden = true; box.innerHTML='';
      }, 'image/png');
    });
  });
}

function renderNameSuggestions(candidates){
  const box = document.getElementById('nameSuggestions');
  if(!candidates.length){ box.hidden = true; box.innerHTML=''; return; }
  box.innerHTML = candidates.map((c,i)=>`
    <div class="suggestion" data-i="${i}">
      <img src="${c.photo}">
      <div class="suggestion-text">
        <span class="suggestion-name">${c.label}</span>
        <span class="suggestion-sub">${c.sub}</span>
      </div>
    </div>
  `).join('');
  box.hidden = false;
  box.querySelectorAll('.suggestion').forEach(el=>{
    el.addEventListener('click', ()=>{
      const c = candidates[+el.dataset.i];
      document.getElementById('modalName').value = c.label;
      urlToDataUrl(c.photo, 320, dataUrl=>{
        if(dataUrl) document.getElementById('modalPhotoPrev').innerHTML = `<img src="${dataUrl}">`;
        box.hidden = true; box.innerHTML='';
      });
    });
  });
}
