import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** MIME types the upload + process pipeline can extract text from. */
export const SUPPORTED_MIMES: ReadonlySet<string> = new Set([PDF_MIME, DOCX_MIME]);

/** Filename → MIME fallback for browsers that send blob.type empty. */
export function inferMimeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return PDF_MIME;
  if (lower.endsWith('.docx')) return DOCX_MIME;
  return '';
}

// Regex builders use explicit escape sequences instead of regex literals so
// the source survives any tool/transport that mishandles literal control
// chars (NUL, raw newlines inside `/.../`).
const NUL_RE = new RegExp('\\x00', 'g');
const SPACE_TAB_RE = new RegExp('[ \\t]+', 'g');
const MULTI_NEWLINE_RE = new RegExp('\\n{3,}', 'g');

function clean(text: string): string {
  return text.replace(NUL_RE, '').replace(SPACE_TAB_RE, ' ').replace(MULTI_NEWLINE_RE, '\n\n').trim();
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const data = await pdfParse(buffer);
  return { text: clean(data.text), pages: data.numpages };
}

/** DOCX has no native page count without rendering; we return 0 and let the
 *  tier selector key off chars alone. */
async function extractTextFromDocxBuffer(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: clean(result.value), pages: 0 };
}

/** Format-routing extractor. Throws on unsupported MIME. */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ text: string; pages: number }> {
  if (mimeType === PDF_MIME) return extractTextFromPdfBuffer(buffer);
  if (mimeType === DOCX_MIME) return extractTextFromDocxBuffer(buffer);
  throw new Error(`Unsupported file type: ${mimeType || 'unknown'}`);
}
