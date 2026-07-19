import { isPosEnterpriseV2 } from './pos/featureFlag'
import PosPageLegacy from './PosPageLegacy'
import PosEnterprisePage from './pos/PosEnterprisePage'

/**
 * POS entry: Enterprise keyboard-first shell by default.
 * Rollback: VITE_POS_ENTERPRISE_V2=false or localStorage.hexabill_pos_enterprise_v2=0
 */
export default function PosPage(props) {
  if (isPosEnterpriseV2()) {
    return <PosEnterprisePage {...props} />
  }
  return <PosPageLegacy {...props} />
}
