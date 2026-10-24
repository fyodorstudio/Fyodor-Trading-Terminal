"""Commodity research identities, separate from the eight-currency calendar."""
import json
from pathlib import Path
from typing import Literal

INSTRUMENTS = json.loads((Path(__file__).resolve().parents[1] / 'config/research-instruments.json').read_text(encoding='utf-8'))
Commodity = Literal['BRENT', 'WTI', 'GOLD']


def is_commodity(scope):
    return scope in INSTRUMENTS
