import { Toaster as Sonner } from 'sonner'
import type { ToasterProps } from 'sonner'

/**
 * Toast surface (sonner). Reads the bridged shadcn tokens so toasts inherit the
 * Lekkertaal paper/ink palette in both light and dark. Mount once near the app
 * root, then call `toast()` from anywhere.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
export { toast } from 'sonner'
