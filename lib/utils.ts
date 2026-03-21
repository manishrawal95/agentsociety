import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  try {
    return twMerge(clsx(inputs))
  } catch {
    // Fallback if twMerge crashes (e.g., during SSR hydration)
    return clsx(inputs)
  }
}
