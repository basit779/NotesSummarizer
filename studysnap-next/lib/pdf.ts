import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** MIME types the upload + process pipeline can extract text from. */
export const SUPPORTED_MIMES: ReadonlySet<string> = new Set([PDF_MIME, DOCX_MIME, PPTX_MIME, XLSX_MIME]);

/** Filename → MIME fallback for browsers that send blob.type empty. */
export function inferMimeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return PDF_MIME;
  if (lower.endsWith('.docx')) return DOCX_MIME;
  if (lower.endsWith('.pptx')) return PPTX_MIME;
  if (lower.endsWith('.xlsx')) return XLSX_MIME;
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

// XML entity decoder for the small set that appears in PPTX text runs.
const ENTITY_MAP: Record<string, string> = { 'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'" };
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ENTITY_MAP[name] ?? `&${name};`);
}

/** PPTX is a zip with `ppt/slides/slideN.xml`. Each slide XML carries text in
 *  `<a:t>` runs. We pull those out per slide and join with blank lines so the
 *  AI pipeline gets one logical block per slide. Slide count → `pages` so the
 *  tier selector treats slide-heavy decks the same as PDF page counts. */
async function extractTextFromPptxBuffer(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const ai = parseInt(a.match(/slide(\d+)\.xml$/)![1], 10);
      const bi = parseInt(b.match(/slide(\d+)\.xml$/)![1], 10);
      return ai - bi;
    });

  const runRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  const slides: string[] = [];
  for (const name of slideEntries) {
    const xml = await zip.files[name].async('string');
    const runs: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(xml)) !== null) {
      const decoded = decodeXmlEntities(m[1]).trim();
      if (decoded) runs.push(decoded);
    }
    if (runs.length > 0) slides.push(runs.join(' '));
  }

  return { text: clean(slides.join('\n\n')), pages: slideEntries.length };
}

/** XLSX → CSV-per-sheet, joined with sheet-name headers so the AI pipeline
 *  knows where one sheet ends and the next begins. `pages` is 0 (sheets
 *  aren't pages) and the tier selector keys off chars alone. */
async function extractTextFromXlsxBuffer(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (csv) parts.push(`# Sheet: ${sheetName}\n\n${csv}`);
  }
  return { text: clean(parts.join('\n\n---\n\n')), pages: 0 };
}

/** Format-routing extractor. Throws on unsupported MIME. */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ text: string; pages: number }> {
  if (mimeType === PDF_MIME) return extractTextFromPdfBuffer(buffer);
  if (mimeType === DOCX_MIME) return extractTextFromDocxBuffer(buffer);
  if (mimeType === PPTX_MIME) return extractTextFromPptxBuffer(buffer);
  if (mimeType === XLSX_MIME) return extractTextFromXlsxBuffer(buffer);
  throw new Error(`Unsupported file type: ${mimeType || 'unknown'}`);
}
