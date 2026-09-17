// Helpers de imagem/canvas usados tanto pelo upload manual quanto pela
// exportação em PNG. Não dependem de "state" nem de nada da UI — só recebem
// o que precisam por parâmetro, então dá pra testar/reaproveitar isolado.

function resizeImageFile(file, size, cb, format){
  format = format || 'image/jpeg'; // escudo precisa de 'image/png' (fundo transparente); jpeg não tem alfa
  const reader = new FileReader();
  reader.onload = e=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width=size; c.height=size;
      const ctx = c.getContext('2d');
      const s = Math.min(img.width,img.height);
      const sx=(img.width-s)/2, sy=(img.height-s)/2;
      ctx.drawImage(img,sx,sy,s,s,0,0,size,size);
      cb(c.toDataURL(format,0.85));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Baixa a foto sugerida (URL remota) e converte para data: URL passando por
// canvas, igual ao upload manual (resizeImageFile) — necessário porque a
// exportação em PNG desenha as fotos num canvas, e uma <img> cross-origin
// sem isso contamina o canvas e quebra o toBlob() da exportação.
function urlToDataUrl(url, size, cb, format){
  format = format || 'image/jpeg'; // escudo precisa de 'image/png' (fundo transparente); jpeg não tem alfa
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = ()=>{
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const s = Math.min(img.width, img.height);
    const sx = (img.width-s)/2, sy = (img.height-s)/2;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    try{
      cb(c.toDataURL(format, 0.85));
    }catch(err){
      // canvas contaminado: a imagem não liberou CORS, não dá pra usar
      cb(null);
    }
  };
  img.onerror = ()=> cb(null);
  img.src = url;
}

function loadImg(src){
  return new Promise(res=>{
    if(!src){res(null);return;}
    const img = new Image();
    img.onload=()=>res(img);
    img.onerror=()=>res(null);
    img.src=src;
  });
}

// Recorta a imagem num quadrado de lado 2r centrado em cx,cy com cantos
// arredondados (não círculo) — usada quando o jogador tem foto, pra tirar
// o fundo colorido/anel branco e deixar só a foto (ver renderLineupToCanvas
// em canvas-export.js). Substituiu um drawCircleImage() que recortava em
// círculo — não tem mais chamador desde que a foto deixou de ficar atrás
// de um círculo colorido, então foi removido em vez de deixado morto.
function drawRoundedImage(ctx,img,cx,cy,r,radius){
  const x = cx-r, y = cy-r, w = r*2, h = r*2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img,x,y,w,h);
  ctx.restore();
}
