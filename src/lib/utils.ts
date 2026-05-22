import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class lists with conflict resolution.
 * The shadcn `cn()` helper: clsx for conditional joins, tailwind-merge to
 * dedupe conflicting utilities (last one wins).
 */
export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}
