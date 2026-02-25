import toast from 'react-hot-toast'

export const showToast = {
  success: (message) => toast.success(message, {
    duration: 4000,
    style: {
      background: '#10B981',
      color: '#fff',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500'
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10B981'
    }
  }),

  error: (message) => toast.error(message, {
    duration: 5000,
    style: {
      background: '#EF4444',
      color: '#fff',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500'
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#EF4444'
    }
  }),

  warning: (message) => toast(message, {
    duration: 4000,
    style: {
      background: '#F59E0B',
      color: '#fff',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500'
    }
  }),

  info: (message) => toast(message, {
    duration: 4000,
    style: {
      background: '#3B82F6',
      color: '#fff',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500'
    }
  }),

  loading: (message) => toast.loading(message, {
    style: {
      background: '#6B7280',
      color: '#fff',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500'
    }
  })
}

export default showToast
