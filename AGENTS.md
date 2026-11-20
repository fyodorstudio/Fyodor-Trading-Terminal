# Working preferences

- Keep changes focused on the requested behavior. Prefer simple, practical fixes.
- Keep documentation about current usage and code ownership. Avoid accumulating
  audit narratives, provenance commentary, or speculative requirements.
- `dev:all` intentionally restarts everything in one command, including freeing
  its ports. Preserve that convenience unless the user requests a change.
- Leave visual UI audits to the user. Do not use computer use, browser automation,
  or screenshots unless explicitly requested. Use terminal tests, lint and builds,
  and report any remaining manual checks.
