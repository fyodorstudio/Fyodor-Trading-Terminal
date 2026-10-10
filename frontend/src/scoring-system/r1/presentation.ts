import type {R1Balance} from './contracts'

export function r1DirectionLabel(b:R1Balance,currency='USD') {
  return b.direction==='strengthening'?`${currency} Strengthening`:b.direction==='weakening'?`${currency} Weakening`:b.direction==='balanced'?'Balanced evidence':b.direction==='empty'?'No evidence selected':'Insufficient evidence'
}
