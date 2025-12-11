/**
 * Encryption utilities for Nullify
 * Handles AES-256-GCM encryption/decryption of files
 */

export class NullifyEncryption {
  constructor() {
    this.algorithm = 'AES-GCM'
    this.keyLength = 256
  }

  /**
   * Generate a random encryption key
   */
  async generateKey() {
    try {
      const key = await crypto.subtle.generateKey(
        {
          name: this.algorithm,
          length: this.keyLength
        },
        true, // extractable
        ['encrypt', 'decrypt']
      )
      return key
    } catch (error) {
      throw new Error(`Key generation failed: ${error.message}`)
    }
  }

  /**
   * Export key to raw bytes (for storage in CT)
   */
  async exportKey(key) {
    try {
      const exported = await crypto.subtle.exportKey('raw', key)
      return new Uint8Array(exported)
    } catch (error) {
      throw new Error(`Key export failed: ${error.message}`)
    }
  }

  /**
   * Import key from raw bytes
   */
  async importKey(keyData) {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: this.algorithm,
          length: this.keyLength
        },
        false, // not extractable
        ['encrypt', 'decrypt']
      )
      return key
    } catch (error) {
      throw new Error(`Key import failed: ${error.message}`)
    }
  }

  /**
   * Encrypt a file
   */
  async encryptFile(file, key) {
    try {
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12))

      // Read file as ArrayBuffer
      const fileData = await file.arrayBuffer()

      // Encrypt the file data
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        fileData
      )

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength)
      result.set(iv, 0)
      result.set(new Uint8Array(encrypted), iv.length)

      return result
    } catch (error) {
      throw new Error(`File encryption failed: ${error.message}`)
    }
  }

  /**
   * Decrypt a file
   */
  async decryptFile(encryptedData, key) {
    try {
      // Extract IV from the first 12 bytes
      const iv = encryptedData.slice(0, 12)
      const encrypted = encryptedData.slice(12)

      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encrypted
      )

      return new Uint8Array(decrypted)
    } catch (error) {
      throw new Error(`File decryption failed: ${error.message}`)
    }
  }

  /**
   * Calculate SHA-256 hash of data
   */
  async calculateHash(data) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = new Uint8Array(hashBuffer)

      // Convert to hex string
      return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    } catch (error) {
      throw new Error(`Hash calculation failed: ${error.message}`)
    }
  }

  /**
   * Encrypt and prepare file for Nullify
   */
  async prepareFile(file) {
    try {
      // Generate encryption key
      const key = await this.generateKey()

      // Encrypt file
      const encryptedData = await this.encryptFile(file, key)

      // Calculate hash of original file
      const originalData = await file.arrayBuffer()
      const fileHash = await this.calculateHash(originalData)

      // Export key for storage in CT
      const exportedKey = await this.exportKey(key)

      return {
        encryptedData,
        fileHash,
        encryptionKey: exportedKey,
        originalSize: file.size,
        encryptedSize: encryptedData.length
      }
    } catch (error) {
      throw new Error(`File preparation failed: ${error.message}`)
    }
  }

  /**
   * Decrypt file using Nullify data
   */
  async decryptNullifyFile(encryptedData, encryptionKey) {
    try {
      // Import the encryption key
      const key = await this.importKey(encryptionKey)

      // Decrypt the file
      const decryptedData = await this.decryptFile(encryptedData, key)

      return decryptedData
    } catch (error) {
      throw new Error(`Nullify file decryption failed: ${error.message}`)
    }
  }
}

/**
 * Storage utilities for encrypted files
 */
export class NullifyStorage {
  constructor(storageProvider = 'ipfs') {
    this.storageProvider = storageProvider
  }

  /**
   * Upload encrypted file to storage
   */
  async uploadFile(fileData, filename) {
    try {
      switch (this.storageProvider) {
        case 'ipfs':
          return await this.uploadToIPFS(fileData, filename)
        case 'arweave':
          return await this.uploadToArweave(fileData, filename)
        case 'gdrive':
          return await this.uploadToGDrive(fileData, filename)
        default:
          throw new Error(`Unsupported storage provider: ${this.storageProvider}`)
      }
    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`)
    }
  }

  /**
   * Download file from storage
   */
  async downloadFile(url) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      return new Uint8Array(arrayBuffer)
    } catch (error) {
      throw new Error(`File download failed: ${error.message}`)
    }
  }

  // Placeholder implementations - would be replaced with actual API calls
  async uploadToIPFS(fileData, filename) {
    // Simulate IPFS upload
    console.log('Uploading to IPFS:', filename, fileData.length, 'bytes')
    return {
      url: `ipfs://Qm${Math.random().toString(36).substring(2)}`,
      hash: await this.calculateHash(fileData),
      provider: 'ipfs'
    }
  }

  async uploadToArweave(fileData, filename) {
    // Simulate Arweave upload
    console.log('Uploading to Arweave:', filename, fileData.length, 'bytes')
    return {
      url: `ar://${Math.random().toString(36).substring(2)}`,
      hash: await this.calculateHash(fileData),
      provider: 'arweave'
    }
  }

  async uploadToGDrive(fileData, filename) {
    // Simulate Google Drive upload
    console.log('Uploading to Google Drive:', filename, fileData.length, 'bytes')
    return {
      url: `https://drive.google.com/file/d/${Math.random().toString(36).substring(2)}`,
      hash: await this.calculateHash(fileData),
      provider: 'gdrive'
    }
  }

  async calculateHash(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = new Uint8Array(hashBuffer)
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

export default {
  NullifyEncryption,
  NullifyStorage
}
