import { verifySession } from "../_lib/auth.js";
import { dailyQuota } from "../_lib/store.js";

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
  const session=verifySession(req);
  if(!session) return res.status(401).json({error:"Sesión no válida o caducada."});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"Atelier AI aún no está configurado."});

  // Todo lo que entra en el prompt se valida y se recorta (coste y seguridad)
  const body=req.body||{}, short=(v,n)=>String(v??"").replace(/[\u0000-\u001f]/g," ").slice(0,n);
  const OCC=new Set(["daily","work","sport","beach","home","event","party","formal"]),SEASON=new Set(["all","warm","cold"]);
  const items=(Array.isArray(body.items)?body.items.slice(0,24):[]).filter(x=>x&&typeof x==="object").map(x=>{const o={i:short(x.i,4),n:short(x.n,40)};for(const f of ["c","color","style","pattern","formality"])if(x[f])o[f]=short(x[f],20);if(x.forgotten)o.forgotten=1;return o});
  body.occasion=OCC.has(body.occasion)?body.occasion:"libre";body.season=SEASON.has(body.season)?body.season:"cualquiera";
  body.weather=/^-?\d{1,2}(\.\d)? °C$/.test(String(body.weather||""))?body.weather:"25 °C";
  if(items.length<2) return res.status(400).json({error:"No hay suficientes prendas candidatas."});
  // Se cuenta solo si la petición es válida
  try{const q=await dailyQuota(session.sub,"looks",20);if(!q.ok)return res.status(429).json({error:"Has llegado al límite de 20 sugerencias de hoy. Mañana podrás seguir."})}catch(e){console.error("QUOTA",e.message)}
  const ids=new Set(items.map(x=>String(x.i)));
  const need=Math.max(1,Math.min(5,Number(body.need)||3));
  const taste=v=>(Array.isArray(v)?v:[]).slice(0,6).map(l=>(Array.isArray(l)?l:[]).map(String).filter(id=>ids.has(id)).slice(0,6)).filter(l=>l.length>=2);
  const liked=taste(body.liked), disliked=taste(body.disliked);
  const prompt=[
    "Eres estilista. Crea "+need+" looks usando SOLO los ids de items (campos: n=nombre, c=categoría). No inventes ids.",
    "Contexto: ocasión="+(body.occasion||"libre")+"; temporada="+(body.season||"cualquiera")+"; tiempo="+(body.weather||"25 °C")+".",
    "Reglas: looks completos (calzado y, si combinan, capa, bolso o complemento), variados y coherentes; no mezcles dos estampados ni formalidades muy distintas; evita avoid si hay alternativas.",
    liked.length?"Le gustaron (inspírate, no repitas): "+JSON.stringify(liked):"",
    disliked.length?"No le gustaron (evita parecidos): "+JSON.stringify(disliked):"",
    "avoid="+JSON.stringify((Array.isArray(body.avoid)?body.avoid:[]).map(String).filter(id=>ids.has(id)).slice(0,12)),
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
