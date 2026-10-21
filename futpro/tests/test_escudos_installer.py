import importlib.util
from pathlib import Path
import unittest

path=Path(__file__).resolve().parent.parent/'tools'/'instalar_escudos.py'
spec=importlib.util.spec_from_file_location('crests_installer',path)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class CrestTests(unittest.TestCase):
    def test_slug_accents(self):
        self.assertEqual(m.slug("O'Higgins"),'o-higgins')
        self.assertEqual(m.slug('Ñublense'),'nublense')
        self.assertEqual(m.slug('Bayern München'),'bayern-munchen')
    def test_exact_club(self):
        b={'manchester-city':['logos/england/Manchester_City.svg']}
        self.assertEqual(m.pick_one('Manchester City','england',b),b['manchester-city'][0])
    def test_conservative_names(self):
        self.assertIsNone(m.pick_one('Everton de Viña del Mar','chile',{'everton':['Chile/everton.png']}))
        self.assertIsNone(m.pick_one('Rangers de Talca','chile',{'rangers':['Chile/rangers.png']}))
    def test_alias_chile(self):
        self.assertEqual(m.pick_one('Colo-Colo','Chile',{'colocolo':['Chile/colocolo.png']}),'Chile/colocolo.png')
        self.assertEqual(m.pick_one('Universidad Católica','Chile',{'ucatolica':['Chile/ucatolica.png']}),'Chile/ucatolica.png')
    def test_source_matching_by_country(self):
        one=m.indexes(['logos/england/Arsenal.svg','logos/spain/Real_Madrid.svg','logos/england/Everton.svg'],0)
        two=m.indexes(['Chile/colocolo.png','Chile/ohiggins.png'],1)
        self.assertEqual(len(m.find_club({'club':'Arsenal','country':'ENG'},(one,two))),1)
        self.assertEqual(len(m.find_club({'club':'Colo-Colo','country':'CHI'},(one,two))),1)
        self.assertEqual(len(m.find_club({'club':'Everton de Viña del Mar','country':'CHI'},(one,two))),0)

    def test_new_liverpool_alias(self):
        b={'liverpool-fc':['logos/england/Liverpool_FC.svg']}
        self.assertEqual(m.pick_one('Liverpool','england',b),b['liverpool-fc'][0])
    def test_parent_club_for_reserve_team(self):
        b={'benfica':['logos/portugal/Benfica.svg']}
        self.assertEqual(m.pick_one('Benfica B','portugal',b),b['benfica'][0])
        self.assertEqual(m.pick_one('Benfica II','portugal',b),b['benfica'][0])
    def test_unambiguous_club_abbreviations(self):
        b={'sc-braga':['logos/portugal/SC_Braga.svg']}
        self.assertEqual(m.pick_one('Braga','portugal',b),b['sc-braga'][0])
        b={'liverpool-fc':['logos/england/Liverpool_FC.svg']}
        self.assertEqual(m.pick_one('Liverpool','england',b),b['liverpool-fc'][0])
    def test_ambiguous_club_names_not_guessed(self):
        b={'botafogo-fr':['logos/brazil/Botafogo_FR.svg'],
           'botafogo-sp':['logos/brazil/Botafogo_SP.svg'],
           'botafogo-pb':['logos/brazil/Botafogo_PB.svg']}
        self.assertIsNone(m.pick_one('Botafogo','brazil',b))
        self.assertIsNone(m.pick_one('Rangers de Talca','Chile', {'rangers':['Chile/rangers.png']}))
    def test_parent_team_parenthetical_not_guessed(self):
        self.assertIsNone(m.pick_one('River Plate (URU)','uruguay',{'river-plate-arg':['River_Plate_ARG.svg']}))

    def test_png_validation(self):
        self.assertFalse(m.valid_png(b'not a png'))
        self.assertTrue(m.valid_png(b'\x89PNG\r\n\x1a\n'+b'\0'*8+b'\x00\x00\x00\x64\x00\x00\x00\x64'))
    def test_svg_security(self):
        self.assertTrue(m.safe_svg(b'<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'))
        self.assertFalse(m.safe_svg(b'<svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script></svg>'))
        self.assertFalse(m.safe_svg(b'<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.com/x"/></svg>'))

if __name__=='__main__': unittest.main()
