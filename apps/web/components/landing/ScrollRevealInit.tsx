'use client'

import { useEffect } from 'react'

/**
 * Observe all .reveal elements and toggle .is-visible when they enter the
 * viewport. Works with the CSS classes already defined in globals.css:
 *   .reveal         { opacity:0; transform:translateY(28px); transition: ... }
 *   .reveal.is-visible { opacity:1; transform:translateY(0) }
 *
 * Renders nothing — mount it once at layout level.
 */
export function ScrollRevealInit() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            // Unobserve once revealed to avoid toggling back
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    // Observe all current .reveal elements
    const observe = () =>
      document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

    observe()

    // Also observe after any dynamic content
    const mo = new MutationObserver(observe)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])

  return null
}
