import { nfpScatterScope } from '../PAIR/EURUSD/USD/NFP/nfp-scatter-config'
import { nfpScatterModel } from '../PAIR/EURUSD/USD/NFP/nfp-scatter-adapter'
import { cpiScatterScope } from '../PAIR/EURUSD/USD/CPI/cpi-scatter-config'
import { cpiScatterModel } from '../PAIR/EURUSD/USD/CPI/cpi-scatter-adapter'
import { ppiScatterScope } from '../PAIR/EURUSD/USD/PPI/ppi-scatter-config'
import { ppiScatterModel } from '../PAIR/EURUSD/USD/PPI/ppi-scatter-adapter'
import { nfpMagnitudeFamily, cpiMagnitudeFamily, ppiMagnitudeFamily, expandedMagnitudeFamilies } from '../../inspector/magnitude/magnitude-families'
import { createScatterBinding } from '../PAIR/EURUSD/shared/create-scatter-binding'
import type { ScatterFamilyBinding } from './FamilyScatterPanel'

// Register future families once for both dock selection and Inspector navigation.
export const scatterFamilyBindings: ScatterFamilyBinding[] = [
  { family: nfpMagnitudeFamily, scope: nfpScatterScope, model: nfpScatterModel },
  { family: cpiMagnitudeFamily, scope: cpiScatterScope, model: cpiScatterModel },
  { family: ppiMagnitudeFamily, scope: ppiScatterScope, model: ppiScatterModel },
  ...expandedMagnitudeFamilies.map(createScatterBinding),
]
