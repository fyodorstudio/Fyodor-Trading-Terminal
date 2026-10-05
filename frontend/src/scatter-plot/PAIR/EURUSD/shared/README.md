# EURUSD shared family bindings

`create-scatter-binding.ts` binds the explicitly registered numeric EUR/Base and
USD/Quote families to shared controls, inventory, settings and the family model.
Canonical IDs/names live under `inspector/grading/catalog/EUR/` and `USD/`;
magnitude scopes live in `inspector/magnitude/magnitude-families.ts`.

NFP/CPI/PPI retain their original thin adapters and saved settings keys. Additional
numeric families use this factory rather than duplicate per-family calculation or
rendering files. Family-specific scoring belongs to the Inspector scoring tree.
Future pairs should provide their own bindings and independent settings scopes.
