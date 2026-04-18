"use client"

import * as React from "react"

export function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)

    const onChange = () => setIsMobile(mediaQuery.matches)
    onChange()

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onChange)
      return () => mediaQuery.removeEventListener("change", onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
  }, [breakpointPx])

  return isMobile
}

