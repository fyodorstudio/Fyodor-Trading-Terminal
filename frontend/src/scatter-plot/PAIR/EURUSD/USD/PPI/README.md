# EURUSD / USD Quote / US PPI

The scope config and adapter register four PPI rates with the shared Scatter
Plot engine. The canonical settings store is `inspector/magnitude/ppi-magnitude-settings.ts`;
its key is isolated from NFP and CPI and registered automatically for workspace
backup/restore through `magnitudeFamilies`.

Plots, line connections, histogram samples and N use Actual minus supplied
Previous. No forecast or revised Previous substitution. Boundaries start
Undefined and use the existing manual preview/Freeze/Unfreeze controls in pp.
The shared palette applies to PPI as well.

Inspector optionally shows A−RevP (Actual minus Revised Previous) below A−P.
It uses the same frozen series limits for a second size label. It does not add
a second dataset sample, scatter point, histogram or score. Ordinary A−P remains
visible even if it disagrees with the revision comparison. No PPI direction
score is registered.
