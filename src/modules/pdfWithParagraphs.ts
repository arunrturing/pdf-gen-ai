import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Options for customizing the PDF generation
 */
interface PDFOptions {
  /** Font to be used in the document */
  font?: string;
  /** Font size for paragraphs */
  fontSize?: number;
  /** Left margin in points */
  marginLeft?: number;
  /** Right margin in points */
  marginRight?: number;
  /** Top margin in points */
  marginTop?: number;
  /** Bottom margin in points */
  marginBottom?: number;
  /** Line height multiplier */
  lineHeight?: number;
  /** Output file path */
  outputPath?: string;
}

/**
 * Creates a PDF document with paragraphs that are left-aligned
 * @param paragraphs Array of strings, each representing a paragraph
 * @param options Configuration options for the PDF
 * @returns Buffer containing the PDF data
 */
export const createParagraphsPDF = (
  paragraphs: string[],
  options: PDFOptions = {}
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      // Set default options
      const {
        font = 'Helvetica',
        fontSize = 12,
        marginLeft = 72, // 1 inch
        marginRight = 72, // 1 inch
        marginTop = 72, // 1 inch
        marginBottom = 72, // 1 inch
        lineHeight = 1.5,
        outputPath
      } = options;

      // Calculate the content width
      const pageWidth = 612; // Default letter size width in points
      const contentWidth = pageWidth - marginLeft - marginRight;

      // Create a document
      const doc = new PDFDocument({
        margins: {
          top: marginTop,
          bottom: marginBottom,
          left: marginLeft,
          right: marginRight
        }
      });

      // Set up document properties
      doc.font(font)
         .fontSize(fontSize);

      // Buffer to collect PDF data
      const chunks: Buffer[] = [];
      let result: Buffer;

      // Handle document data chunks
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // Handle document end
      doc.on('end', () => {
        result = Buffer.concat(chunks);
        resolve(result);
      });

      // Handle errors during PDF generation
      doc.on('error', (err) => {
        reject(err);
      });

      // Add paragraphs with left alignment
      paragraphs.forEach((paragraph) => {
        if (paragraph && paragraph.trim()) {
          doc.text(paragraph, {
            width: contentWidth,
            align: 'left',
            indent: 0,
            lineGap: (fontSize * lineHeight) - fontSize // Set line spacing
          });
          
          // Add space between paragraphs
          doc.moveDown();
        }
      });

      // If outputPath is provided, save to file
      if (outputPath) {
        const dirPath = path.dirname(outputPath);
        
        // Ensure output directory exists
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Create write stream for output file
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);
        
        writeStream.on('error', (err) => {
          reject(err);
        });
      }

      // Finalize the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};