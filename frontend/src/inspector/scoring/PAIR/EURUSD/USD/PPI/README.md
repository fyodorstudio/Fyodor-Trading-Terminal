# USD PPI v1

`policy/` declares the 50/30/15/5 core-monthly/core-annual/headline-monthly/
headline-annual weights. `assessment/` owns continuity, revision and core gates.
Monthly and annual inputs are grouped evidence; core/headline are overlapping
measures. This catalog's core excludes food and energy, not trade services.

The shared expanded-release worker/view and Scoring signal plot consume the
same canonical inputs. Settings scope: `PPI-V1-SIGNALS`; original raw PPI
A−P/A−Revised Previous settings are separate. The context engine allocates
2% to upstream prices inside its 40% inflation budget.
See the root scoring library and `scripts/audit-usd-menu-v5.mjs`.
