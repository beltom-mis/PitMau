'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cv=$('#cv'),ctx=cv.getContext('2d',{willReadFrequently:true}),sel=$('#sel');
let work=null,hist=[],name='imagem',picking=false,bg=null,crop=null,tab='ed',pfiles=[];

const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2400)};
const filt=()=>`brightness(${$('#br').value}%) contrast(${$('#co').value}%) saturate(${$('#sa').value}%) blur(${$('#bl').value}px) grayscale(${$('#gr').value}%) sepia(${$('#se').value}%)`;
const resetF=()=>$$('.f').forEach(i=>i.value=i.dataset.d);
const snap=()=>{const c=mk(cv.width,cv.height);c.getContext('2d').drawImage(cv,0,0);return c};
const guard=()=>work||(toast('Carrega uma imagem primeiro'),false);

function render(){
  if(!work)return;
  cv.width=work.width;cv.height=work.height;
  ctx.filter=filt();ctx.drawImage(work,0,0);ctx.filter='none';
  $('#info').textContent=`${work.width} × ${work.height}px`;
  $('#w').value=work.width;$('#h').value=work.height;
  sel.style.display='none';crop=null;
}
function commit(c){hist.push(work);if(hist.length>15)hist.shift();work=c;resetF();render()}
function show(){$('#drop').hidden=true;$('#wrap').hidden=false}

async function load(f){
  if(!f||!f.type.startsWith('image/'))return toast('Formato não suportado');
  try{
    const b=await createImageBitmap(f),c=mk(b.width,b.height);
    c.getContext('2d').drawImage(b,0,0);
    name=f.name.replace(/\.[^.]+$/,'');hist=[];bg=null;$('#sw').style.background='';
    work=c;resetF();show();render();
  }catch{toast('Não foi possível abrir a imagem')}
}

/* Separadores */
$$('.tab').forEach(b=>b.onclick=()=>{
  tab=b.dataset.t;
  $$('.tab').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-selected',on)});
  $$('.view').forEach(v=>v.hidden=v.id!==tab);
});

/* Carregar */
$('#file').onchange=e=>load(e.target.files[0]);
$('#new').onclick=()=>{$('#file').value='';$('#file').click()};
const dz=$('#drop');
['dragover','dragenter'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over')}));
['dragleave','drop'].forEach(ev=>document.addEventListener(ev,()=>dz.classList.remove('over')));
document.addEventListener('drop',e=>{
  e.preventDefault();const fs=[...e.dataTransfer.files];
  tab==='ed'?load(fs[0]):addPdf(fs);
});
document.addEventListener('paste',e=>{const f=[...e.clipboardData.files][0];if(f&&tab==='ed')load(f)});

/* Desfazer */
const undo=()=>{if(hist.length){work=hist.pop();resetF();render()}else toast('Nada para desfazer')};
$('#undo').onclick=undo;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&tab==='ed'){e.preventDefault();undo()}});

/* Transformações */
$$('[data-a]').forEach(b=>b.onclick=()=>{
  if(!guard())return;
  const s=snap(),a=b.dataset.a,rot=a==='rl'||a==='rr';
  const c=rot?mk(s.height,s.width):mk(s.width,s.height),x=c.getContext('2d');
  if(rot){x.translate(c.width/2,c.height/2);x.rotate(a==='rr'?Math.PI/2:-Math.PI/2);x.drawImage(s,-s.width/2,-s.height/2)}
  else{x.translate(a==='fh'?c.width:0,a==='fv'?c.height:0);x.scale(a==='fh'?-1:1,a==='fv'?-1:1);x.drawImage(s,0,0)}
  commit(c);
});

/* Redimensionar */
$('#w').oninput=()=>{if(work&&$('#lock').checked)$('#h').value=Math.round($('#w').value*work.height/work.width)};
$('#h').oninput=()=>{if(work&&$('#lock').checked)$('#w').value=Math.round($('#h').value*work.width/work.height)};
$('#resize').onclick=()=>{
  if(!guard())return;
  const w=Math.max(1,+$('#w').value|0),h=Math.max(1,+$('#h').value|0);
  if(w*h>64e6)return toast('Dimensão demasiado grande');
  const s=snap(),c=mk(w,h),x=c.getContext('2d');
  x.imageSmoothingQuality='high';x.drawImage(s,0,0,w,h);commit(c);
};

/* Filtros */
$$('.f').forEach(i=>i.oninput=render);
$('#fapply').onclick=()=>guard()&&commit(snap());
$('#freset').onclick=()=>{resetF();render()};

/* Ponteiro: recorte ou conta-gotas */
const pos=e=>{const r=cv.getBoundingClientRect();return{x:Math.max(0,Math.min(cv.width,(e.clientX-r.left)*cv.width/r.width)),y:Math.max(0,Math.min(cv.height,(e.clientY-r.top)*cv.height/r.height)),k:r.width/cv.width}};
cv.onpointerdown=e=>{
  if(!work)return;const p=pos(e);
  if(picking){
    const d=ctx.getImageData(Math.min(cv.width-1,p.x|0),Math.min(cv.height-1,p.y|0),1,1).data;
    bg=[d[0],d[1],d[2]];$('#sw').style.background=`rgb(${bg})`;picking=false;$('#pick').classList.remove('on');return;
  }
  cv.setPointerCapture(e.pointerId);crop={x0:p.x,y0:p.y,x1:p.x,y1:p.y};
};
cv.onpointermove=e=>{
  if(!crop||!(e.buttons&1))return;const p=pos(e);crop.x1=p.x;crop.y1=p.y;
  const L=Math.min(crop.x0,crop.x1)*p.k,T=Math.min(crop.y0,crop.y1)*p.k;
  Object.assign(sel.style,{display:'block',left:L+'px',top:T+'px',width:Math.abs(crop.x1-crop.x0)*p.k+'px',height:Math.abs(crop.y1-crop.y0)*p.k+'px'});
};
$('#crop').onclick=()=>{
  if(!guard())return;
  if(!crop||Math.abs(crop.x1-crop.x0)<2||Math.abs(crop.y1-crop.y0)<2)return toast('Arrasta sobre a imagem para escolher a área');
  const x=Math.round(Math.min(crop.x0,crop.x1)),y=Math.round(Math.min(crop.y0,crop.y1));
  const w=Math.round(Math.abs(crop.x1-crop.x0)),h=Math.round(Math.abs(crop.y1-crop.y0));
  const c=mk(w,h);c.getContext('2d').drawImage(cv,x,y,w,h,0,0,w,h);commit(c);
};

/* Remover fundo (por cor, com suavidade nas bordas) */
$('#pick').onclick=()=>{if(!guard())return;picking=!picking;$('#pick').classList.toggle('on',picking);if(picking)toast('Clica na cor do fundo')};
$('#rmbg').onclick=()=>{
  if(!guard())return;
  const s=snap(),x=s.getContext('2d'),id=x.getImageData(0,0,s.width,s.height),d=id.data;
  const [r,g,b]=bg||[d[0],d[1],d[2]];
  const T=$('#tol').value*4.41,F=$('#fea').value*3+1;
  for(let i=0;i<d.length;i+=4){
    const e=Math.hypot(d[i]-r,d[i+1]-g,d[i+2]-b);
    if(e<=T)d[i+3]=0;
    else if(e<T+F)d[i+3]=Math.min(d[i+3],(e-T)/F*255);
  }
  x.putImageData(id,0,0);commit(s);
  $('#fmt').value='image/png';toast('Fundo removido. Exporta em PNG para manter a transparência');
};

/* Exportar */
const dl=(blob,file)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4e3)};
const out=(c,t)=>c.toBlob(b=>b?dl(b,`${name}-pitmau.${t.split('/')[1].replace('jpeg','jpg')}`):toast('Formato não suportado neste browser'),t,$('#qual').value/100);
$('#save').onclick=()=>{
  if(!guard())return;
  const t=$('#fmt').value,s=snap();
  if(t==='image/jpeg'){const c=mk(s.width,s.height),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(s,0,0);return out(c,t)}
  out(s,t);
};

/* Imagens para PDF */
function addPdf(fs){pfiles.push(...fs.filter(f=>f.type.startsWith('image/')));listPdf()}
function listPdf(){
  const ol=$('#plist');ol.innerHTML='';
  pfiles.forEach((f,i)=>{
    const li=document.createElement('li'),sp=document.createElement('span');sp.textContent=f.name;li.append(sp);
    [['↑',-1,'Subir'],['↓',1,'Descer'],['✕',0,'Remover']].forEach(([t,d,l])=>{
      const b=document.createElement('button');b.className='btn';b.textContent=t;b.setAttribute('aria-label',l);
      b.onclick=()=>{if(!d)pfiles.splice(i,1);else if(pfiles[i+d])[pfiles[i],pfiles[i+d]]=[pfiles[i+d],pfiles[i]];listPdf()};
      li.append(b);
    });
    ol.append(li);
  });
}
$('#pfiles').onchange=e=>{addPdf([...e.target.files]);e.target.value=''};
$('#pmake').onclick=async()=>{
  if(!pfiles.length)return toast('Adiciona pelo menos uma imagem');
  try{
    const imgs=[];
    for(const f of pfiles){
      const b=await createImageBitmap(f),c=mk(b.width,b.height),x=c.getContext('2d');
      x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(b,0,0);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));
      imgs.push({w:c.width,h:c.height,d:new Uint8Array(await blob.arrayBuffer())});
    }
    dl(buildPdf(imgs),'pitmau.pdf');toast('PDF gerado');
  }catch{toast('Erro ao gerar o PDF')}
};
/* Escritor mínimo de PDF: uma página por imagem JPEG (DCTDecode) */
function buildPdf(imgs){
  const parts=[],off=[],enc=new TextEncoder();let len=0;
  const add=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);len+=b.length};
  const obj=(n,x)=>{off[n]=len;add(`${n} 0 obj\n${x}\nendobj\n`)};
  const n=imgs.length;
  add('%PDF-1.4\n');
  obj(1,'<</Type/Catalog/Pages 2 0 R>>');
  obj(2,`<</Type/Pages/Count ${n}/Kids[${imgs.map((_,i)=>`${3+3*i} 0 R`).join(' ')}]>>`);
  imgs.forEach((m,i)=>{
    const p=3+3*i,w=+(m.w*.75).toFixed(2),h=+(m.h*.75).toFixed(2),c=`q ${w} 0 0 ${h} 0 0 cm /I Do Q`;
    obj(p,`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${w} ${h}]/Resources<</XObject<</I ${p+2} 0 R>>>>/Contents ${p+1} 0 R>>`);
    obj(p+1,`<</Length ${c.length}>>\nstream\n${c}\nendstream`);
    off[p+2]=len;
    add(`${p+2} 0 obj\n<</Type/XObject/Subtype/Image/Width ${m.w}/Height ${m.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${m.d.length}>>\nstream\n`);
    add(m.d);add('\nendstream\nendobj\n');
  });
  const x=len,t=3*n+3;
  add(`xref\n0 ${t}\n0000000000 65535 f \n${off.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<</Size ${t}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`);
  return new Blob(parts,{type:'application/pdf'});
}
