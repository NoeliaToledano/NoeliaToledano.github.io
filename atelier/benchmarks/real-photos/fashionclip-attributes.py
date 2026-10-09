#!/usr/bin/env python3
"""Experimental FashionCLIP zero-shot attributes from LOCAL image embeddings.

First export image vectors using fashionclip-export.py (same --model).
Then run:
 python fashionclip-attributes.py --embeddings /tmp/fashionclip-embeddings.json \
  --output /tmp/fashionclip-attributes.json

Optional: pip install torch transformers
Scores are cosine similarities, NOT calibrated confidence or human outfit judgements.
Do not auto-overwrite manually confirmed garment attributes.
"""
import argparse
import json
import math
from pathlib import Path

DEFAULT_MODEL = "patrickjohncyh/fashion-clip"
PROMPTS = {
    "pattern": {
        "plain": "a photo of a plain solid color garment",
        "stripes": "a photo of a striped garment",
        "checks": "a photo of a checkered plaid garment",
        "floral": "a photo of a floral patterned garment",
        "animal": "a photo of an animal print garment",
        "graphic": "a photo of a garment with a graphic print",
    },
    "aesthetic": {
        "casual": "a photo of a casual everyday fashion garment",
        "smart": "a photo of a polished smart tailored fashion garment",
        "sport": "a photo of a sporty athletic garment",
        "party": "a photo of an elegant evening party garment",
    },
}

def normalize(vector):
    if not isinstance(vector, list) or len(vector) < 2 or any(
        isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v)
        for v in vector
    ):
        raise ValueError("Invalid embedding vector")
    mag = math.sqrt(sum(v * v for v in vector))
    if mag <= 0:
        raise ValueError("Zero embedding")
    return [v / mag for v in vector]

def rank_labels(image_vector, text_vectors):
    """Cosine rankings: probabilities and thresholds are deliberately not invented."""
    a = normalize(image_vector)
    out = []
    for label, vector in text_vectors.items():
        b = normalize(vector)
        if len(a) != len(b):
            raise ValueError("Image/text embedding dimension mismatch")
        out.append({"label": label, "cosine": round(sum(x*y for x,y in zip(a,b)), 6)})
    return sorted(out, key=lambda x: (-x["cosine"], x["label"]))

def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--embeddings", required=True)
    cli.add_argument("--output", required=True)
    cli.add_argument("--model", default=DEFAULT_MODEL)
    args = cli.parse_args()
    images = json.loads(Path(args.embeddings).read_text(encoding="utf-8"))
    if not isinstance(images, dict) or not images:
        cli.error("Expected a nonempty embeddings object")
    provenance = Path(args.embeddings + ".provenance.json")
    if provenance.exists():
        meta = json.loads(provenance.read_text(encoding="utf-8"))
        if meta.get("model") != args.model:
            cli.error("Image embedding model differs from text model; regenerate both using identical weights")
    try:
        import torch
        from transformers import CLIPModel, CLIPProcessor
    except ImportError as exc:
        raise SystemExit("Install local optional dependencies: pip install torch transformers") from exc
    processor = CLIPProcessor.from_pretrained(args.model)
    model = CLIPModel.from_pretrained(args.model)
    model.eval()
    prompts = [text for group in PROMPTS.values() for text in group.values()]
    tokenized = processor(text=prompts, return_tensors="pt", padding=True, truncation=True)
    with torch.inference_mode():
        features = model.get_text_features(**tokenized)
    if not torch.is_tensor(features):
        features = features.pooler_output
    text_vectors = features.float().cpu().tolist()
    groups = {}
    offset = 0
    for group, labels in PROMPTS.items():
        groups[group] = dict(zip(labels, text_vectors[offset:offset+len(labels)]))
        offset += len(labels)
    results = {}
    for key, item in images.items():
        if not isinstance(item, dict):
            raise ValueError("Bad garment record: " + key)
        vector = item.get("vector")
        results[key] = {
            "model": args.model,
            "predictions": {group: rank_labels(vector, vectors) for group, vectors in groups.items()}
        }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Ranked text attributes for {len(results)} garments -> {out}")

if __name__ == "__main__":
    main()
