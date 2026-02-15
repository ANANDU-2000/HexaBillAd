import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Receipt, Package, Users, FileText } from 'lucide-react'
import { Input, Select } from '../components/Form'
import { LoadingButton } from '../components/Loading'
import { productsAPI, customersAPI, salesAPI, settingsAPI } from '../services'
import toast from 'react-hot-toast'

const OnboardingWizard = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [completedSteps, setCompletedSteps] = useState([])
  
  // Step 1: Company Information
  const [companyInfo, setCompanyInfo] = useState({
    companyName: '',
    address: '',
    phone: '',
    email: ''
  })

  // Step 2: VAT Setup
  const [vatInfo, setVatInfo] = useState({
    vatNumber: '',
    vatRate: '5',
    currency: 'AED',
    country: 'AE'
  })

  // Step 3: First Product
  const [productInfo, setProductInfo] = useState({
    name: '',
    sku: '',
    price: '',
    stock: ''
  })

  // Step 4: First Customer
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: ''
  })

  // Step 5: First Invoice (will be created after product and customer)

  const steps = [
    { number: 1, title: 'Company Info', icon: Building2 },
    { number: 2, title: 'VAT Setup', icon: Receipt },
    { number: 3, title: 'Add Product', icon: Package },
    { number: 4, title: 'Add Customer', icon: Users },
    { number: 5, title: 'Create Invoice', icon: FileText }
  ]

  const handleStep1 = async () => {
    if (!companyInfo.companyName.trim()) {
      toast.error('Company name is required')
      return
    }

    try {
      setLoading(true)
      // Update company settings
      await settingsAPI.updateSettings({
        COMPANY_NAME_EN: companyInfo.companyName,
        COMPANY_ADDRESS: companyInfo.address || '',
        COMPANY_PHONE: companyInfo.phone || '',
        COMPANY_EMAIL: companyInfo.email || ''
      })
      
      setCompletedSteps([...completedSteps, 1])
      setCurrentStep(2)
      toast.success('Company information saved')
    } catch (error) {
      toast.error('Failed to save company information')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = async () => {
    try {
      setLoading(true)
      // Update VAT settings
      await settingsAPI.updateSettings({
        VAT_NUMBER: vatInfo.vatNumber || '',
        VAT_RATE: vatInfo.vatRate,
        CURRENCY: vatInfo.currency,
        COUNTRY: vatInfo.country
      })
      
      setCompletedSteps([...completedSteps, 2])
      setCurrentStep(3)
      toast.success('VAT settings saved')
    } catch (error) {
      toast.error('Failed to save VAT settings')
    } finally {
      setLoading(false)
    }
  }

  const handleStep3 = async () => {
    if (!productInfo.name.trim() || !productInfo.price) {
      toast.error('Product name and price are required')
      return
    }

    try {
      setLoading(true)
      await productsAPI.createProduct({
        nameEn: productInfo.name,
        sku: productInfo.sku || `SKU-${Date.now()}`,
        sellPrice: parseFloat(productInfo.price),
        stockQty: parseFloat(productInfo.stock || 0),
        unitType: 'PIECE',
        costPrice: parseFloat(productInfo.price) * 0.7 // Estimate
      })
      
      setCompletedSteps([...completedSteps, 3])
      setCurrentStep(4)
      toast.success('Product added successfully')
    } catch (error) {
      toast.error('Failed to add product')
    } finally {
      setLoading(false)
    }
  }

  const handleStep4 = async () => {
    if (!customerInfo.name.trim()) {
      toast.error('Customer name is required')
      return
    }

    try {
      setLoading(true)
      await customersAPI.createCustomer({
        nameEn: customerInfo.name,
        phone: customerInfo.phone || '',
        email: customerInfo.email || ''
      })
      
      setCompletedSteps([...completedSteps, 4])
      setCurrentStep(5)
      toast.success('Customer added successfully')
    } catch (error) {
      toast.error('Failed to add customer')
    } finally {
      setLoading(false)
    }
  }

  const handleStep5 = async () => {
    try {
      setLoading(true)
      // Get products and customers
      const productsResponse = await productsAPI.getProducts({ pageSize: 1 })
      const customersResponse = await customersAPI.getCustomers({ pageSize: 1 })

      if (!productsResponse.data?.items?.length || !customersResponse.data?.items?.length) {
        toast.error('Please add at least one product and customer first')
        return
      }

      const product = productsResponse.data.items[0]
      const customer = customersResponse.data.items[0]

      // Create first invoice
      await salesAPI.createSale({
        customerId: customer.id,
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: product.sellPrice,
          discount: 0
        }],
        paymentMethod: 'Cash',
        paymentStatus: 'Paid'
      })
      
      setCompletedSteps([...completedSteps, 5])
      toast.success('First invoice created!')
      
      // Complete onboarding
      setTimeout(() => {
        navigate('/dashboard')
      }, 1500)
    } catch (error) {
      toast.error('Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1)
    } else {
      navigate('/dashboard')
    }
  }

  const handleNext = () => {
    switch (currentStep) {
      case 1: handleStep1(); break
      case 2: handleStep2(); break
      case 3: handleStep3(); break
      case 4: handleStep4(); break
      case 5: handleStep5(); break
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step) => {
              const Icon = step.icon
              const isCompleted = completedSteps.includes(step.number)
              const isCurrent = currentStep === step.number
              
              return (
                <div key={step.number} className="flex flex-col items-center flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    isCompleted ? 'bg-green-600 text-white' :
                    isCurrent ? 'bg-blue-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    isCurrent ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {steps[currentStep - 1].title}
          </h2>
          <p className="text-gray-600 mb-6">
            {currentStep === 1 && 'Let\'s start by setting up your company information.'}
            {currentStep === 2 && 'Configure VAT settings for your business.'}
            {currentStep === 3 && 'Add your first product to get started.'}
            {currentStep === 4 && 'Add your first customer.'}
            {currentStep === 5 && 'Create your first invoice to complete setup.'}
          </p>

          {/* Step 1: Company Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Input
                label="Company Name *"
                value={companyInfo.companyName}
                onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                required
              />
              <Input
                label="Address"
                value={companyInfo.address}
                onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
              />
              <Input
                label="Phone"
                type="tel"
                value={companyInfo.phone}
                onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={companyInfo.email}
                onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
              />
            </div>
          )}

          {/* Step 2: VAT Setup */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Input
                label="VAT Number (Optional)"
                value={vatInfo.vatNumber}
                onChange={(e) => setVatInfo({ ...vatInfo, vatNumber: e.target.value })}
              />
              <Select
                label="VAT Rate (%)"
                value={vatInfo.vatRate}
                onChange={(e) => setVatInfo({ ...vatInfo, vatRate: e.target.value })}
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
              </Select>
              <Select
                label="Currency"
                value={vatInfo.currency}
                onChange={(e) => setVatInfo({ ...vatInfo, currency: e.target.value })}
              >
                <option value="AED">AED - UAE Dirham</option>
                <option value="SAR">SAR - Saudi Riyal</option>
                <option value="KWD">KWD - Kuwaiti Dinar</option>
                <option value="QAR">QAR - Qatari Riyal</option>
              </Select>
              <Select
                label="Country"
                value={vatInfo.country}
                onChange={(e) => setVatInfo({ ...vatInfo, country: e.target.value })}
              >
                <option value="AE">United Arab Emirates</option>
                <option value="SA">Saudi Arabia</option>
                <option value="KW">Kuwait</option>
                <option value="QA">Qatar</option>
              </Select>
            </div>
          )}

          {/* Step 3: Add Product */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Input
                label="Product Name *"
                value={productInfo.name}
                onChange={(e) => setProductInfo({ ...productInfo, name: e.target.value })}
                required
              />
              <Input
                label="SKU (Optional)"
                value={productInfo.sku}
                onChange={(e) => setProductInfo({ ...productInfo, sku: e.target.value })}
              />
              <Input
                label="Price *"
                type="number"
                step="0.01"
                value={productInfo.price}
                onChange={(e) => setProductInfo({ ...productInfo, price: e.target.value })}
                required
              />
              <Input
                label="Initial Stock"
                type="number"
                value={productInfo.stock}
                onChange={(e) => setProductInfo({ ...productInfo, stock: e.target.value })}
              />
            </div>
          )}

          {/* Step 4: Add Customer */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <Input
                label="Customer Name *"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                required
              />
              <Input
                label="Phone"
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
              />
            </div>
          )}

          {/* Step 5: Create Invoice */}
          {currentStep === 5 && (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 mb-6">
                Ready to create your first invoice! This will complete your onboarding.
              </p>
              <p className="text-sm text-gray-500">
                We'll use your first product and customer to create a sample invoice.
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </button>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSkip}
              className="text-gray-600 hover:text-gray-900 px-4 py-2"
            >
              Skip for now
            </button>
            <LoadingButton
              onClick={handleNext}
              loading={loading}
              className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold"
            >
              <span>{currentStep === 5 ? 'Complete Setup' : 'Next'}</span>
              {currentStep < 5 && <ArrowRight className="h-5 w-5" />}
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
