import { describe, it, expect } from 'vitest'
import {
  translateError,
  formatErrorForNotification,
  isRecoverableError,
} from '@/lib/errors/userFriendlyErrors.js'

describe('userFriendlyErrors', () => {
  describe('translateError', () => {
    it('translates wallet UTXO errors', () => {
      const error = new Error('The txid abc123 parameter must be valid transaction on chain main')
      const result = translateError(error)
      
      expect(result.message).toContain('outdated transaction data')
      expect(result.action).toContain('refresh')
      expect(result.recoverable).toBe(true)
      expect(result.category).toBe('wallet')
    })

    it('translates insufficient funds errors', () => {
      const error = new Error('insufficient funds for transaction')
      const result = translateError(error)
      
      expect(result.message).toContain('Not enough funds')
      expect(result.recoverable).toBe(true)
    })

    it('translates wallet connection errors', () => {
      const error = new Error('No wallet available over any communication substrate')
      const result = translateError(error)
      
      expect(result.message).toContain('No BSV wallet detected')
      expect(result.action).toContain('Install')
    })

    it('translates network errors', () => {
      const error = new Error('overlay connection failed')
      const result = translateError(error)
      
      expect(result.message).toContain('messaging server')
      expect(result.category).toBe('network')
    })

    it('translates CT burned errors', () => {
      const error = new Error('CT burned - access revoked')
      const result = translateError(error)
      
      expect(result.message).toContain('permanently deleted')
      expect(result.recoverable).toBe(false)
    })

    it('returns generic message for unknown errors', () => {
      const error = new Error('some random error xyz')
      const result = translateError(error, { context: 'send message' })
      
      expect(result.message).toContain('send message')
      expect(result.recoverable).toBe(true)
      expect(result.category).toBe('unknown')
    })

    it('handles JSON-stringified wallet errors', () => {
      const jsonError = JSON.stringify({
        call: 'createAction',
        message: 'The txid abc must be valid transaction on chain main'
      })
      const result = translateError(jsonError)
      
      expect(result.message).toContain('outdated transaction data')
    })

    it('handles Error objects with JSON message', () => {
      const error = new Error(JSON.stringify({
        call: 'createAction',
        message: 'insufficient funds'
      }))
      const result = translateError(error)
      
      expect(result.message).toContain('Not enough funds')
    })
  })

  describe('formatErrorForNotification', () => {
    it('combines message and action for recoverable errors', () => {
      const error = new Error('wallet connection refused')
      const result = formatErrorForNotification(error)
      
      expect(result).toContain('Cannot connect')
      expect(result).toContain('running')
    })

    it('returns just message for non-recoverable errors', () => {
      const error = new Error('CT burned')
      const result = formatErrorForNotification(error)
      
      expect(result).toContain('permanently deleted')
    })

    it('uses context in fallback message', () => {
      const error = new Error('unknown error xyz')
      const result = formatErrorForNotification(error, { context: 'send payment' })
      
      expect(result).toContain('send payment')
    })
  })

  describe('isRecoverableError', () => {
    it('returns true for wallet errors', () => {
      expect(isRecoverableError(new Error('wallet timeout'))).toBe(true)
    })

    it('returns false for burned CT errors', () => {
      expect(isRecoverableError(new Error('CT burned'))).toBe(false)
    })

    it('returns true for unknown errors', () => {
      expect(isRecoverableError(new Error('random error'))).toBe(true)
    })
  })
})
