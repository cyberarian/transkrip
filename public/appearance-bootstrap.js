/* global window, document */
(() => {
  try {
    const saved = window.localStorage.getItem('transkrip.appearance')
    document.documentElement.dataset.appearance = ['console', 'modern', 'classic'].includes(saved) ? saved : 'console'
  } catch {
    document.documentElement.dataset.appearance = 'console'
  }
})()
