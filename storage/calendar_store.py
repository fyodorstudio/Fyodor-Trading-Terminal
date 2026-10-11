from .currencies import CURRENCIES
from .persistence.support import canonical, DAY, HISTORY_START, merged_intervals, missing_intervals
from .persistence.schema import StoreSchema
from .persistence.observations import StoreObservations
from .persistence.coverage import StoreCoverage
from .persistence.backfill import StoreBackfill
from .persistence.queries import StoreQueries


class CalendarStore(StoreSchema, StoreObservations, StoreCoverage, StoreBackfill, StoreQueries):
    """One connection and lock; focused persistence modules share atomic transactions.

    Coverage is half-open in broker-server seconds, scoped by broker and currency.
    Recent/future intervals expire daily; historical observations survive restarts.
    """
