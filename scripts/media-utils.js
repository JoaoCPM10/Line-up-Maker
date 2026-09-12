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

function drawCircleImage(ctx,img,cx,cy,r){
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img,cx-r,cy-r,r*2,r*2);
  ctx.restore();
}
