import { verifySession } from "../_lib/auth.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const origin=req.headers.origin||"";
  if (["https://noeliatoledano.github.io","http://localhost:8000","http://127.0.0.1:8000"].includes(origin)) res.setHeader("Access-Control-Allow-Origin",origin);
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="POST")return res.status(405).json({error:"Método no permitido."});
  if(!verifySession(req))return res.status(401).json({error:"Sesión no válida o caducada."});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"La generación de imágenes no está configurada."});

  const input=req.body?.image;
  const match=typeof input==="string"&&input.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if(!match||input.length>5_000_000)return res.status(400).json({error:"Sube una fotografía JPEG, PNG o WebP válida de menos de 4 MB."});
  const mime="image/"+match[1],binary=Buffer.from(match[2],"base64");
  if(binary.length<100||binary.length>3_750_000)return res.status(400).json({error:"Tamaño de imagen no válido."});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),52000);
  try{
    const form=new FormData();
    form.append("model",process.env.OPENAI_IMAGE_MODEL||"gpt-image-1-mini");
    form.append("image",new Blob([binary],{type:mime}),"garment."+({jpeg:"jpg",png:"png",webp:"webp"}[match[1]]));
    form.append("size","1024x1536");
    form.append("quality","medium");
    form.append("output_format","jpeg");
    form.append("prompt",[
      "Edit this exact real clothing item into a premium fashion e-commerce product photograph.",
      "Place the garment alone, centered and entirely visible, against pure white (#FFFFFF), in a 2:3 vertical studio framing.",
      "Use natural soft even light. Retain precisely the same garment: its true color, texture, silhouette, proportions, seams, neckline, buttons, pockets, printed graphics, labels and other visible details.",
      "No redesign, no additions, no garment substitutions, no changes to prints or branding.",
      "Remove the surrounding room, furniture, model, mannequin, hands and hanger while keeping the item realistic.",
      "If the photo does not show a detail, do not invent it. Do not invent a reverse side.",
      "A polished, isolated flat-lay product photo with modest realistic folds, no text, no props."
    ].join(" "));
    const response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY},body:form,signal:controller.signal});
    const result=await response.json();
    if(!response.ok){
      console.error("RENDER_GARMENT",response.status,result?.error?.code||"unknown");
      return res.status(502).json({error:"No se ha podido generar la foto de catálogo."});
    }
    const b64=result?.data?.[0]?.b64_json;
    if(typeof b64!=="string"||b64.length<100)return res.status(502).json({error:"La IA no ha devuelto una imagen válida."});
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({image:"data:image/jpeg;base64,"+b64});
  }catch(err){
    console.error("RENDER_GARMENT",err?.name||"error");
    return res.status(err?.name==="AbortError"?504:502).json({error:"La generación ha fallado. Conservamos tu fotografía."});
  }finally{clearTimeout(timeout)}
}
