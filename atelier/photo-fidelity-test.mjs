import assert from "node:assert/strict";

// Browser-level checks: no personal photos, no real AI requests.
// Compare actual screenshot pixels (not just computed CSS) in Chrome and WebKit.
export async function auditPhotoFidelity(page){
 const oldViewport=page.viewportSize();
 try{
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   const setup=await page.evaluate(async(width)=>{
    const host=document.createElement("div");
    host.id="photoRenderAudit";
    host.style.cssText="position:fixed;left:0;top:0;width:"+Math.min(width-12,340)+"px;z-index:2147483647;background:#fff;pointer-events:none";
    document.body.append(host);
    const photo=(bg,ink)=>{
     const c=document.createElement("canvas");c.width=90;c.height=150;
     const ctx=c.getContext("2d");
     ctx.fillStyle=bg;ctx.fillRect(0,0,90,150);
     ctx.fillStyle=ink;ctx.fillRect(25,15,40,120);
     return c.toDataURL("image/png");
    };
    const pieces=[
     {id:"photo-dress",name:"Vestido",category:"Vestidos",image:photo("#ffffff","#e8d9c1"),bgWhite:true},
     {id:"photo-coat",name:"Abrigo",category:"Capas",image:photo("#999999","#21345b")},
     {id:"photo-shoes",name:"Zapatos",category:"Zapatos",image:photo("#c5a27d","#151515")}
    ];
    host.innerHTML=outfitBoard(pieces);
    const imgs=[...host.querySelectorAll(".look-mixed-item img")],failures=[],samplePoints=[];
    if(window.innerWidth!==width)failures.push("Viewport mismatch: "+window.innerWidth);
    if(imgs.length!==3)failures.push("Expected 3 photo tiles");
    for(const img of imgs){
     img.loading="eager";await img.decode().catch(()=>{});
     if(img.naturalWidth!==90||img.naturalHeight!==150)failures.push("Image decoding failed");
     const style=getComputedStyle(img),rect=img.getBoundingClientRect(),tile=img.closest(".look-mixed-item").getBoundingClientRect();
     if(style.objectFit!=="contain")failures.push("Image not contained");
     if(rect.left<tile.left-1||rect.right>tile.right+1||rect.top<tile.top-1||rect.bottom>tile.bottom+1)failures.push("Image overflow");
     const pl=parseFloat(style.paddingLeft)||0,pr=parseFloat(style.paddingRight)||0;
     const pt=parseFloat(style.paddingTop)||0,pb=parseFloat(style.paddingBottom)||0;
     const contentW=Math.max(0,rect.width-pl-pr),contentH=Math.max(0,rect.height-pt-pb);
     const factor=Math.min(contentW/90,contentH/150);
     const left=pl+(contentW-90*factor)/2,top=pt+(contentH-150*factor)/2;
     samplePoints.push([[45,75],[10,75],[85,75],[45,5],[45,145]].map(([x,y])=>({
      x:(left+x*factor)/rect.width,y:(top+y*factor)/rect.height
     })));
    }
    return {failures,samplePoints};
   },width);
   assert.deepEqual(setup.failures,[],"Photo geometry at "+width+"px");
   const expected=[
    [[232,217,193],[255,255,255],[255,255,255],[255,255,255],[255,255,255]],
    [[33,52,91],[153,153,153],[153,153,153],[153,153,153],[153,153,153]],
    [[21,21,21],[197,162,125],[197,162,125],[197,162,125],[197,162,125]]
   ];
   for(let i=0;i<expected.length;i++){
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
    for(let point=0;point<expected[i].length;point++){
     assert.ok(actual[point].every((v,k)=>Math.abs(v-expected[i][point][k])<=24),
      "Photo rendered color changed ("+width+"px, tile "+i+", sample "+point+"): "+actual[point]);
    }
   }
   await page.locator("#photoRenderAudit").evaluate(el=>el.remove());
  }
 }finally{
  await page.locator("#photoRenderAudit").evaluate(el=>el.remove()).catch(()=>{});
  if(oldViewport)await page.setViewportSize(oldViewport);
 }
}
