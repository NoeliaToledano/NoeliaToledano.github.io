#!/usr/bin/env python3
"""Build a LOCAL photo bank for Atelier outfit evaluation (never uploads images).

Install: pip install datasets pillow
Run: python atelier/benchmarks/prepare_photo_bank.py --output ./look-benchmark --limit 1000

Source: https://huggingface.co/datasets/Marqo/polyvore
Inspect the source terms and original image rights before redistribution.
The text/category heuristics are only a first pass: audit annotations manually.
"""
import argparse
import json
import re
from pathlib import Path

CATEGORY = [
    ("Vestidos", r"\bdress\b|\bjumpsuit\b|\bromper\b|\bgown\b"),
    ("Zapatos", r"\bshoe|\bsneaker|\bboot|\bsandal|\bheel|\bflip.flop"),
    ("Bolsos", r"\bbag\b|\bhandbag\b|\bclutch\b|\bpurse\b|\btote\b"),
    ("Capas", r"\bcoat\b|\bjacket\b|\bblazer\b|\bcardigan\b|\bouterwear"),
    ("Abajo", r"\bjean|\btrouser|\bpant|\bskirt|\bshorts?\b|\blegging"),
    ("Arriba", r"\bshirt\b|\bblouse\b|\btop\b|\bsweater\b|\bhoodie\b|\bt.shirt"),
    ("Accesorios", r"\bhat\b|\bbeanie\b|\bscarf\b|\bbelt\b|\bjewel|\bgloves?\b"),
]
def classify(text):
    for category, pattern in CATEGORY:
        if re.search(pattern, text, flags=re.I):
            return category
    return None

def main():
    from datasets import load_dataset
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",default="look-benchmark")
    ap.add_argument("--limit",type=int,default=1000)
    ap.add_argument("--seed",type=int,default=42)
    args=ap.parse_args()
    out=Path(args.output)
    (out/"images").mkdir(parents=True,exist_ok=True)
    data=load_dataset("Marqo/polyvore",split="train",streaming=True)
    data=data.shuffle(seed=args.seed,buffer_size=2000)
    per=max(1,args.limit//len(CATEGORY))
    counts={cat:0 for cat,_ in CATEGORY}
    selected=[]
    for row in data:
        text=str(row.get("text") or row.get("name") or "")
        raw_cat=str(row.get("category") or "")
        cat=classify(raw_cat+" "+text)
        if not cat or counts[cat]>=per: continue
        img=row.get("image")
        if img is None: continue
        try:
            if isinstance(img,dict) and img.get("bytes"):
                from io import BytesIO
                from PIL import Image
                img=Image.open(BytesIO(img["bytes"]))
            img=img.convert("RGB")
            img.thumbnail((640,800))
            ident="item-"+str(len(selected)+1).zfill(4)
            filename="images/"+ident+".jpg"
            img.save(out/filename,format="JPEG",quality=82)
        except (OSError,AttributeError,TypeError):
            continue
        selected.append({"id":ident,"name":text[:140] or raw_cat[:140],
                         "category":cat,"image":filename,
                         "source_id":str(row.get("item_ID") or ""),
                         "raw_category":raw_cat,"style":"","season":"","color":"",
                         "reviewed":False})
        counts[cat]+=1
        if len(selected)>=args.limit or all(v>=per for v in counts.values()):
            break
    (out/"garments.json").write_text(json.dumps(selected,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"selected":len(selected),"categories":counts,"output":str(out)},ensure_ascii=False))
    print("Annotations are NOT verified. Review metadata before evaluating outfit quality.")

if __name__=="__main__":
    main()
