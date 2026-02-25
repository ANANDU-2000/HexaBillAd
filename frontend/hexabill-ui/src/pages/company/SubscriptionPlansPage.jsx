import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CreditCard, Calendar, Users, FileText, Package, Database, Zap, Shield } from 'lucide-react'
import { subscriptionAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard } from '../../components/Loading'
import Modal from '../../components/Modal'
import toast from 'react-hot-toast'
import { showToast } from '../../utils/toast'

const SubscriptionPlansPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [currentSubscription, setCurrentSubscription] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [billingCycle, setBillingCycle] = useState('Monthly')

  useEffect(() => {
    fetchData()
  }, [])

  // After Stripe redirect: show success/cancel and refetch
  useEffect(() => {
    const success = searchParams.get('success')
    const cancel = searchParams.get('cancel')
    if (success === '1') {
      toast.success('Payment successful! Your subscription is active.')
      setSearchParams({})
      fetchData()
    } else if (cancel === '1') {
      showToast.info('Payment cancelled.')
      setSearchParams({})
    }
  }, [searchParams])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [plansResponse, subscriptionResponse] = await Promise.all([
        subscriptionAPI.getPlans(),
        subscriptionAPI.getCurrentSubscription().catch(() => ({ success: false }))
      ])

      if (plansResponse.success) {
        setPlans(plansResponse.data || [])
      }

      if (subscriptionResponse.success) {
        setCurrentSubscription(subscriptionResponse.data)
      }
    } catch (error) {
      console.error('Error loading subscription data:', error)
      toast.error('Failed to load subscription plans')
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (plan) => {
    setSelectedPlan(plan)
    setShowConfirmModal(true)
  }

  const confirmSubscribe = async () => {
    if (!selectedPlan) return
    const cycle = billingCycle === 'Monthly' ? 'Monthly' : 'Yearly'
    const baseUrl = window.location.origin
    const successUrl = `${baseUrl}/subscription-plans?success=1`
    const cancelUrl = `${baseUrl}/subscription-plans?cancel=1`

    try {
      // Try Stripe Checkout first (PRODUCTION_MASTER_TODO #43)
      const checkoutRes = await subscriptionAPI.createCheckoutSession(selectedPlan.id, cycle, successUrl, cancelUrl)
      if (checkoutRes?.success && checkoutRes?.data?.url) {
        setShowConfirmModal(false)
        setSelectedPlan(null)
        toast.success('Redirecting to payment...')
        window.location.href = checkoutRes.data.url
        return
      }

      // Fallback: no payment gateway configured — create trial subscription
      const response = await subscriptionAPI.createSubscription(selectedPlan.id, cycle)
      if (response.success) {
        toast.success('Subscription created successfully!')
        setShowConfirmModal(false)
        setSelectedPlan(null)
        fetchData()
      } else {
        toast.error(response.message || 'Failed to create subscription')
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        // Gateway not configured — create trial
        try {
          const response = await subscriptionAPI.createSubscription(selectedPlan.id, cycle)
          if (response.success) {
            toast.success('Subscription created (trial).')
            setShowConfirmModal(false)
            setSelectedPlan(null)
            fetchData()
          } else {
            toast.error(response.message || 'Failed to create subscription')
          }
        } catch (e) {
          console.error(e)
          toast.error('Failed to create subscription')
        }
        return
      }
      console.error('Error creating subscription:', error)
      toast.error('Failed to create subscription')
    }
  }

  const getFeatureIcon = (feature) => {
    switch (feature) {
      case 'users': return <Users className="h-4 w-4" />
      case 'invoices': return <FileText className="h-4 w-4" />
      case 'customers': return <Users className="h-4 w-4" />
      case 'products': return <Package className="h-4 w-4" />
      case 'storage': return <Database className="h-4 w-4" />
      case 'reports': return <Zap className="h-4 w-4" />
      case 'api': return <Shield className="h-4 w-4" />
      default: return <Check className="h-4 w-4" />
    }
  }

  const formatLimit = (value) => {
    if (value === -1) return 'Unlimited'
    return value.toLocaleString()
  }

  if (loading) {
    return (
      <div className="p-6">
        <LoadingCard />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
        <p className="text-gray-600 mt-2">Choose the plan that fits your business needs</p>
      </div>

      {/* Current Subscription Banner */}
      {currentSubscription && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Current Plan</p>
              <p className="text-lg font-bold text-blue-900">{currentSubscription.plan.name}</p>
              <p className="text-sm text-blue-700">
                {currentSubscription.status === 'Trial' && currentSubscription.trialEndDate && (
                  <>Trial ends: {new Date(currentSubscription.trialEndDate).toLocaleDateString()}</>
                )}
                {currentSubscription.status === 'Active' && (
                  <>Active • {currentSubscription.billingCycle} billing</>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(currentSubscription.amount)}
              </p>
              <p className="text-sm text-blue-700">per {currentSubscription.billingCycle.toLowerCase()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-300 p-1 bg-white">
          <button
            onClick={() => setBillingCycle('Monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              billingCycle === 'Monthly'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('Yearly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              billingCycle === 'Yearly'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Yearly
            <span className="ml-1 text-xs text-green-600">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = billingCycle === 'Monthly' ? plan.monthlyPrice : plan.yearlyPrice
          const isCurrentPlan = currentSubscription?.plan?.id === plan.id

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg border-2 p-6 relative ${
                isCurrentPlan ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              {isCurrentPlan && (
                <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  Current Plan
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                {plan.description && (
                  <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatCurrency(price)}
                  </span>
                  <span className="text-gray-600 ml-2">
                    /{billingCycle === 'Monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingCycle === 'Yearly' && (
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(plan.monthlyPrice)}/month billed annually
                  </p>
                )}
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm">
                  {getFeatureIcon('users')}
                  <span className="ml-2 text-gray-700">
                    {formatLimit(plan.maxUsers)} users
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  {getFeatureIcon('invoices')}
                  <span className="ml-2 text-gray-700">
                    {formatLimit(plan.maxInvoicesPerMonth)} invoices/month
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  {getFeatureIcon('customers')}
                  <span className="ml-2 text-gray-700">
                    {formatLimit(plan.maxCustomers)} customers
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  {getFeatureIcon('products')}
                  <span className="ml-2 text-gray-700">
                    {formatLimit(plan.maxProducts)} products
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  {getFeatureIcon('storage')}
                  <span className="ml-2 text-gray-700">
                    {formatLimit(plan.maxStorageMB)} MB storage
                  </span>
                </div>
                {plan.hasAdvancedReports && (
                  <div className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="ml-2 text-gray-700">Advanced Reports</span>
                  </div>
                )}
                {plan.hasApiAccess && (
                  <div className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="ml-2 text-gray-700">API Access</span>
                  </div>
                )}
                {plan.hasPrioritySupport && (
                  <div className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="ml-2 text-gray-700">Priority Support</span>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isCurrentPlan}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  isCurrentPlan
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isCurrentPlan ? 'Current Plan' : 'Subscribe'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Confirm Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          setSelectedPlan(null)
        }}
        title="Confirm Subscription"
      >
        {selectedPlan && (
          <div className="space-y-4">
            <p className="text-gray-600">
              You are about to subscribe to <strong>{selectedPlan.name}</strong> plan.
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Plan:</span>
                <span className="font-semibold">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Billing Cycle:</span>
                <span className="font-semibold">{billingCycle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Price:</span>
                <span className="font-bold text-lg">
                  {formatCurrency(billingCycle === 'Monthly' ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice)}
                  /{billingCycle === 'Monthly' ? 'month' : 'year'}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              You will start with a {selectedPlan.trialDays}-day free trial.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setSelectedPlan(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubscribe}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm Subscription
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SubscriptionPlansPage

