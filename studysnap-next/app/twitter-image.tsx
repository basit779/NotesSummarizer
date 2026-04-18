// Twitter uses the same 1200x630 design as OpenGraph. Re-exports keep a single
// source of truth so the two previews never drift.
export { default, runtime, alt, size, contentType } from './opengraph-image';
