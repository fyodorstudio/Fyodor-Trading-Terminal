# Discovery regression evaluation

Run storage/tests/test_discovery_audit.py for observable coverage, chronology and
store read-back invariants. Fixtures preserve the original invocation cutoff and
unmodified publisher XML. Keep preliminary facts separate from later results;
the result announcement clock does not establish its publication time.

For a behavioral replay, give an independent agent only request.txt, the merged
skill and cutoff-appropriate raw publisher evidence. Do not give it the later
results, expected answer, prior investigation, or this evaluation document.
Require isolated stores and actual action/read-back records. An offline replay
cannot establish live search completeness: unavailable web checks must remain
disclosed, without fabricated alternate retrieval attempts. Inspect source checks
and saved records, rather than scoring prose or keyword matches alone.

Acceptance for the original case: surface the imminent operation window, preserve
the known cap without inventing offered/accepted results, and save/read back dated
stage pins with chart requests before backdrop work. Also test a different
currency/policy stage, missing source families, actual retrieval failures,
read-only overrides, stale/archived pins and a new request overriding an earlier
browser hide while preserving a subsequent user hide. Unit checks establish these
invariants, not guaranteed discovery of every news item.
