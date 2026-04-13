import pdfParse from 'pdf-parse';

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const data = await pdfParse(buffer);
  const cleaned = data.text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { text: cleaned, pages: data.numpages };
}
