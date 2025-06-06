import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosResponse } from 'axios';

// Define precise interfaces for type safety
export interface PDFOptions {
  outputPath: string;
  margin?: number;
  headerHeight?: number;
  footerHeight?: number;
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
 * Creates a PDF document with header, content paragraph, footer, and signature
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
  const headerHeight = options.headerHeight ?? 80;
  const footerHeight = options.footerHeight ?? 50;
  const logoWidth = options.logoWidth ?? 70; // Reduced from 100 to 70
  
  const fontSize = {
    header: options.fontSize?.header ?? 14, // Reduced from 16 to 14
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

      // Create a new PDF document with proper typing
      const doc = new PDFDocument({
        autoFirstPage: true,
        margins: {
          top: margin + headerHeight,
          bottom: margin + footerHeight,
          left: margin,
          right: margin
        },
        bufferPages: true,
        size: 'A4'
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

      // Main execution function
      const generateDocument = async (): Promise<void> => {
        try {
          // Add header with logo (if provided) and company name
          await addHeader(doc, logoUrl, companyName, margin, logoWidth, fontSize.header);
          
          // Add content paragraph with increased spacing from header
          addContent(doc, paragraphText, margin, headerHeight + 30, fontSize.text);
          
          // Add signature and designation
          addSignature(doc, signatureInfo, margin, fontSize.signature, fontSize.designation);
          
          // Add footer with page numbers to each page
          addFootersToAllPages(doc, margin, fontSize.footer);
          
          // Finalize the PDF
          doc.end();
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Unknown error in PDF generation';
          reject(new Error(`Error generating PDF document: ${errorMessage}`));
        }
      };

      // Start document generation
      generateDocument().catch((error: unknown) => {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unknown error in PDF generation';
        reject(new Error(errorMessage));
      });
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error setting up PDF generation';
      reject(new Error(errorMessage));
    }
  });
}

/**
 * Adds header with logo and company name
 */
async function addHeader(
  doc: PDFKit.PDFDocument,
  logoUrl: string | null,
  companyName: string,
  margin: number,
  logoWidth: number,
  fontSize: number
): Promise<void> {
  // Add logo if URL is provided
  let logoHeight = 0;
  
  if (logoUrl) {
    try {
      const logoBuffer = await fetchLogo(logoUrl);
      
      // Draw the logo at the top left with reduced size
      doc.image(logoBuffer, margin, margin, { 
        width: logoWidth
      });
      
      // Estimate logo height based on the width (assuming 1:1 aspect ratio as a fallback)
      logoHeight = logoWidth;
    } catch (error) {
      // Continue without logo instead of failing
      console.warn(`Could not add logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Add company name next to logo or at margin if no logo
  const companyNameX = logoUrl ? margin + logoWidth + 10 : margin;
  
  // Align vertically with the logo
  const companyNameY = margin + (logoHeight ? (logoHeight / 2 - fontSize / 2) : 0);
  
  doc.font('Helvetica-Bold')
     .fontSize(fontSize)
     .text(companyName, 
           companyNameX, 
           companyNameY, 
           { align: 'left' });

  // Reset font for content
  doc.font('Helvetica')
     .fontSize(12);
}

/**
 * Adds the main paragraph content
 */
function addContent(
  doc: PDFKit.PDFDocument,
  paragraphText: string,
  margin: number,
  headerHeight: number,
  fontSize: number
): void {
  const contentY = margin + headerHeight;
  
  doc.font('Helvetica')
     .fontSize(fontSize)
     .text(paragraphText, 
           margin, 
           contentY, 
           { 
             align: 'left',
             width: doc.page.width - (2 * margin)
           });
}

/**
 * Adds signature and designation
 */
function addSignature(
  doc: PDFKit.PDFDocument,
  signatureInfo: SignatureInfo,
  margin: number,
  signatureFontSize: number,
  designationFontSize: number
): void {
  const signatureY = doc.y + 50; // Add some space after the content
  
  doc.font('Helvetica-Bold')
     .fontSize(signatureFontSize)
     .text(signatureInfo.name, 
           doc.page.width - margin - 150, 
           signatureY, 
           { align: 'left', width: 150 });
           
  doc.font('Helvetica')
     .fontSize(designationFontSize)
     .text(signatureInfo.designation, 
           doc.page.width - margin - 150,
           doc.y + 5, 
           { align: 'left', width: 150 });
}

/**
 * Adds footer with page numbers to all pages
 */
function addFootersToAllPages(
  doc: PDFKit.PDFDocument,
  margin: number,
  fontSize: number
): void {
  // Get total pages
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  
  // Add footer to each page with page numbers
  let pageNumber = 0;
  
  for (let i = range.start; i < range.start + range.count; i++) {
    pageNumber++;
    doc.switchToPage(i);

    const footerY = doc.page.height - margin - 20;
    
    // Add current date on the left
    const currentDate = new Date().toLocaleDateString();
    doc.font('Helvetica')
       .fontSize(fontSize)
       .text(currentDate, 
             margin, 
             footerY, 
             { align: 'left' });
             
    // Add page number on the right
    doc.text(
      `Page ${pageNumber} of ${totalPages}`,
      doc.page.width - margin - 100,
      footerY,
      { align: 'right', width: 100 }
    );
  }
}

/**
 * Fetches a logo from URL and returns it as a buffer
 */
async function fetchLogo(url: string): Promise<Buffer> {
  try {
    // Handle different types of URLs (http, https, file)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response: AxiosResponse<ArrayBuffer> = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 10000 // 10 seconds timeout to prevent hanging
      });
      return Buffer.from(response.data);
    } else {
      // Assume it's a local file
      return fs.promises.readFile(url);
    }
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error fetching logo';
    throw new Error(`Failed to fetch logo: ${errorMessage}`);
  }
}

/**
 * Ensures the directory exists for the output file
 */
async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dirPath = path.dirname(filePath);
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Only throw if it's not an "already exists" error
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error;
    }
  }
}