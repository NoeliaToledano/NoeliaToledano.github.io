"""Stdlib-only tests of FashionCLIP data input safety: python -m unittest discover -s atelier/benchmarks/real-photos -p 'test_fashionclip_export.py'"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("fashionclip-export.py")
spec = importlib.util.spec_from_file_location("fashionclip_export", MODULE_PATH)
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


class InputTests(unittest.TestCase):
    def test_local_images_and_reject_traversal(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / "top.jpg").write_bytes(b"fake image for metadata validation")
            labels = root / "labels.json"
            labels.write_text(json.dumps([{"id": "top", "category": "Arriba", "file": "top.jpg"}]))
            self.assertEqual(export.read_items(labels, root)[0][0], "top")
            labels.write_text(json.dumps([{"id": "top", "category": "Arriba", "file": "../outside.jpg"}]))
            with self.assertRaises(ValueError):
                export.read_items(labels, root)

    def test_reject_duplicate_and_missing_photos(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / "a.jpg").write_bytes(b"x")
            labels = root / "labels.json"
            item = {"id": "a", "category": "Abajo", "file": "a.jpg"}
            labels.write_text(json.dumps([item, item]))
            with self.assertRaises(ValueError):
                export.read_items(labels, root)
            labels.write_text(json.dumps([{"id": "b", "category": "Abajo", "file": "notfound.jpg"}]))
            with self.assertRaises(FileNotFoundError):
                export.read_items(labels, root)


if __name__ == "__main__":
    unittest.main()
