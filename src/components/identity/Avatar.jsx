/**
 * Avatar Component
 * 
 * Displays user avatar (monogram with deterministic color or cached image).
 * Never fetches from remote URLs.
 */

import React, { useState, useEffect } from 'react'
import { getAvatar } from '@/lib/identity/profileStore.js'

/**
 * Generate a color from a seed (0-999)
 * @param {number} seed
 * @returns {string} HSL color
 */
function colorFromSeed(seed) {
  const hue = (seed * 137.508) % 360 // Golden angle for good distribution
  return `hsl(${hue}, 65%, 55%)`
}

/**
 * Get initials from a name
 * @param {string} name
 * @returns {string} Up to 2 characters
 */
function getInitials(name) {
  if (!name) return '?'
  
  const parts = name.split(/[\s-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/**
 * Avatar component
 */
export function Avatar({ 
  name, 
  colorSeed = 0, 
  avatarHash = null,
  pubkey = null,
  size = 40,
  className = ''
}) {
  const [imageUrl, setImageUrl] = useState(null)
  const bgColor = colorFromSeed(colorSeed)
  const initials = getInitials(name)

  // Load avatar image if we have a hash and pubkey
  useEffect(() => {
    if (!avatarHash || !pubkey) {
      setImageUrl(null)
      return
    }

    let cancelled = false
    getAvatar(pubkey).then(avatar => {
      if (!cancelled && avatar?.dataUrl && avatar.hash === avatarHash) {
        setImageUrl(avatar.dataUrl)
      }
    }).catch(() => {
      // Ignore errors, fall back to monogram
    })

    return () => { cancelled = true }
  }, [avatarHash, pubkey])

  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    flexShrink: 0,
  }

  // Show image if available
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`avatar ${className}`}
        style={{ ...baseStyle, objectFit: 'cover' }}
        title={name}
      />
    )
  }

  // Fallback to monogram
  const monogramStyle = {
    ...baseStyle,
    backgroundColor: bgColor,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${size * 0.4}px`,
    fontWeight: '600',
    userSelect: 'none'
  }

  return (
    <div 
      className={`avatar ${className}`}
      style={monogramStyle}
      title={name}
      aria-label={`Avatar for ${name}`}
    >
      {initials}
    </div>
  )
}
