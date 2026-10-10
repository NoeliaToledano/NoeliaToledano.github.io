import assert from "node:assert/strict";

// Deterministic browser raster audit; no personal photos or real AI requests.
// Cover every collage size at each supported narrow viewport, in Chrome and WebKit.
export async function auditPhotoFidelity(page){
 const previous=page.viewportSize();
 try{
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   for(const direct of [false,true]){
   for(let count=1;count<=7;count++){
    const setup=await page.evaluate(async({width,count})=>{
     const host=document.createElement("div");
     host.id="photoRenderAudit";
     host.style.cssText="position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#fff;pointer-events:none";
     document.body.append(host);
     const photo=(background,garment)=>{
      const c=document.createElement("canvas");c.width=90;c.height=150;
      const ctx=c.getContext("2d");
      ctx.fillStyle=background;ctx.fillRect(0,0,90,150);
      ctx.fillStyle=garment;ctx.fillRect(25,15,40,120);
      // Dark corner markers make clipping detectable even on a white studio photo.
      if(background==="#ffffff"){ctx.fillStyle="#777777";for(const [x,y] of [[10,75],[82,75],[45,9],[45,141]])ctx.fillRect(x-6,y-6,13,13)}
      return c.toDataURL("image/png");
     };
     const fixtures=[
      ["Vestidos","Vestido","#ffffff","#e8d9c1"],
      ["Capas","Abrigo","#999999","#21345b"],
      ["Zapatos","Zapatos","#c5a27d","#151515"],
      ["Arriba","Camisa","#bcbcbc","#e8d9c1"],
      ["Abajo","Pantalón","#999999","#21345b"],
      ["Bolsos","Bolso","#c5a27d","#151515"],
      ["Accesorios","Pendientes","#bcbcbc","#e8d9c1"]
     ];
     const pieces=fixtures.slice(0,count).map(([category,name,bg,ink],i)=>({
      id:"render-"+i,name,category,image:photo(bg,ink),bgWhite:bg==="#ffffff",bg,ink
     }));
     host.innerHTML='<main class="content"><div class="grid"><div class="look-tile"><article class="card">'+(direct?outfitBoard(pieces):'<div aria-hidden="true">'+outfitBoard(pieces)+'</div>')+'<div class="card-body">Look de auditoría</div></article></div></div></main>';
     const byName=new Map(pieces.map(g=>[g.name,g]));
     const imgs=[...host.querySelectorAll(".look-mixed-item img")],failures=[],samplePoints=[],expected=[];
     if(window.innerWidth!==width)failures.push("Viewport mismatch: "+window.innerWidth);
     if(imgs.length!==count)failures.push("Wrong photo count: "+imgs.length+" instead of "+count);
     const rgb=h=>[1,3,5].map(n=>parseInt(h.slice(n,n+2),16));
     for(const img of imgs){
      img.loading="eager";await img.decode().catch(()=>{});
      if(img.naturalWidth!==90||img.naturalHeight!==150)failures.push("Photo failed to decode: "+img.alt);
      const g=byName.get(img.alt);
      if(!g){failures.push("Unknown tile: "+img.alt);continue}
      const style=getComputedStyle(img),rect=img.getBoundingClientRect(),tile=img.closest(".look-mixed-item").getBoundingClientRect();
      if(style.objectFit!=="contain")failures.push("Cropped photo: "+img.alt);
      if(rect.left<tile.left-1||rect.right>tile.right+1||rect.top<tile.top-1||rect.bottom>tile.bottom+1)failures.push("Overflow: "+img.alt);
      const pl=parseFloat(style.paddingLeft)||0,pr=parseFloat(style.paddingRight)||0;
      const pt=parseFloat(style.paddingTop)||0,pb=parseFloat(style.paddingBottom)||0;
      const cw=Math.max(0,rect.width-pl-pr),ch=Math.max(0,rect.height-pt-pb);
      const factor=Math.min(cw/90,ch/150);
      const left=pl+(cw-90*factor)/2,top=pt+(ch-150*factor)/2;
      samplePoints.push([[45,75],[10,75],[82,75],[45,9],[45,141]].map(([x,y])=>({
       x:(left+x*factor)/rect.width,y:(top+y*factor)/rect.height
      })));
      const edge=g.bg==="#ffffff"?"#777777":g.bg;
      expected.push([rgb(g.ink),rgb(edge),rgb(edge),rgb(edge),rgb(edge)]);
     }
     return {failures,samplePoints,expected};
    },{width,count,direct});
    assert.deepEqual(setup.failures,[],"Photo geometry at "+width+"px, "+count+" garments");
    for(let i=0;i<setup.expected.length;i++){
     const png=await page.locator("#photoRenderAudit .look-mixed-item img").nth(i).screenshot();
     const actual=await page.evaluate(async({encoded,points})=>{
      const image=new Image();image.src="data:image/png;base64,"+encoded;await image.decode();
      const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);
      return points.map(p=>{
       const x=Math.min(canvas.width-1,Math.max(0,Math.floor(p.x*canvas.width)));
       const y=Math.min(canvas.height-1,Math.max(0,Math.floor(p.y*canvas.height)));
       return [...ctx.getImageData(x,y,1,1).data].slice(0,3);
      });
     },{encoded:png.toString("base64"),points:setup.samplePoints[i]});
     for(let point=0;point<setup.expected[i].length;point++){
      assert.ok(actual[point].every((v,k)=>Math.abs(v-setup.expected[i][point][k])<=28),
       "Photo recolored or clipped ("+width+"px, "+count+" garments, tile "+i+", sample "+point+"): "+actual[point]+" expected "+setup.expected[i][point]);
     }
    }
    await page.locator("#photoRenderAudit").evaluate(el=>el.remove());
   }
   }
  }
 }finally{
  await page.locator("#photoRenderAudit").evaluate(el=>el.remove()).catch(()=>{});
  if(previous)await page.setViewportSize(previous);
 }
}
