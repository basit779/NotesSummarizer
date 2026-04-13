import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

export async function extractTextFromPdf(filePath: string): Promise<{ text: string; pages: number }> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const cleaned = data.text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { text: cleaned, pages: data.numpages };
}
