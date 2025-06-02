import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';

// Constants for PDF dimensions and layout
const PDF_CONSTANTS = {
  MARGIN: {
    TOP: 50,
    BOTTOM: 50,
    LEFT: 50,
    RIGHT: 50
  },
  PAPER_SIZE: 'A4',
  FONT: {
    FAMILY: 'Helvetica',
    HEADER_SIZE: 16,
    FOOTER_SIZE: 10
  },
  HEADER: {
    LOGO: {
      X: 50,
      Y: 30,
      WIDTH: 50
    },
    COMPANY_NAME_Y: 40
  }
};

// Constants for file operations
const FILE_CONSTANTS = {
  OUTPUT_DIR: 'output',
  DEFAULT_FILENAME_PREFIX: 'document-',
  FILE_EXTENSION: '.pdf'
};

// Constants for image operations
const IMAGE_CONSTANTS = {
  RESPONSE_TYPE: 'arraybuffer' as const,
  BINARY_ENCODING: 'binary' as BufferEncoding
};

// Message constants
const MESSAGES = {
  FETCHING_LOGO: 'Fetching logo from: ',
  LOGO_FETCH_SUCCESS: 'Logo fetched successfully',
  LOGO_FETCH_ERROR: 'Error fetching logo:',
  PDF_GENERATION_ERROR: 'Error in createBasePDF:',
  PDF_SAVE_SUCCESS: 'PDF saved successfully to ',
  PDF_SAVE_ERROR: 'Error writing PDF to file:',
  GENERATE_PDF: 'Generating PDF...',
  SAVE_PDF: 'PDF generated, saving to file...',
  PDF_SAVED: 'PDF saved to: ',
  PDF_GENERATION_ERROR_FULL: 'Error generating and saving PDF:',
  TEST_SUCCESS: 'PDF test completed successfully. File saved at: ',
  TEST_FAILURE: 'PDF generation test failed:'
};

// HTML/HTTP Constants
const HTTP_CONSTANTS = {
  PROTOCOL_PREFIX: 'http',
  HTTPS_PREFIX: 'https://',
  BACKSLASH: '\\',
  FORWARD_SLASH: '/'
};

// Safety limits
const SAFETY_LIMITS = {
  MAX_PAGES: 1000
};

/**
 * Interface for PDF document margins
 */
interface PdfMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Interface for PDF document configuration
 */
interface PdfDocConfig {
  margins: PdfMargins;
  autoFirstPage: boolean;
  size: string;
}

/**
 * Formats a URL to ensure it has forward slashes and proper protocol
 * @param url The URL to format
 * @returns Properly formatted URL
 */
export function formatUrl(url: string): string {
  // Replace backslashes with forward slashes
  const formattedUrl = url.replace(new RegExp('\\\\', 'g'), '/');
  
  // Ensure the URL has a proper protocol
  return formattedUrl.startsWith(HTTP_CONSTANTS.PROTOCOL_PREFIX) 
    ? formattedUrl 
    : `${HTTP_CONSTANTS.HTTPS_PREFIX}${formattedUrl}`;
}

/**
 * Fetches an image from a URL and returns it as a buffer
 * @param logoUrl URL to fetch the logo from
 * @returns Promise that resolves to the image buffer or null if fetching fails
 */
export async function fetchLogoImage(logoUrl: string): Promise<Buffer | null> {
  if (!logoUrl) {
    return null;
  }

  try {
    // Format the URL properly
    const formattedUrl = formatUrl(logoUrl);
    
    console.log(`${MESSAGES.FETCHING_LOGO}${formattedUrl}`);
    
    // Fetch image data
    const response: AxiosResponse<ArrayBuffer> = await axios.get(formattedUrl, {
      responseType: IMAGE_CONSTANTS.RESPONSE_TYPE
    });
    
    // Convert response to buffer
    const logoBuffer = Buffer.from(response.data);
    console.log(MESSAGES.LOGO_FETCH_SUCCESS);
    
    return logoBuffer;
  } catch (error) {
    console.error(MESSAGES.LOGO_FETCH_ERROR, error);
    return null;
  }
}

/**
 * Creates PDF document settings with proper margins
 * @returns PDFKit document configuration
 */
export function createPdfDocConfig(): PdfDocConfig {
  return {
    margins: {
      top: PDF_CONSTANTS.MARGIN.TOP,
      bottom: PDF_CONSTANTS.MARGIN.BOTTOM,
      left: PDF_CONSTANTS.MARGIN.LEFT,
      right: PDF_CONSTANTS.MARGIN.RIGHT
    },
    autoFirstPage: true,
    size: PDF_CONSTANTS.PAPER_SIZE
  };
}

/**
 * Creates a writable stream that collects chunks into an array
 * @param chunks Array to collect buffer chunks
 * @returns A Writable stream
 */
export function createBufferCollector(chunks: Buffer[]): Writable {
  return new Writable({
    write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
      chunks.push(Buffer.from(chunk as ArrayBuffer));
      callback();
    }
  });
}

/**
 * Adds a company logo to the PDF document
 * @param doc PDF document to add the logo to
 * @param logoBuffer Buffer containing the logo image
 */
export function addLogoToHeader(doc: PDFKit.PDFDocument, logoBuffer: Buffer | null): void {
  if (logoBuffer) {
    doc.image(
      logoBuffer, 
      PDF_CONSTANTS.HEADER.LOGO.X, 
      PDF_CONSTANTS.HEADER.LOGO.Y, 
      { width: PDF_CONSTANTS.HEADER.LOGO.WIDTH }
    );
  }
}

/**
 * Adds company name to the header of the PDF
 * @param doc PDF document to add the company name to
 * @param companyName The company name to add
 */
export function addCompanyNameToHeader(doc: PDFKit.PDFDocument, companyName: string): void {
  const companyNameWidth = doc.widthOfString(companyName);
  doc.fontSize(PDF_CONSTANTS.FONT.HEADER_SIZE)
     .text(
       companyName, 
       doc.page.width - PDF_CONSTANTS.MARGIN.RIGHT - companyNameWidth, 
       PDF_CONSTANTS.HEADER.COMPANY_NAME_Y
     );
}

/**
 * Adds a footer with date and page number to the current page
 * @param doc PDF document to add footer to
 */
// export function addFooter(doc: PDFKit.PDFDocument): void {
//   const currentDate = new Date().toLocaleDateString();
//   const pageNumber = `Page ${doc.bufferedPageRange().count}`;
  
//   // Save the current document state
//   doc.save();
  
//   // Add date to left side
//   doc.fontSize(PDF_CONSTANTS.FONT.FOOTER_SIZE)
//      .text(currentDate, PDF_CONSTANTS.MARGIN.LEFT, doc.page.height - PDF_CONSTANTS.MARGIN.BOTTOM);
  
//   // Add page number to right side
//   const pageNumberWidth = doc.widthOfString(pageNumber);
//   doc.fontSize(PDF_CONSTANTS.FONT.FOOTER_SIZE)
//      .text(
//        pageNumber, 
//        doc.page.width - PDF_CONSTANTS.MARGIN.RIGHT - pageNumberWidth, 
//        doc.page.height - PDF_CONSTANTS.MARGIN.BOTTOM
//      );
  
//   // Restore the document state
//   doc.restore();
// }

/**
 * Sets up page event handlers for the PDF document
 * @param doc PDF document to set up handlers for
 */
export function setupPageEventHandlers(doc: PDFKit.PDFDocument): void {
  let pageCount = 1;
  doc.on('pageAdded', () => {
    pageCount++;
    if (pageCount <= SAFETY_LIMITS.MAX_PAGES) {
      addFooter(doc);
    } else {
      doc.removeAllListeners('pageAdded');
    }
  });
}

/**
 * Creates a base PDF with company logo and name in header, date and page number in footer
 * @param logoS3Url URL to the company logo image stored in S3
 * @param companyName Name of the company to display in header
 * @returns Promise that resolves to the created PDF document as a Buffer
 */
export async function createBasePDF(logoS3Url: string, companyName: string): Promise<Buffer> {
  try {
    // Fetch the logo from URL if provided
    const logoBuffer = await fetchLogoImage(logoS3Url);

    return new Promise<Buffer>((resolve, reject) => {
      try {
        // Create PDF document with proper configuration
        const doc = new PDFDocument(createPdfDocConfig());

        // Buffer to store PDF data
        const chunks: Buffer[] = [];
        const stream = createBufferCollector(chunks);

        // Handle stream completion
        stream.on('finish', () => {
          resolve(Buffer.concat(chunks));
        });

        // Handle stream errors
        stream.on('error', (error: Error) => {
          reject(error);
        });

        // Pipe the PDF document to the stream
        doc.pipe(stream);

        // Register font for header/footer
        doc.font(PDF_CONSTANTS.FONT.FAMILY);

        // Add header components
        addLogoToHeader(doc, logoBuffer);
        addCompanyNameToHeader(doc, companyName);

        // Add footer to the first page
        addFooter(doc);

        // Set up page event handlers
        setupPageEventHandlers(doc);

        // Finalize the PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    console.error(MESSAGES.PDF_GENERATION_ERROR, error);
    throw error;
  }
}

/**
 * Generates a unique filename with timestamp
 * @returns A unique filename with timestamp
 */
export function generateUniqueFilename(): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  return `${FILE_CONSTANTS.DEFAULT_FILENAME_PREFIX}${timestamp}${FILE_CONSTANTS.FILE_EXTENSION}`;
}

/**
 * Creates the output directory if it doesn't exist
 * @param directory The directory to create
 */
export function ensureDirectoryExists(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

/**
 * Saves a PDF buffer to a local file
 * @param pdfBuffer The PDF buffer to save
 * @param outputPath Optional custom output path, if not provided a default path will be used
 * @returns Promise that resolves to the full path of the saved file
 */
export async function savePdfToFile(pdfBuffer: Buffer, outputPath?: string): Promise<string> {
  // Create a unique filename with timestamp if outputPath not provided
  const defaultPath = path.join(
    process.cwd(), 
    FILE_CONSTANTS.OUTPUT_DIR, 
    generateUniqueFilename()
  );
  
  const finalPath = outputPath || defaultPath;
  
  // Ensure the directory exists
  const directory = path.dirname(finalPath);
  ensureDirectoryExists(directory);
  
  return new Promise<string>((resolve, reject) => {
    fs.writeFile(finalPath, pdfBuffer, (err) => {
      if (err) {
        console.error(MESSAGES.PDF_SAVE_ERROR, err);
        reject(err);
        return;
      }
      
      console.log(`${MESSAGES.PDF_SAVE_SUCCESS}${finalPath}`);
      resolve(finalPath);
    });
  });
}

/**
 * Example function to demonstrate how to use createBasePDF and save the result to a file
 */
export async function generateAndSavePdf(): Promise<string> {
  try {
    // Example parameters
    const logoUrl = "https://multi-tenant-dev.n-oms.in/assets/logo-hd2-BZqe1saO.png";
    const companyName = "Acme Corporation";
    
    console.log(MESSAGES.GENERATE_PDF);
    // Generate the PDF
    const pdfBuffer = await createBasePDF(logoUrl, companyName);
    
    console.log(MESSAGES.SAVE_PDF);
    // Save the PDF to a file
    const outputPath = await savePdfToFile(pdfBuffer);
    
    console.log(`${MESSAGES.PDF_SAVED}${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(MESSAGES.PDF_GENERATION_ERROR_FULL, error);
    throw error;
  }
}

/**
 * Main function for testing the PDF generation process
 */
export async function main(): Promise<void> {
  try {
    const filePath = await generateAndSavePdf();
    console.log(`${MESSAGES.TEST_SUCCESS}${filePath}`);
  } catch (error) {
    console.error(MESSAGES.TEST_FAILURE, error);
    process.exit(1);
  }
}

// If running this file directly (not imported as a module)
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export interface PdfContentItem {
  attributeType: 'paragraph' | 'signature' | 'designation';
  content: string;
}

export interface PdfOptions {
  outputPath?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  fontSize?: number;
  fontFamily?: string;
}

/**
 * Creates a PDF document with structured content
 */
export async function createPdf(
  logoUrl: string,
  companyName: string,
  pdfData: PdfContentItem[],
  options: PdfOptions = {}
): Promise<string> {
  // Create output path with default if not provided
  const outputPath = options.outputPath || `./output/document-${Date.now()}.pdf`;
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Create a PDF document with tight margins and no auto page creation
  const doc = new PDFDocument({
    margins: { top: 30, bottom: 50, left: 50, right: 50 },
    size: 'A4',
    autoFirstPage: true,
    info: {
      Title: options.title || 'Document',
      Author: options.author || companyName,
      Subject: options.subject || '',
      Keywords: options.keywords || '',
    }
  });

  // Create write stream and pipe PDF document to it
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Set default styles
  const defaultFontSize = options.fontSize ?? 12;
  const defaultFont = options.fontFamily ?? 'Helvetica';

  // Add header with logo and company name
  await addHeaderWithLogo(doc, logoUrl, companyName);

  // Start content immediately after header
  doc.moveDown(0.5);
  
  // Process each content element
  for (let i = 0; i < pdfData.length; i++) {
    const item = pdfData[i];
    
    switch (item.attributeType) {
      case 'paragraph':
        addParagraph(doc, item.content, defaultFont, defaultFontSize);
        break;
        
      case 'signature':
        addSignature(doc, item.content, defaultFont, defaultFontSize);
        break;
        
      case 'designation':
        addDesignation(doc, item.content, defaultFont, defaultFontSize);
        break;
    }
    
    // Add minimal spacing between content items
    if (i < pdfData.length - 1) {
      doc.moveDown(0.1);
    }
  }

  // Add footer at the end
  addFooter(doc);

  // Finalize the PDF
  doc.end();

  // Return a Promise that resolves with the output path when the PDF is written
  return new Promise<string>((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log(`PDF created successfully at: ${outputPath}`);
      resolve(outputPath);
    });
    writeStream.on('error', (err) => {
      console.error('Error writing PDF:', err);
      reject(err);
    });
  });
}

/**
 * Adds a header with logo and company name to the PDF
 */
async function addHeaderWithLogo(
  doc: PDFKit.PDFDocument,
  logoUrl: string,
  companyName: string
): Promise<void> {
  try {
    // Set a compact header position
    const headerY = 30;
    
    // Add logo image - handle both local and remote URLs
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      doc.image(Buffer.from(response.data), 50, headerY, { width: 80, height: 55 });
    } else {
      doc.image(logoUrl, 50, headerY, { width: 80, height: 55 });
    }
    
    // Add company name on the right side
    const pageWidth = doc.page.width;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text(companyName, pageWidth - 200, headerY + 10, {
         width: 150,
         align: 'right'
       });
    
    // Position the cursor below the header for content to start
    doc.y = headerY + 65;
    
  } catch (error) {
    console.error('Error adding header to PDF:', error);
    
    // Fallback: Just add the company name if logo fails
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text(companyName, 50, 30, {
         align: 'center'
       });
    doc.y = 80;
  }
}

/**
 * Adds footer with page number to the PDF
 */
function addFooter(doc: PDFKit.PDFDocument): void {
  // Add footer to the current page
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  
  // Save current position and settings
  const currentY = doc.y;
  
  // Add date on left side
  doc.font('Helvetica')
     .fontSize(8)
     .text(
        new Date().toLocaleDateString(), 
        50, 
        pageHeight - 40, 
        { align: 'left' }
     );
     
  // Add page number on right side
  doc.font('Helvetica')
     .fontSize(8)
     .text(
        'Page 1', 
        pageWidth - 100, 
        pageHeight - 40, 
        { align: 'right' }
     );
  
  // Restore previous position
  doc.y = currentY;
}

/**
 * Adds a paragraph element to the PDF
 */
function addParagraph(
  doc: PDFKit.PDFDocument,
  content: string,
  fontFamily: string,
  fontSize: number
): void {
  // Save the current graphics state
  doc.save();
  
  // Set compact paragraph formatting
  doc.font(fontFamily)
     .fontSize(fontSize * 0.9); // Slightly smaller font
  
  // Use compact text options to prevent page breaks
  const textOptions = {
    width: doc.page.width - 100,
    align: 'left' as const,
    lineGap: 1, // Minimal line spacing
    height: 100, // Limit text height to prevent page overflow
    ellipsis: false
  };
  
  // Add the text
  doc.text(content, 50, doc.y, textOptions);
  
  // Restore graphics state
  doc.restore();
  
  // Add a small space after paragraph
  doc.moveDown(0.2);
}

/**
 * Adds a signature element to the PDF
 */
function addSignature(
  doc: PDFKit.PDFDocument,
  content: string,
  fontFamily: string,
  fontSize: number
): void {
  // Save the current graphics state
  doc.save();
  
  // Move down to create space
  doc.moveDown(0.2);
  
  // Add "Signature:" label
  doc.font(fontFamily)
     .fontSize(fontSize)
     .text('Signature:', 50, doc.y, {
       width: 150,
       align: 'left'
     });
  
  // Draw a signature line
  const signatureY = doc.y + 5;
  doc.moveTo(100, signatureY)
     .lineTo(300, signatureY)
     .stroke();
     
  // Add the signature content below the line
  doc.moveDown(0.5);
  doc.font(fontFamily)
     .fontSize(fontSize)
     .text(content, 100, doc.y, {
       width: 200,
       align: 'center'
     });
  
  // Restore graphics state
  doc.restore();
  
  // Move down after signature
  doc.moveDown(0.2);
}

/**
 * Adds a designation element to the PDF
 */
function addDesignation(
  doc: PDFKit.PDFDocument,
  content: string,
  fontFamily: string,
  fontSize: number
): void {
  // Save the current graphics state
  doc.save();
  
  // Add the designation with specific formatting
  doc.font(fontFamily)
     .fontSize(fontSize)
     .text(content, 50, doc.y, {
       width: 200,
       align: 'left'
     });
  
  // Restore graphics state
  doc.restore();
  
  // Move down after designation
  doc.moveDown(0.1);
}
