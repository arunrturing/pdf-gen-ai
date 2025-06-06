import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosResponse } from 'axios';

// Define interfaces for type safety
export interface PDFOptions {
  outputPath: string;
  margin?: number;
  logoWidth?: number;
  headerSpacing?: number;
  paragraphSpacing?: number;
  signatureSpacing?: number;
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
 * Creates an elegant, professionally formatted PDF document
 */
export async function createPDF(
  logoUrl: string | null,
  companyName: string,
  paragraphText: string,
  signatureInfo: SignatureInfo,
  options: PDFOptions
): Promise<string> {
  // Default values optimized for professional appearance
  const margin = options.margin ?? 60; // Slightly larger margin for more elegant whitespace
  const logoWidth = options.logoWidth ?? 40; // Smaller logo for better proportion
  const headerSpacing = options.headerSpacing ?? 35; // Space after header
  const paragraphSpacing = options.paragraphSpacing ?? 30; // Space after paragraph
  const signatureSpacing = options.signatureSpacing ?? 50; // Space before signature
  
  const fontSize = {
    header: options.fontSize?.header ?? 16,  // Professional header size
    text: options.fontSize?.text ?? 12,      // Standard text size for readability
    footer: options.fontSize?.footer ?? 9,   // Slightly smaller for footer (professional standard)
    signature: options.fontSize?.signature ?? 12,
    designation: options.fontSize?.designation ?? 10
  };

  // Create directory if it doesn't exist
  await ensureDirectoryExists(options.outputPath);

  return new Promise<string>((resolve, reject) => {
    try {
      // Create a write stream
      const stream = fs.createWriteStream(options.outputPath);

      // Create a document with professional layout
      const doc = new PDFDocument({
        autoFirstPage: true,
        size: 'A4',
        margin,
        bufferPages: true
      });

      // Pipe the PDF to the write stream
      doc.pipe(stream);

      // Handle stream events
      stream.on('error', (err: Error) => {
        reject(new Error(`Error writing to PDF stream: ${err.message}`));
      });

      stream.on('finish', () => {
        resolve(options.outputPath);
      });

      // Reserve space for footer on each page
      const pageBottom = doc.page.height - margin - 20;
      
      // Add event listener for new pages
      doc.on('pageAdded', () => {
        // Ensure consistent margins on each page
        doc.page.margins.bottom = margin + 20;
      });

      // Generate the document content
      const generateDocument = async (): Promise<void> => {
        try {
          // Starting position
          let currentY = margin;
          
          // Add header with logo and company name
          currentY = await addHeaderWithLogo(
            doc, logoUrl, companyName, margin, 
            currentY, logoWidth, fontSize.header
          );
          
          // Add proper spacing after header
          currentY += headerSpacing;
          
          // Add content with proper spacing
          doc.font('Helvetica').fontSize(fontSize.text);
          doc.y = currentY; // Set position explicitly
          
          doc.text(paragraphText, {
            width: doc.page.width - 2 * margin,
            align: 'left',
            lineGap: 2 // Slightly increased line spacing for better readability
          });
          
          // Add signature after paragraph with proper spacing
          const signatureY = Math.min(
            doc.y + signatureSpacing, 
            doc.page.height - margin - 80
          );
          
          // If signature would go too close to bottom, add a new page
          if (signatureY > doc.page.height - margin - 80) {
            doc.addPage();
            addSignature(doc, signatureInfo, margin, margin + 40, 
              fontSize.signature, fontSize.designation);
          } else {
            addSignature(doc, signatureInfo, margin, signatureY, 
              fontSize.signature, fontSize.designation);
          }
          
          // Get total pages and add footers
          const range = doc.bufferedPageRange();
          const totalPages = range.count;
          
          // Add footer to each page
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
 * Add header with logo and company name, returns the next Y position
 */
async function addHeaderWithLogo(
  doc: PDFKit.PDFDocument,
  logoUrl: string | null,
  companyName: string,
  margin: number,
  startY: number,
  logoWidth: number,
  fontSize: number
): Promise<number> {
  // Height tracking
  let maxHeight = 0;
  const initialY = startY;

  // Add logo if provided
  if (logoUrl) {
    try {
      const logoBuffer = await fetchLogo(logoUrl);
      
      // Draw logo with smaller size
      doc.image(logoBuffer, margin, startY, { width: logoWidth });
      
      // Estimate logo height (assuming aspect ratio preservation)
      const logoHeight = logoWidth; // Estimate, will vary based on actual logo
      maxHeight = Math.max(maxHeight, logoHeight);
    } catch (error) {
      console.warn(`Could not add logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Add company name right-aligned, vertically centered with logo
  doc.font('Helvetica-Bold')
     .fontSize(fontSize)
     .text(companyName, 
           margin, 
           startY, 
           { 
             align: 'right',
             width: doc.page.width - 2 * margin
           });
  
  // Update max height based on text height
  const textHeight = fontSize * 1.2; // Estimate text height
  maxHeight = Math.max(maxHeight, textHeight);
  
  // Return the position below the header
  return initialY + maxHeight;
}

/**
 * Add signature and designation with proper alignment
 */
function addSignature(
  doc: PDFKit.PDFDocument,
  signatureInfo: SignatureInfo,
  margin: number,
  yPosition: number,
  signatureFontSize: number,
  designationFontSize: number
): void {
  // Save position
  doc.y = yPosition;
  
  // Calculate right-aligned position
  const signatureWidth = 150;
  const signatureX = doc.page.width - margin - signatureWidth;
  
  // Add signature name with bold font
  doc.font('Helvetica-Bold')
     .fontSize(signatureFontSize)
     .text(signatureInfo.name, 
           signatureX, 
           yPosition, 
           { 
             align: 'left', 
             width: signatureWidth,
             continued: false
           });
           
  // Add designation on the next line
  doc.font('Helvetica')
     .fontSize(designationFontSize)
     .text(signatureInfo.designation, 
           signatureX,
           doc.y + 5, 
           { 
             align: 'left', 
             width: signatureWidth,
             continued: false
           });
}

/**
 * Add footer with date and page number
 */
function addFooterToPage(
  doc: PDFKit.PDFDocument,
  pageNumber: number,
  totalPages: number,
  margin: number,
  fontSize: number
): void {
  // Calculate footer position
  const footerY = doc.page.height - margin - 15;
  
  // Format date elegantly
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  // Save current state
  doc.save();
  
  // Use slightly lighter font color for footer (more elegant)
  doc.fillColor('#555555');
  
  // Add date on left
  doc.font('Helvetica')
     .fontSize(fontSize)
     .text(currentDate, 
           margin, 
           footerY, 
           { align: 'left' });

  // Add page number on right
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    doc.page.width - margin - 100,
    footerY,
    { align: 'right', width: 100 }
  );
  
  // Restore state
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