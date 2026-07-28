const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY

/**
 * Initialize Paystack inline payment
 * @param {Object} options
 * @param {string} options.email - Customer email
 * @param {number} options.amount - Amount in KOBO (multiply NGN by 100)
 * @param {string} options.reference - Unique transaction reference
 * @param {string} options.currency - Currency code (default NGN)
 * @param {Function} options.onSuccess - Called with transaction on success
 * @param {Function} options.onClose - Called when popup is closed
 */
export const initializePaystack = ({
  email,
  amount,
  reference,
  currency = 'NGN',
  metadata = {},
  onSuccess,
  onClose,
}) => {
  if (!window.PaystackPop) {
    console.error('Paystack script not loaded')
    return
  }

  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder',
    email,
    amount: Math.round(amount * 100), // Convert to kobo
    currency,
    ref: reference || `TW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      custom_fields: [
        {
          display_name: 'Platform',
          variable_name: 'platform',
          value: 'TicketWave',
        },
        ...Object.entries(metadata).map(([key, value]) => ({
          display_name: key,
          variable_name: key.toLowerCase().replace(/\s/g, '_'),
          value: String(value),
        })),
      ],
    },
    onClose: () => {
      if (onClose) onClose()
    },
    callback: (response) => {
      if (onSuccess) onSuccess(response)
    },
  })

  handler.openIframe()
}

export const generateReference = (prefix = 'TW') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
}
