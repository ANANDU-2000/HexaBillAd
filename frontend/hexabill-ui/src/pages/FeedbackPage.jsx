import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Send, Star, MessageSquare, Bug, Lightbulb, Heart } from 'lucide-react'
// Layout removed - can be used by both tenant and SuperAdmin
import { Input } from '../components/Form'
import { LoadingButton } from '../components/Loading'
import { showToast } from '../utils/toast'
import { useAuth } from '../hooks/useAuth'
import { useBranding } from '../contexts/TenantBrandingContext'

const FeedbackPage = () => {
  const { user } = useAuth()
  const { companyName } = useBranding()
  const [rating, setRating] = useState(0)
  const [feedbackType, setFeedbackType] = useState('general')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm()

  const feedbackTypes = [
    { id: 'general', label: 'General Feedback', icon: <MessageSquare className="h-5 w-5" /> },
    { id: 'bug', label: 'Report a Bug', icon: <Bug className="h-5 w-5" /> },
    { id: 'feature', label: 'Feature Request', icon: <Lightbulb className="h-5 w-5" /> },
    { id: 'praise', label: 'Praise & Appreciation', icon: <Heart className="h-5 w-5" /> }
  ]

  const onSubmit = async (data) => {
    if (rating === 0 && feedbackType !== 'bug') {
      showToast.error('Please provide a rating')
      return
    }

    setLoading(true)
    try {
      // TODO: Implement API call to submit feedback
      // await api.post('/feedback', { ...data, rating, type: feedbackType, userId: user?.id })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      showToast.success('Thank you for your feedback! We appreciate your input.')
      reset()
      setRating(0)
      setFeedbackType('general')
    } catch (error) {
      showToast.error('Failed to submit feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Share Your Feedback</h1>
          <p className="text-gray-600">
            Your feedback helps us improve {companyName}. We value your input and suggestions.
          </p>
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Feedback Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What type of feedback is this?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {feedbackTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFeedbackType(type.id)}
                  className={`p-4 border-2 rounded-lg transition ${
                    feedbackType === type.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`${feedbackType === type.id ? 'text-blue-600' : 'text-gray-400'}`}>
                      {type.icon}
                    </div>
                    <span className={`text-sm font-medium ${
                      feedbackType === type.id ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {type.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Rating (skip for bug reports) */}
          {feedbackType !== 'bug' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How would you rate your experience?
              </label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`p-2 rounded transition ${
                      rating >= star
                        ? 'text-yellow-400 hover:text-yellow-500'
                        : 'text-gray-300 hover:text-gray-400'
                    }`}
                  >
                    <Star className="h-8 w-8 fill-current" />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-3 text-sm text-gray-600">
                    {rating === 5 ? 'Excellent!' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : rating === 2 ? 'Below Average' : 'Poor'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <Input
              label="Subject"
              placeholder="Brief summary of your feedback"
              required
              error={errors.subject?.message}
              {...register('subject', {
                required: 'Subject is required',
                minLength: { value: 5, message: 'Subject must be at least 5 characters' }
              })}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Details <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Please provide detailed feedback..."
              {...register('message', {
                required: 'Message is required',
                minLength: { value: 10, message: 'Message must be at least 10 characters' }
              })}
            />
            {errors.message && (
              <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
            )}
          </div>

          {/* Contact Info (optional) */}
          <div>
            <Input
              label="Email (optional)"
              type="email"
              placeholder={user?.email || "your@email.com"}
              defaultValue={user?.email || ''}
              error={errors.email?.message}
              {...register('email', {
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
            />
            <p className="mt-1 text-xs text-gray-500">
              We'll only use this to follow up if needed
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <LoadingButton
              type="submit"
              loading={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Feedback
            </LoadingButton>
          </div>
        </form>

        {/* Thank You Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Thank you for taking the time to share your feedback!</strong> We read every 
            submission and use it to improve {companyName}. Your input makes a difference.
          </p>
        </div>
      </div>
    </div>
  )
}

export default FeedbackPage
