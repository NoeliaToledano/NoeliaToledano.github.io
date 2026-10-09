#!/usr/bin/env python3
"""Export genuine FashionCLIP image embeddings from authorized LOCAL photographs.

Usage:
 python atelier/benchmarks/real-photos/fashionclip-export.py \
   --labels atelier/benchmarks/real-photos/labels-polyvore.json \
   --images-root atelier/benchmarks/real-photos \
   --output /tmp/fashionclip-embeddings.json

Optional dependencies: pip install torch transformers pillow
Downloads pretrained weights from the official Hugging Face repository on first run.
No wardrobe images are uploaded by this script; execution and cached model files stay local.
The output can be consumed by embeddings-to-pairs.mjs. This is real visual feature
extraction but pairwise cosine remains a diagnostic, NOT a trained outfit scorer.
"""
import argparse
import json
import math
from pathlib import Path


DEFAULT_MODEL = "patrickjohncyh/fashion-clip"


def read_items(path, root):
    rows = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(rows, list) or not rows:
        raise ValueError("labels must be a nonempty list")
    root = Path(root).resolve()
    result = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("each row must be an object")
        key = row.get("id")
        category = row.get("category")
        relative = row.get("file")
        if not all(isinstance(x, str) and x for x in (key, category, relative)):
            raise ValueError("every item needs id, category and file")
        if key in seen:
            raise ValueError("duplicate garment id: " + key)
        seen.add(key)
        image = (root / relative).resolve()
        if not image.is_relative_to(root):
            raise ValueError("image path escapes image root: " + relative)
        if not image.is_file():
            raise FileNotFoundError("local image missing: " + str(image))
        result.append((key, category, image))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", required=True)
    parser.add_argument("--images-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--ids", help="Optional comma-separated garment IDs for a small authorized pilot")
    args = parser.parse_args()
    if args.batch_size <= 0 or args.batch_size > 64:
        parser.error("--batch-size must be between 1 and 64")
    if args.ids:
        requested = {x.strip() for x in args.ids.split(",") if x.strip()}
        if not requested:
            parser.error("--ids must contain at least one item ID")
        data = json.loads(Path(args.labels).read_text(encoding="utf-8"))
        present = {x.get("id") for x in data if isinstance(x, dict)}
        absent = requested - present
        if absent:
            parser.error("unknown --ids: " + ", ".join(sorted(absent)))
        # Only inspect the requested photos: a pilot need not own all 86 originals.
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as td:
            selected = Path(td) / "selected.json"
            selected.write_text(json.dumps([x for x in data if x.get("id") in requested]), encoding="utf-8")
            items = read_items(selected, args.images_root)
    else:
        items = read_items(args.labels, args.images_root)
    try:
        import torch
        from PIL import Image
        from transformers import CLIPModel, CLIPProcessor
    except ImportError as exc:
        raise SystemExit("Install local optional dependencies: pip install torch transformers pillow") from exc
    processor = CLIPProcessor.from_pretrained(args.model)
    model = CLIPModel.from_pretrained(args.model)
    model.eval()
    exported = {}
    for start in range(0, len(items), args.batch_size):
        chunk = items[start:start + args.batch_size]
        images = []
        try:
            for _, _, path in chunk:
                with Image.open(path) as im:
                    images.append(im.convert("RGB"))
            inputs = processor(images=images, return_tensors="pt", padding=True)
            with torch.inference_mode():
                features = model.get_image_features(**inputs)
            # Transformers releases may return either a tensor or a model output.
            if not torch.is_tensor(features):
                features = features.pooler_output
            vectors = features.float().cpu().tolist()
            for (key, category, _), v in zip(chunk, vectors):
                if len(v) < 2 or not all(math.isfinite(n) for n in v):
                    raise ValueError("invalid embedding for " + key)
                exported[key] = {"type": category, "vector": v}
        finally:
            for image in images:
                image.close()
    if len(exported) != len(items):
        raise RuntimeError("some embeddings were not exported")
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(exported, ensure_ascii=False), encoding="utf-8")
    print(f"Exported {len(exported)} real image vectors from {args.model} -> {target}")


if __name__ == "__main__":
    main()
