import { verifySession } from "../_lib/auth.js";

const allowedOrigins = new Set(["https://noeliatoledano.github.io","http://localhost:8000","http://127.0.0.1:8000"]);

export default async function handler(req,res){
  const origin=req.headers.origin||"";
  if(allowedOrigins.has(origin)) res.setHeader("Access-Control-Allow-Origin",origin);
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Cache-Control","no-store");
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="POST") return res.status(405).json({error:"Método no permitido."});
  if(!verifySession(req)) return res.status(401).json({error:"Sesión no válida o caducada."});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"Atelier AI aún no está configurado."});

  const body=req.body||{}, items=Array.isArray(body.items)?body.items.slice(0,24):[];
  if(items.length<2) return res.status(400).json({error:"No hay suficientes prendas candidatas."});
  const ids=new Set(items.map(x=>String(x.i)));
  const need=Math.max(1,Math.min(5,Number(body.need)||3));
  const taste=v=>(Array.isArray(v)?v:[]).slice(0,6).map(l=>(Array.isArray(l)?l:[]).map(String).filter(id=>ids.has(id)).slice(0,6)).filter(l=>l.length>=2);
  const liked=taste(body.liked), disliked=taste(body.disliked);
  const prompt=[
    "Eres estilista. Crea "+need+" looks usando SOLO los ids de items (campos: n=nombre, c=categoría). No inventes ids.",
    "Contexto: ocasión="+(body.occasion||"libre")+"; temporada="+(body.season||"cualquiera")+"; tiempo="+(body.weather||"25 °C")+".",
    "Reglas: looks variados y coherentes; no mezcles dos estampados ni formalidades muy distintas; evita avoid si hay alternativas.",
    liked.length?"Le gustaron (inspírate, no repitas): "+JSON.stringify(liked):"",
    disliked.length?"No le gustaron (evita parecidos): "+JSON.stringify(disliked):"",
    "avoid="+JSON.stringify((body.avoid||[]).slice(0,12)),
    "items="+JSON.stringify(items),
    'Responde SOLO JSON: {"looks":[{"ids":["1","2"],"why":"máx 6 palabras"}]}'
  ].filter(Boolean).join("\n");
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_LOOK_MODEL||"gpt-4o-mini",input:prompt,max_output_tokens:40+need*45})});
    const data=await r.json();
    if(!r.ok) return res.status(502).json({error:"La IA no ha podido crear los looks.",detail:data?.error?.message||null});
    const text=data.output_text||(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("");
    const clean=String(text||"").replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/i,"").trim();
    const a=clean.indexOf("{"),b=clean.lastIndexOf("}"); if(a<0||b<=a) throw new Error("JSON inválido");
    const parsed=JSON.parse(clean.slice(a,b+1));
    const valid=(parsed.looks||[]).slice(0,need).map(l=>({ids:(l.ids||[]).map(String).filter(id=>ids.has(id)).slice(0,6),why:String(l.why||"").slice(0,80)})).filter(l=>l.ids.length>=2);
    return res.status(200).json({looks:valid});
  }catch(e){console.error(e);return res.status(500).json({error:"Error interno creando looks."})}
}
