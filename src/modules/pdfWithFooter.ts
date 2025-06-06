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
 * Creates an elegant, professional PDF document with proper spacing and alignment
 */
export async function createPDF(
  logoUrl: string | null,
  companyName: string,
  paragraphText: string,
  signatureInfo: SignatureInfo,
  options: PDFOptions
): Promise<string> {
  // Professional document settings
  const margin = options.margin ?? 60; // Slightly larger margins for elegance
  const logoWidth = options.logoWidth ?? 40; // Smaller logo for better balance
  const headerSpacing = options.headerSpacing ?? 40; // Space after header
  const paragraphSpacing = options.paragraphSpacing ?? 20; // Space after paragraph
  const signatureSpacing = options.signatureSpacing ?? 60; // Space before signature
  
  const fontSize = {
    header: options.fontSize?.header ?? 16,
    text: options.fontSize?.text ?? 12,
    footer: options.fontSize?.footer ?? 9, // Slightly smaller footer for elegance
    signature: options.fontSize?.signature ?? 12,
    designation: options.fontSize?.designation ?? 10
  };

  // Create directory if it doesn't exist
  await ensureDirectoryExists(options.outputPath);

  return new Promise<string>((resolve, reject) => {
    try {
      // Create a write stream
      const stream = fs.createWriteStream(options.outputPath);

      // Create an elegant document with proper margins
      const doc = new PDFDocument({
        autoFirstPage: true,
        size: 'A4',
        margin,
        bufferPages: true,
        info: {
          Title: 'Professional Document',
          Author: companyName,
          Creator: 'PDF Generator',
          Producer: companyName
        }
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

      // Start document generation
      const generateDocument = async (): Promise<void> => {
        try {
          // Set initial position
          const startY = margin;

          // Add professional header with logo and company name
          const headerHeight = await addElegantHeader(
            doc, 
            logoUrl, 
            companyName, 
            margin, 
            startY, 
            logoWidth, 
            fontSize.header
          );
          
          // Add clear spacing after header to prevent overlap
          const contentStartY = startY + headerHeight + headerSpacing;
          
          // Add content with proper spacing and formatting
          doc.font('Helvetica')
             .fontSize(fontSize.text)
             .text(paragraphText, 
                  margin, 
                  contentStartY, 
                  {
                    width: doc.page.width - 2 * margin,
                    align: 'justify', // Justified text for professional appearance
                    lineGap: 2 // Slightly increased line gap for readability
                  });
          
          // Add signature with proper spacing from content
          const signatureY = doc.y + signatureSpacing;
          
          addProfessionalSignature(
            doc, 
            signatureInfo, 
            margin, 
            signatureY, 
            fontSize.signature, 
            fontSize.designation
          );
          
          // Get the total number of pages
          const range = doc.bufferedPageRange();
          const totalPages = range.count;
          
          // Apply elegant footer to each page
          for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            addElegantFooter(doc, i + 1, totalPages, margin, fontSize.footer);
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
 * Add elegant header with logo and company name
 * Returns the height of the header area
 */
async function addElegantHeader(
  doc: PDFKit.PDFDocument,
  logoUrl: string | null,
  companyName: string,
  margin: number,
  startY: number,
  logoWidth: number,
  fontSize: number
): Promise<number> {
  let logoHeight = 0;

  // Add logo if URL is provided
  if (logoUrl) {
    try {
      const logoBuffer = await fetchLogo(logoUrl);
      
      // Draw the logo at the top left with appropriate size
      doc.image(logoBuffer, margin, startY, { width: logoWidth });
      
      // Estimate logo height (maintaining aspect ratio)
      logoHeight = logoWidth; // Assuming square logo as default
    } catch (error) {
      console.warn(`Could not add logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Add company name right-aligned with elegant font
  doc.font('Helvetica-Bold')
     .fontSize(fontSize)
     .text(companyName, 
           margin + (logoUrl ? logoWidth + 20 : 0), // Position after logo or at margin
           startY, 
           { 
             align: 'right',
             width: doc.page.width - 2 * margin - (logoUrl ? logoWidth + 20 : 0)
           });

  // Return the header height (maximum of logo height or text height)
  return Math.max(logoHeight, fontSize * 1.5);
}

/**
 * Add professional signature and designation
 */
function addProfessionalSignature(
  doc: PDFKit.PDFDocument,
  signatureInfo: SignatureInfo,
  margin: number,
  signatureY: number,
  signatureFontSize: number,
  designationFontSize: number
): void {
  // Add subtle line above signature (professional touch)
  doc.moveTo(doc.page.width - margin - 150, signatureY - 20)
     .lineTo(doc.page.width - margin, signatureY - 20)
     .stroke();
  
  // Add signature name
  doc.font('Helvetica-Bold')
     .fontSize(signatureFontSize)
     .text(signatureInfo.name, 
           doc.page.width - margin - 150, 
           signatureY, 
           { align: 'left', width: 150 });
  
  // Add designation with proper spacing
  doc.font('Helvetica')
     .fontSize(designationFontSize)
     .text(signatureInfo.designation, 
           doc.page.width - margin - 150,
           doc.y + 3, 
           { align: 'left', width: 150 });
}

/**
 * Add elegant footer with date and page number
 */
function addElegantFooter(
  doc: PDFKit.PDFDocument,
  pageNumber: number,
  totalPages: number,
  margin: number,
  fontSize: number
): void {
  // Calculate footer position at bottom of page
  const footerY = doc.page.height - margin - 15;
  
  // Format date with elegant format
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  // Save current drawing state
  doc.save();
  
  // Add subtle line above footer (professional touch)
  doc.strokeColor('#cccccc')
     .lineWidth(0.5)
     .moveTo(margin, footerY - 10)
     .lineTo(doc.page.width - margin, footerY - 10)
     .stroke();

  // Return to default color
  doc.fillColor('black');
  
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