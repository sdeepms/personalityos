import type { Env } from '../index'

export interface RazorpaySubscription {
  id: string
  plan_id: string
  status: string
  short_url: string
  current_start: number | null
  current_end: number | null
}

export async function createRazorpaySubscription(
  env: Env,
  planId: string,
  notes: Record<string, string> = {}
): Promise<RazorpaySubscription> {
  const keyId = env.RAZORPAY_KEY_ID
  const keySecret = env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    console.warn('[razorpay] Key ID or Secret missing, returning mock subscription')
    return {
      id: `sub_mock_${crypto.randomUUID().slice(0, 8)}`,
      plan_id: planId,
      status: 'created',
      short_url: 'https://razorpay.com/mock-checkout',
      current_start: Math.floor(Date.now() / 1000),
      current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    }
  }

  const auth = btoa(`${keyId}:${keySecret}`)
  const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: 12, // 1 year (12 billing cycles)
      quantity: 1,
      customer_notify: 1,
      notes,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Razorpay Subscription Creation Failed: ${response.status} - ${errorText}`)
  }

  return (await response.json()) as RazorpaySubscription
}

export async function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!secret) return false

  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  
  // Import webhook secret as HMAC key
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  )

  // Compute HMAC of raw body
  const computedSignatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(rawBody)
  )

  // Convert computed signature to Hex string
  const computedSignatureArray = Array.from(new Uint8Array(computedSignatureBuffer))
  const computedSignatureHex = computedSignatureArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Safe time-constant comparison
  if (signature.length !== computedSignatureHex.length) return false
  
  let result = 0
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ computedSignatureHex.charCodeAt(i)
  }
  
  return result === 0
}
