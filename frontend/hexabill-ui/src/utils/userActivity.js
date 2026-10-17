import { readApiErrorReason } from './apiError.js'

// Distinguishes a failed activity request from a user who simply has no activity.
export const loadUserActivity = async (fetcher) => {
  try {
    const res = await fetcher()
    if (res?.success && Array.isArray(res.data)) return { status: 'ok', logs: res.data, message: '' }
    return { status: 'error', logs: [], message: res?.message || 'Activity could not be loaded.' }
  } catch (error) {
    const reason = readApiErrorReason(error, '')
    const notFound = error?.response?.status === 404
    return {
      status: 'error',
      logs: [],
      message: reason || (notFound ? 'Activity service was not found.' : 'Activity could not be loaded. Try again.'),
    }
  }
}
