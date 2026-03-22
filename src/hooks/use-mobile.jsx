import * as React from "react"

const MOOBILE_BREAKPOOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOOBILE_BREAKPOOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOOBILE_BREAKPOOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOOBILE_BREAKPOOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return !!isMobile
}
