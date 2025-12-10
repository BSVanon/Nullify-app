import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function truncateMiddle(value, max = 16) {
  if (typeof value !== 'string') return ''
  if (value.length <= max) return value
  const half = Math.floor(max / 2) - 1
  const start = value.slice(0, half + 1)
  const end = value.slice(-half)
  return `${start}…${end}`
}

export function base64UrlEncode(data) {
  if (typeof data === 'string') {
    data = new TextEncoder().encode(data)
  }
  const base64 = btoa(String.fromCharCode(...data))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function base64UrlDecode(str) {
  if (!str) throw new Error('base64url string required')
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  return binary
}
