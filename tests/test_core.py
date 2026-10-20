KEY='objects'
import unittest, json, tempfile, copy
from pathlib import Path
from core import validate, analyze
from server import Store, Conflict
SAMPLE=json.loads((Path(__file__).resolve().parents[1]/"examples/sample.json").read_text())
class Tests(unittest.TestCase):
    def fresh(self):return copy.deepcopy(SAMPLE)
    def test_sample_roundtrip(self):
        doc=validate(self.fresh());self.assertEqual(doc,validate(json.loads(json.dumps(doc))));self.assertTrue(analyze(doc)["metrics"])
    def test_invalid_version(self):
        for version in [True,2,"1",None]:
            d=self.fresh();d["version"]=version
            with self.assertRaises(ValueError):validate(d)
    def test_duplicate_identity(self):
        d=self.fresh();d[KEY].append(copy.deepcopy(d[KEY][0]))
        with self.assertRaises(ValueError):validate(d)
    def test_empty_document(self):
        d=self.fresh();d[KEY]=[];self.assertEqual(validate(d)[KEY],[]);analyze(validate(d))
    def test_oversized_collection(self):
        d=self.fresh();d[KEY]=[dict(d[KEY][0],id="x"+str(i)) for i in range(151)]
        with self.assertRaises(ValueError):validate(d)
    def test_storage_revision_and_reopen(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"library.sqlite3";store=Store(path)
            first=store.save({"revision":0,"document":self.fresh()});second=store.save({**first,"document":dict(first["document"],title="Changed")})
            self.assertEqual(second["revision"],2)
            with self.assertRaises(Conflict):store.save(first)
            self.assertEqual(Store(path).get(first["id"])["document"]["title"],"Changed")
    def test_invalid_save_preserves_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            store=Store(Path(tmp)/"library.sqlite3");first=store.save({"revision":0,"document":self.fresh()})
            with self.assertRaises(ValueError):store.save({**first,"document":{"version":2}})
            self.assertEqual(store.get(first["id"]),first)
    def test_boundary_and_boolean_dimensions(self):
        for key,value in [("x",-1),("width",True),("x",6000)]:
            d=self.fresh();d["objects"][0][key]=value
            with self.assertRaises(ValueError):validate(d)
    def test_touching_is_not_overlap(self):
        d=self.fresh();a=d["objects"][0];b=copy.deepcopy(a);b.update(id="adjacent",x=a["x"]+a["width"]);d["objects"]=[a,b]
        result=analyze(validate(d));self.assertEqual(result["overlaps"],[]);self.assertEqual(len(result["clearance"]),1)
    def test_overlap_and_wall_warning(self):
        d=self.fresh();d["objects"][1].update(x=0,y=0,width=1800,height=1000)
        result=analyze(validate(d));self.assertEqual(len(result["overlaps"]),1);self.assertIn("shelf",result["walls"])
    def test_valid_position_grid(self):
        for x in range(0,3000,137):
            d=self.fresh();d["objects"][0]["x"]=x;self.assertEqual(validate(d)["objects"][0]["x"],x)

if __name__=="__main__":unittest.main()
