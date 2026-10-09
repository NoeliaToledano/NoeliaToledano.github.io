"""Offline tests, no model download."""
import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("attr",Path(__file__).with_name("fashionclip-attributes.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class FashionClipAttributeTests(unittest.TestCase):
    def test_correct_rank(self):
        x=m.rank_labels([1,0],{"good":[2,0],"bad":[0,1]})
        self.assertEqual([r["label"] for r in x],["good","bad"])
        self.assertEqual(x[0]["cosine"],1.0)
    def test_invalid_inputs(self):
        for v in ([0,0],[float("nan"),0],["1",0],[1]):
            with self.assertRaises(ValueError):
                m.normalize(v)
        with self.assertRaises(ValueError):
            m.rank_labels([1,0],{"wrong_dimensions":[1,0,0]})

if __name__=="__main__":
    unittest.main()
