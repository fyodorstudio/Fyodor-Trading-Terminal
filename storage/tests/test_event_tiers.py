import json
from pathlib import Path
from unittest import TestCase

from storage.detail_registry import registry
from storage.event_tiers import metric_tier, tier_catalog


class EventTierTests(TestCase):
    def test_entire_calendar_and_detail_share_exact_identity_tiers(self):
        root=Path(__file__).resolve().parents[2]
        events=json.loads((root/'frontend/src/economic-calendar/catalog/source-events.json').read_text(encoding='utf-8'))
        catalog=tier_catalog()
        self.assertEqual([t['id'] for t in catalog['tiers']],['S','A','B','C'])
        self.assertEqual(set(catalog['series']),{e['id'] for e in events})
        for event in events:
            entry=catalog['series'][event['id']]
            self.assertEqual((entry['currency'],entry['country']),(event['currency'],event['country']))
            self.assertIn(entry['tier'],'SABC')
            if entry.get('publisher'):self.assertIn(entry['publisher'],catalog['publishers'])
            if event['sector']!='holidays':
                self.assertIn('publisher',entry,event['id'])
                self.assertTrue(catalog['publishers'][entry['publisher']]['url'].startswith('https://'))
        for metric in registry()['metrics']:
            self.assertEqual(metric_tier(metric),metric['tier'],metric['id'])
        self.assertEqual(set(catalog['currencies']),{'USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'})

    def test_requested_currency_exceptions_and_no_importance_dependency(self):
        entries=tier_catalog()['series']
        for identity,tier in {'840030005':'S','840030019':'S','840010002':'A','840140001':'B',
            '999030020':'B','276010021':'A','999030023':'A','826010001':'S','392050001':'A',
            '756040003':'B','124010033':'S','124020001':'B','36030014':'S','554010014':'S'}.items():
            self.assertEqual(entries[identity]['tier'],tier,identity)
        metric=next(m for m in registry()['metrics'] if m['id']=='eur.hicp-yoy')
        self.assertEqual(metric_tier({**metric,'importance':'low'}),'S')
        self.assertEqual(metric_tier({**metric,'broker_country':'US','tier':'C'}),'C')
