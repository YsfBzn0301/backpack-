import { useCallback } from 'react'

/**
 * Ref callback for horizontally scrollable rows. Toggles `data-at-start` /
 * `data-at-end` so the `.scroll-fade` CSS utility only shows an edge fade
 * where more content is hidden (and none when the row doesn't overflow).
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>() {
  return useCallback((el: T | null) => {
    if (!el) return
    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      const x = Math.abs(el.scrollLeft)
      el.toggleAttribute('data-at-start', x <= 1 || max <= 1)
      el.toggleAttribute('data-at-end', max <= 1 || x >= max - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const c of Array.from(el.children)) ro.observe(c)
    const mo = new MutationObserver(() => {
      ro.disconnect()
      ro.observe(el)
      for (const c of Array.from(el.children)) ro.observe(c)
      update()
    })
    mo.observe(el, { childList: true })
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
      mo.disconnect()
    }
  }, [])
}
