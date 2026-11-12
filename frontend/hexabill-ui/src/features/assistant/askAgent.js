// UX-E06: "Ask agent about this" menu item for ledger rows. Opens the assistant with the composer pre-filled
// with a reference to the record (never an amount); the person still presses Send.
import { Sparkles } from '../../components/ui/icons'
import { openAssistant } from './assistantStore'
import { askAboutPrompt } from './assistantUi'
import { isAssistantEnabled } from './assistantDraft'

export const askAgentItem = (ref, extra = {}) => ({
  label: 'Ask agent about this',
  icon: Sparkles,
  hidden: !isAssistantEnabled(import.meta.env),
  onClick: () => openAssistant({ prefill: askAboutPrompt(ref) }),
  ...extra,
})
