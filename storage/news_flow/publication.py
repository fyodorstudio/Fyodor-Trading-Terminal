"""Conservative date checks for dated sessions, not inferred event chronology."""
from datetime import date, datetime, timezone
import calendar
import re

from .rules import normalized

_months = {name.lower(): i for i in range(1, 13) for name in (calendar.month_name[i], calendar.month_abbr[i])}
_months['sept'] = 9
_month = r'(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)'
_session = re.compile(r'\b(?:news wrap|market wrap|markets wrap|option expiries|session recap)\b.{0,25}?\b(?P<day>\d{1,2})\s+(?P<month>' + _month + r')\b')
_period = re.compile(r'\b(?:inflation|cpi|hicp)\b.{0,55}\b(?:in|for) (?P<month>' + _month + r')\b|\b(?:us|u\.s\.) (?P<budget_month>' + _month + r') federal budget\b')


def publication_conflict(title, published_at, summary=''):
    if published_at is None:
        return ''
    try:
        published = datetime.fromtimestamp(published_at / 1000, timezone.utc).date()
    except (OverflowError, ValueError, OSError):
        return ''
    text = normalized(title)
    session = _session.search(text)
    period = _period.search(text)
    if session:
        candidates = []
        for year in (published.year - 1, published.year, published.year + 1):
            try:
                candidates.append(date(year, _months[session['month']], int(session['day'])))
            except ValueError:
                continue
        if candidates and min(abs((candidate - published).days) for candidate in candidates) > 2:
            return 'Dated session conflicts with feed publication date'
    elif period:
        if re.search(r'\b(?:corrects?|corrected|correcting|revis\w*|rebased|delayed|late release|finally released)\b|\b(?:data|inflation|cpi|figures)\b.{0,25}\bcorrections?\b', normalized(title + ' ' + summary)):
            return ''
        month = _months[period['month'] or period['budget_month']]
        year = published.year - int(month > published.month)
        period_end = date(year, month, calendar.monthrange(year, month)[1])
        # Ordinary publication lags are allowed. Old monthly CPI/budget reports
        # remain readable; a stated revision or delayed release stays eligible.
        if (published - period_end).days > (62 if period['budget_month'] else 92):
            return 'Older release period; verify original publication date'
    return ''
