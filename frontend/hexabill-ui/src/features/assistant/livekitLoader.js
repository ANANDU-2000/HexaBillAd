// NEEDS-DEPENDENCY: livekit-client is not installed in this branch (loop rule: no installs from a worktree).
// After `npm install livekit-client` (UX-E05 allows it), replace the body with:  export const loadLivekit = () => import('livekit-client')
// and set LIVEKIT_INSTALLED = true. Until then voice mode reports "unavailable" and the panel keeps the browser push-to-talk.
export const LIVEKIT_INSTALLED = false
export const loadLivekit = async () => { throw new Error('livekit-client is not installed') }
