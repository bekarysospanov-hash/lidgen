// Знак услуги по её коду. Отдельным файлом, потому что нужен на трёх экранах
// сразу: в каталоге, на карточке и в кабинете, где мебельщик отмечает услуги
// и тут же видит, чем они обернутся в карточке.
//
// Соответствие «код → знак» живёт в одном месте намеренно. Разложенное
// по экранам, оно расходится: услуга появляется в списке, а знак к ней
// дорисовывают только там, где заметили.
import type { MasterService } from '../contract'
import {
  AppliancesIcon,
  AssemblyIcon,
  DeliveryIcon,
  DesignIcon,
  DismantleIcon,
  InstallmentsIcon,
  MeasureIcon,
  NonstandardIcon,
} from './icons'

const GLYPHS: Record<MasterService, () => React.ReactElement> = {
  measure: MeasureIcon,
  design: DesignIcon,
  delivery: DeliveryIcon,
  assembly: AssemblyIcon,
  dismantle: DismantleIcon,
  appliances: AppliancesIcon,
  installments: InstallmentsIcon,
  nonstandard: NonstandardIcon,
}

export function ServiceIcon({ id }: { id: MasterService }) {
  const Glyph = GLYPHS[id]
  return <Glyph />
}
