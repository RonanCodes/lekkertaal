import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Lekkertaal Button — shadcn primitive bridged onto the chunky 3D system.
 *
 * The brand's signature is the offset-shadow "3D" button (see `.btn3d` in
 * src/styles.css, which mirrors the legacy `.btn-3d-*` recipe exactly). Rather
 * than carry a wall of Tailwind utilities, the cva picks the `.btn3d` base for
 * the brand variants and lets plain CSS read `data-variant` / `data-size` /
 * `data-full`. A `<Button variant="green" size="lg">` is pixel-identical to
 * `.btn-3d-green.btn-3d-lg`.
 *
 * Variant aliases keep the API ergonomic for the migration call-sites:
 *   - `default` / `orange`  → orange (the brand primary)
 *   - `secondary` / `blue`  → canal blue
 *   - `destructive` / `red` → bad-red
 *   - `green`               → good-green
 *   - `ghost`               → bordered white/paper
 */
const buttonVariants = cva('btn3d', {
  variants: {
    variant: {
      default: '',
      orange: '',
      primary: '',
      blue: '',
      secondary: '',
      green: '',
      red: '',
      destructive: '',
      ghost: '',
    },
    size: {
      default: '',
      lg: '',
      sm: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

/** Collapse the alias variants down to the four colour buckets the CSS knows. */
function dataVariant(
  variant: NonNullable<VariantProps<typeof buttonVariants>['variant']>,
): 'orange' | 'blue' | 'green' | 'red' | 'ghost' {
  switch (variant) {
    case 'blue':
    case 'secondary':
      return 'blue'
    case 'green':
      return 'green'
    case 'red':
    case 'destructive':
      return 'red'
    case 'ghost':
      return 'ghost'
    case 'default':
    case 'orange':
    case 'primary':
    default:
      return 'orange'
  }
}

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Stretch to the container width (mirrors `.btn-3d-full`). */
  fullWidth?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      fullWidth = false,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    const v = variant ?? 'default'
    const s = size ?? 'default'
    return (
      <Comp
        ref={ref}
        data-variant={dataVariant(v)}
        data-size={s === 'default' ? undefined : s}
        data-full={fullWidth ? 'true' : undefined}
        className={cn(buttonVariants({ variant: v, size: s }), className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
