import { useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { assistantApi } from './assistantApi'
import { describeChatReply, chatMessageProblem } from './assistantChat'
import { assistantStore, useAssistantStore } from './assistantStore'
import { applyStreamEvent, emptyDraft, streamEnabled } from './chatStreamCore'
import { streamChat } from './chatStream'

const viewFromReply = (data) => describeChatReply(data)

/** Conversation actions shared by the drawer, the sheet and the /assistant page. */
export function useAssistantChat () {
  const store = useAssistantStore()
  const abortRef = useRef(null)
  const thread = store.threads.find((t) => t.id === store.activeId) || null

  const send = useCallback(async (raw) => {
    const text = String(raw || '').trim()
    if (!text || assistantStore.getState().sending) return false
    const problem = chatMessageProblem(text)
    if (problem) { toast.error(problem); return false }

    const threadId = assistantStore.getState().activeId || assistantStore.newThread()
    assistantStore.addMessage(threadId, { sender: 'user', text })
    assistantStore.setSending(true)
    try {
      if (streamEnabled()) {
        const msgId = assistantStore.addMessage(threadId, { sender: 'assistant', streaming: true, draft: emptyDraft() })
        let draft = emptyDraft()
        const controller = new AbortController()
        abortRef.current = controller
        const res = await streamChat(text, {
          signal: controller.signal,
          onEvent: (e) => { draft = applyStreamEvent(draft, e); assistantStore.patchMessage(threadId, msgId, { draft }) },
        })
        if (res.ok && draft.done && draft.reply) {
          assistantStore.patchMessage(threadId, msgId, { streaming: false, view: viewFromReply(draft.reply), draft: null })
          return true
        }
        if (res.unsupported) {
          // Endpoint not there yet: fall through to the single response below, reusing the same placeholder.
          const plain = await assistantApi.chat(text)
          assistantStore.patchMessage(threadId, msgId, { streaming: false, draft: null, view: plain.ok ? viewFromReply(plain.data) : { kind: 'refused', text: plain.message || 'The assistant could not complete this request.' } })
          return plain.ok
        }
        assistantStore.patchMessage(threadId, msgId, {
          streaming: false,
          draft: null,
          view: { kind: 'unavailable', text: res.canceled ? 'Stopped.' : (res.message || 'The answer was interrupted. Please try again.') },
        })
        return false
      }

      const res = await assistantApi.chat(text)
      const view = res.ok ? viewFromReply(res.data) : { kind: 'refused', text: res.message || 'The assistant could not complete this request.' }
      assistantStore.addMessage(threadId, { sender: 'assistant', view })
      return res.ok
    } catch (err) {
      assistantStore.addMessage(threadId, { sender: 'assistant', view: { kind: 'unavailable', text: err?.message || 'Connection lost. Please try again.' } })
      return false
    } finally {
      abortRef.current = null
      assistantStore.setSending(false)
    }
  }, [])

  const stop = useCallback(() => { abortRef.current?.abort() }, [])

  return { store, thread, messages: thread?.messages || [], sending: store.sending, send, stop }
}
