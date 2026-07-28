export const APP_NAME = 'TicketWave'

export const EVENT_CATEGORIES = [
  'Technology',
  'Music',
  'Arts & Culture',
  'Sports',
  'Food & Drinks',
  'Business',
  'Education',
  'Fashion',
  'Comedy',
  'Health & Wellness',
  'Religion',
  'Networking',
  'General',
]

export const EVENT_TYPES = [
  { value: 'physical', label: 'Physical Event' },
  { value: 'online', label: 'Online Event' },
  { value: 'hybrid', label: 'Hybrid (Physical + Online)' },
]

export const TICKET_STATUS = {
  ACTIVE: 'active',
  USED: 'used',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
}

export const EVENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
}

export const CURRENCIES = {
  NGN: { symbol: '₦', name: 'Nigerian Naira' },
  USD: { symbol: '$', name: 'US Dollar' },
  GBP: { symbol: '£', name: 'British Pound' },
}

export const formatCurrency = (amount, currency = 'NGN') => {
  const curr = CURRENCIES[currency] || CURRENCIES.NGN
  if (!amount || amount === 0) return 'Free'
  return `${curr.symbol}${Number(amount).toLocaleString('en-NG')}`
}

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const formatTime = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatDateTime = (dateStr) => {
  return `${formatDate(dateStr)} · ${formatTime(dateStr)}`
}

export const getEventTypeLabel = (type) => {
  return EVENT_TYPES.find(t => t.value === type)?.label || type
}

export const getStatusColor = (status) => {
  const map = {
    active: 'emerald',
    published: 'emerald',
    used: 'sky',
    completed: 'sky',
    cancelled: 'rose',
    refunded: 'rose',
    draft: 'gray',
    pending: 'gold',
  }
  return map[status] || 'gray'
}
