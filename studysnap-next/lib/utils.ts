import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared "glossy black" surface treatment — subtle gradient + inset top
 *  highlight so solid-black fills (badges, icon wells, avatars) read as
 *  intentional depth rather than a flat CSS color swatch. */
export const GLOSS_BLACK =
  'bg-gradient-to-b from-neutral-800 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.25)]';
