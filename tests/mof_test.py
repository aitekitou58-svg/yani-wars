import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('parse_mof',ROOT/'scripts/parse-mof.py')
parser=importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)

class OfficialPDFFixtures(unittest.TestCase):
    def test_merged_cells_and_quarantine(self):
        result=parser.parse_pdf(ROOT/'tests/fixtures/20260826_kouriteikahenkou.pdf','https://www.mof.go.jp/policy/tab_salt/topics/20260826_kouriteikahenkou.pdf')
        products={p['name']:p for p in result['products']}
        self.assertEqual(products['テリア・メンソール']['packPrice'],640)
        self.assertEqual(products['テリア・メンソール']['count'],20)
        self.assertEqual(products['テリア・メンソール']['effectiveFrom'],'2026-10-01')
        self.assertIn('イタリア',products['テリア・メンソール']['countries'])
        self.assertEqual(products['センティア・クリア・シルバー']['packPrice'],590)
        self.assertGreater(len(result['quarantine']),0)
        self.assertNotIn('テリア・リッチ',products) # Open branched cell must not lose its regular suffix.

    def test_cigarette_price_revision(self):
        result=parser.parse_pdf(ROOT/'tests/fixtures/20260728_kouriteikahenkou.pdf','https://www.mof.go.jp/policy/tab_salt/topics/20260728_kouriteikahenkou.pdf')
        self.assertGreater(len(result['products']),0)
        self.assertTrue(all(p['type']=='紙巻き' for p in result['products']))
        self.assertTrue(all(p['effectiveFrom']=='2026-09-01' for p in result['products']))
        self.assertTrue(all(p['count']==20 for p in result['products']))

if __name__=='__main__':unittest.main()
