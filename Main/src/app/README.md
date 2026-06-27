# App Shell Map

`App.tsx` should stay focused on app-shell state and layout:

- global tab selection;
- bridge feed and market-status hooks;
- theme preference hook;
- header, top navigation, and shell layout.

`AppRoutes.tsx` owns route rendering and lazy tab imports. Keep route ids stable unless the user explicitly approves a routing migration.

Use narrower maps for deeper work:

- `tabs/README.md` for primary vs secondary tab ownership.
- `hooks/README.md` for app-shell side effects.
- `types/README.md` for type domains.
- `lib/README.md` for pure logic/data helpers.
