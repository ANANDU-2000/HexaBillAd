import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, title, message, itemName }) => {
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleConfirm = () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setError('Please type DELETE to confirm')
      return
    }
    onConfirm()
    setConfirmText('')
    setError('')
    onClose()
  }

  const handleClose = () => {
    setConfirmText('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{title || 'Confirm Deletion'}</h2>
              {itemName && <p className="text-sm text-gray-600 mt-1">Item: {itemName}</p>}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 mb-4">{message || 'This action cannot be undone. This will permanently delete the item.'}</p>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-bold text-red-600">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                setError('')
              }}
              placeholder="Type DELETE here"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 uppercase"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter' && confirmText.trim().toUpperCase() === 'DELETE') {
                  handleConfirm()
                }
              }}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirmText.trim().toUpperCase() !== 'DELETE'}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
            <button
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal

