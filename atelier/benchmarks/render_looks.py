#!/usr/bin/env python3
"""Produce a local, human-readable HTML contact sheet and CSV review template.

Usage: python atelier/benchmarks/render_looks.py look-benchmark/looks.json
Open look-benchmark/review.html. Fill look-benchmark/review.csv with human ratings.
"""
import csv
import html
import json
import sys
from pathlib import Path

def main():
    if len(sys.argv)!=2:
        raise SystemExit("Usage: python atelier/benchmarks/render_looks.py bank/looks.json")
    source=Path(sys.argv[1])
    data=json.loads(source.read_text(encoding="utf-8"))
    looks=data.get("looks",[])
    parts=[]
    for look in looks:
        pieces=[]
        for garment in look.get("garments",[]):
            image=html.escape(str(garment.get("image") or ""),quote=True)
            title=html.escape(str(garment.get("name") or "Prenda"))
            category=html.escape(str(garment.get("category") or ""))
            pic=('<img loading="lazy" src="'+image+'" alt="'+title+'">') if image else '<div class="placeholder">Sin fotografía</div>'
            pieces.append('<figure>'+pic+'<figcaption>'+title+' <span>'+category+'</span></figcaption></figure>')
        flag=', '.join(look.get("flags",[])) or "Sin alertas automáticas"
        parts.append('<article><header><b>'+html.escape(str(look["id"]))+'</b><span>'+
            html.escape(str(look.get("occasion","")))+' · '+html.escape(str(look.get("temperature","")))+
            ' °C · Puntuación '+html.escape(str(look.get("score","—")))+'</span></header>'+
            '<div class="pieces">'+''.join(pieces)+'</div><p class="flags">'+html.escape(flag)+
            '</p><p class="notes">Valorar estética, ocasión, coherencia y si te lo pondrías; registrar en review.csv.</p></article>')
    styles="""body{font:14px system-ui;background:#faf9f7;color:#222;padding:24px;margin:auto;max-width:1400px}
h1{font:normal 35px Georgia,serif}article{border:1px solid #ddd;background:white;border-radius:16px;padding:16px;margin:16px 0}
header{display:flex;justify-content:space-between;gap:20px}.pieces{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px}
figure{margin:14px 0}figure img,.placeholder{width:100%;aspect-ratio:3/4;object-fit:contain;background:#f4f2ef;border-radius:9px}
.placeholder{display:grid;place-items:center;color:#888}figcaption{font-size:12px;margin-top:7px}figcaption span{display:block;color:#888}
.flags{color:#7a3f22}.notes{font-size:12px;color:#777}"""
    page='<!doctype html><html lang="es"><meta charset="utf-8"><title>Atelier · Auditoría visual</title><style>'+styles+'</style><h1>Auditoría visual de looks</h1><p>'+str(len(looks))+' looks para revisar, sin consumir IA ni subir las fotos</p>'+''.join(parts)+'</html>'
    (source.parent/"review.html").write_text(page,encoding="utf-8")
    with (source.parent/"review.csv").open("w",encoding="utf-8",newline="") as out:
        writer=csv.writer(out)
        writer.writerow(["look_id","occasion","temperature","automatic_flags","wearable_yes_no","aesthetics_1_to_5","issue","notes"])
        for look in looks:
            writer.writerow([look["id"],look.get("occasion",""),look.get("temperature",""),"|".join(look.get("flags",[])),"","","",""])
    print("Created",source.parent/"review.html","and",source.parent/"review.csv",":",len(looks),"looks")

if __name__=="__main__":
    main()
