export function initUiHelpers() {
  function showToast(message = 'Done', durationMs = 1200) {
    try {
      let toast = document.getElementById('nn-toast')
      if (!toast) {
        toast = document.createElement('div')
        toast.id = 'nn-toast'
        toast.style.position = 'fixed'
        toast.style.right = '16px'
        toast.style.bottom = '16px'
        toast.style.background = 'rgba(0,0,0,0.85)'
        toast.style.color = '#fff'
        toast.style.padding = '10px 14px'
        toast.style.borderRadius = '6px'
        toast.style.fontFamily = 'Inter, system-ui, sans-serif'
        toast.style.fontSize = '13px'
        toast.style.zIndex = '9999'
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
        document.body.appendChild(toast)
      }
      toast.textContent = message
      toast.style.opacity = '1'
      clearTimeout(window.__nnToastTimer)
      window.__nnToastTimer = setTimeout(() => {
        toast.style.opacity = '0'
      }, durationMs)
    } catch (err) {
      console.warn('Toast display failed', err)
    }
  }

  window.copyEl = async (id) => {
    try {
      const el = document.getElementById(id)
      const value = (el?.value ?? el?.textContent ?? '').toString()
      if (!value) {
        showToast('Nothing to copy')
        return
      }
      await navigator.clipboard.writeText(value)
      showToast('Copied')
    } catch (err) {
      showToast('Copy failed')
    }
  }

  return { showToast }
}
