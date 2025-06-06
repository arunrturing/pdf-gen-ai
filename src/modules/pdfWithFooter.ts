import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosResponse } from 'axios';

// Define interfaces for type safety
export interface PDFOptions {
  outputPath: string;
  margin?: number;
  logoWidth?: number;
  fontSize?: {
    header?: number;
    text?: number;
    footer?: number;
    signature?: number;
    designation?: number;
  };
}

export interface SignatureInfo {
  name: string;
  designation: string;
}

/**
 * Creates a PDF document with header, content paragraph, and footer with date and page number
 */
export async function createPDF(
  logoUrl: string | null,
  companyName: string,
  paragraphText: string,
  signatureInfo: SignatureInfo,
  options: PDFOptions
): Promise<string> {
  // Default values
  const margin = options.margin ?? 50;
  const logoWidth = options.logoWidth ?? 50;
  
  const fontSize = {
    header: options.fontSize?.header ?? 16,
    text: options.fontSize?.text ?? 12,
    footer: options.fontSize?.footer ?? 10,
    signature: options.fontSize?.signature ?? 12,
    designation: options.fontSize?.designation ?? 10
  };

  // Create directory if it doesn't exist
  await ensureDirectoryExists(options.outputPath);

  return new Promise<string>((resolve, reject) => {
    try {
      // Create a write stream
      const stream = fs.createWriteStream(options.outputPath);

      // Create a document with the footer space reserved
      const doc = new PDFDocument({
        autoFirstPage: true,
        size: 'A4',
        margin,
        bufferPages: true // Important for page numbering
      });

      // Pipe the PDF to the write stream
      doc.pipe(stream);

      // Handle stream errors
      stream.on('error', (err: Error) => {
        reject(new Error(`Error writing to PDF stream: ${err.message}`));
      });

      // When the document is completed
      stream.on('finish', () => {
        resolve(options.outputPath);
      });

      // Store current Y position for footer placement
      const pageBottom = doc.page.height - margin;
      
      // Add event listener for new pages to ensure footer appears on every page
      doc.on('pageAdded', () => {
        // Each time a new page is added, we reserve space at the bottom for the footer
        const footerTop = doc.page.height - margin - 20;
        doc.page.margins.bottom = margin + 20; // Reserve space for footer
      });

      // Start document generation
      const generateDocument = async (): Promise<void> => {
        try {
          // Add header with logo and company name
          await addHeaderWithLogo(doc, logoUrl, companyName, margin, logoWidth, fontSize.header);
          
          // Add content
          doc.font('Helvetica').fontSize(fontSize.text);
          doc.text(paragraphText, {
            width: doc.page.width - 2 * margin,
            align: 'left'
          });
          
          // Add space before signature
          doc.moveDown(2);
          
          // Add signature and designation
          addSignature(doc, signatureInfo, margin, fontSize.signature, fontSize.designation);
          
          // Get the total number of pages
          const range = doc.bufferedPageRange();
          const totalPages = range.count;
          
          // Apply footer to each page (date and page number on same footer)
          for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            addFooterToPage(doc, i + 1, totalPages, margin, fontSize.footer);
          }
          
          // Finalize the PDF
          doc.end();
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Unknown error';
          reject(new Error(`Error generating PDF: ${errorMessage}`));
        }
      };

      generateDocument().catch((error: unknown) => {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unknown error';
        reject(new Error(errorMessage));
      });
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error';
      reject(new Error(errorMessage));
    }
  });
}

/**
 * Add header with logo and company name
 */
async function addHeaderWithLogo(
  doc: PDFKit.PDFDocument,
  logoUrl: string | null,
  companyName: string,
  margin: number,
  logoWidth: number,
  fontSize: number
): Promise<void> {
  const startY = doc.y;

  // Add logo if URL is provided
  if (logoUrl) {
    try {
      const logoBuffer = await fetchLogo(logoUrl);
      doc.image(logoBuffer, margin, startY, { width: logoWidth });
    } catch (error) {
      console.warn(`Could not add logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Add company name right-aligned
  doc.font('Helvetica-Bold')
     .fontSize(fontSize)
     .text(companyName, 
           margin, 
           startY, 
           { 
             align: 'right',
             width: doc.page.width - 2 * margin
           });

  // Add space after header
  doc.moveDown(2);
}

/**
 * Add signature and designation
 */
function addSignature(
  doc: PDFKit.PDFDocument,
  signatureInfo: SignatureInfo,
  margin: number,
  signatureFontSize: number,
  designationFontSize: number
): void {
  doc.font('Helvetica-Bold')
     .fontSize(signatureFontSize)
     .text(signatureInfo.name, 
           doc.page.width - margin - 150, 
           doc.y, 
           { align: 'left', width: 150 });
           
  doc.font('Helvetica')
     .fontSize(designationFontSize)
     .text(signatureInfo.designation, 
           doc.page.width - margin - 150,
           doc.y + 5, 
           { align: 'left', width: 150 });
}

/**
 * Add footer with date and page number to a single page
 * Places BOTH date and page number on the same footer
 */
function addFooterToPage(
  doc: PDFKit.PDFDocument,
  pageNumber: number,
  totalPages: number,
  margin: number,
  fontSize: number
): void {
  // Calculate footer position at bottom of page
  const footerY = doc.page.height - margin - 15;
  
  // Format date with proper format
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  // Save current drawing state
  doc.save();
  
  // Add date on left side of footer
  doc.font('Helvetica')
     .fontSize(fontSize)
     .text(currentDate, 
           margin, 
           footerY, 
           { align: 'left' });

  // Add page number on right side (same footer, same page)
  doc.text(`Page ${pageNumber} of ${totalPages}`,
           doc.page.width - margin - 100,
           footerY,
           { align: 'right', width: 100 });
  
  // Restore drawing state
  doc.restore();
}

/**
 * Fetch logo from URL
 */
async function fetchLogo(url: string): Promise<Buffer> {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response: AxiosResponse<ArrayBuffer> = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 10000
      });
      return Buffer.from(response.data);
    } else {
      // Local file
      return fs.promises.readFile(url);
    }
  } catch (error) {
    throw new Error(`Failed to fetch logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Ensure output directory exists
 */
async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dirPath = path.dirname(filePath);
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error;
    }
  }
}