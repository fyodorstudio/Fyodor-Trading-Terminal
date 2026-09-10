# App Shell Map

`App.tsx` should stay focused on app-shell state and layout:

- chart-first route selection and retained secondary-route return state;
- bridge feed and market-status hooks;
- theme preference hook;
- Calendar bottom-dock state, appearance settings, and shell layout.

Chart panel placement is constrained and persisted by `features/chart-viewport/chartDockRegistry.ts`; it is not free-form docking.

`AppRoutes.tsx` owns route rendering and lazy tab imports. Charts is the startup workspace; Calendar is embedded in its bottom dock. Retained route ids remain renderable even when they are absent from normal navigation.

Use narrower maps for deeper work:

- `tabs/README.md` for primary vs secondary tab ownership.
- `hooks/README.md` for app-shell side effects.
- `types/README.md` for type domains.
- `lib/README.md` for pure logic/data helpers.
