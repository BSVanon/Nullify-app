/**
 * ThreadLabelEditor Component
 * 
 * Inline editor for custom thread labels.
 */

import React, { useState } from 'react'
import { useThreadLabel } from '../../hooks/identity/useThreadLabel.js'

export function ThreadLabelEditor({ threadId, defaultName, onSave }) {
  const { label, setLabel, loading } = useThreadLabel(threadId)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const displayName = label || defaultName || 'New Thread'

  const handleEdit = () => {
    setEditValue(label || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      await setLabel(editValue.trim() || null)
      setIsEditing(false)
      onSave?.()
    } catch (error) {
      console.error('[ThreadLabelEditor] Save failed:', error)
      alert('Failed to save thread name')
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (loading) {
    return <span className="thread-label-loading">Loading...</span>
  }

  if (isEditing) {
    return (
      <div className="thread-label-editor">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          placeholder={defaultName || 'Thread name'}
          maxLength={50}
          style={{
            fontSize: 'inherit',
            fontWeight: 'inherit',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '2px 6px',
            minWidth: '200px'
          }}
        />
      </div>
    )
  }

  return (
    <div 
      className="thread-label-display"
      onClick={handleEdit}
      style={{ 
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}
      title="Click to rename thread"
    >
      <span>{displayName}</span>
      <svg 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        opacity="0.5"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </div>
  )
}
