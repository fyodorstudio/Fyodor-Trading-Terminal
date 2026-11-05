"""Read-only recent releases, dated by publication UTC rather than chart placement."""


def recent_snapshot(store, source_id, start_ms, end_ms, currencies):
    with store.lock:
        source = store.db.execute('SELECT id FROM sources WHERE id=?', (source_id,)).fetchone()
        # Ingestion bounds capture offsets to ±14 hours. Limit the indexed raw
        # time scan before applying publication UTC and currency predicates.
        rows = store.db.execute(f'''SELECT e.*,a.job_id absence_job,t.release_at,t.chart_time_seconds,
            t.capture_offset_seconds,t.basis,t.profile FROM events e
            JOIN event_timing t USING(source_id,value_id)
            LEFT JOIN query_absences a USING(source_id,value_id)
            WHERE e.source_id=? AND e.server_time>=? AND e.server_time<=?
                AND e.currency IN ({','.join('?' for _ in currencies)})
                AND t.release_at>=? AND t.release_at<=?
            ORDER BY t.release_at DESC,e.currency,e.value_id''',
            (source_id, start_ms // 1000 - 50400, end_ms // 1000 + 50400,
             *currencies, start_ms, end_ms)).fetchall()
        return {'source_id': source_id, 'from_utc_ms': start_ms, 'to_utc_ms': end_ms,
                'currencies': currencies, 'source_available': source is not None,
                'events': store.event_rows(rows)}
