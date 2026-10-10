"""Read-only R1 source replay input. No migrations, collection or data writes."""
import argparse
import json
from pathlib import Path
from .calendar_store import CalendarStore, HISTORY_START


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--database', type=Path, required=True)
    parser.add_argument('--as-of', type=int, required=True)
    parser.add_argument('--currency', choices=['USD','EUR','all'], default='USD')
    args=parser.parse_args()
    store=CalendarStore(args.database,readonly=True)
    try:
        currency=None if args.currency=='all' else args.currency
        source=store.db.execute("SELECT source_id,count(*) n FROM events WHERE (? IS NULL OR currency=?) GROUP BY source_id ORDER BY n DESC",(currency,currency)).fetchone()[0]
        events, cursor=[], {}
        while True:
            page=store.query(source,HISTORY_START,args.as_of//1000+2*86400,currency=currency,time_basis='chart',r1_as_of=args.as_of,**cursor)
            events.extend(page['events'])
            if not page['next_cursor']:
                break
            cursor=page['next_cursor']
        print(json.dumps({'events':events,'asOf':args.as_of,'schedules':page.get('r1_schedules',store.planned_schedules(source,args.as_of)),'source':source},separators=(',',':')))
    finally:
        store.close()


if __name__=='__main__':
    main()
