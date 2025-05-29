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
  const formattedUrl = url.replace(/\\/g, HTTP_CONSTANTS.FORWARD_SLASH);
  
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
export function addFooter(doc: PDFKit.PDFDocument): void {
  const currentDate = new Date().toLocaleDateString();
  const pageNumber = `Page ${doc.bufferedPageRange().count}`;
  
  // Save the current document state
  doc.save();
  
  // Add date to left side
  doc.fontSize(PDF_CONSTANTS.FONT.FOOTER_SIZE)
     .text(currentDate, PDF_CONSTANTS.MARGIN.LEFT, doc.page.height - PDF_CONSTANTS.MARGIN.BOTTOM);
  
  // Add page number to right side
  const pageNumberWidth = doc.widthOfString(pageNumber);
  doc.fontSize(PDF_CONSTANTS.FONT.FOOTER_SIZE)
     .text(
       pageNumber, 
       doc.page.width - PDF_CONSTANTS.MARGIN.RIGHT - pageNumberWidth, 
       doc.page.height - PDF_CONSTANTS.MARGIN.BOTTOM
     );
  
  // Restore the document state
  doc.restore();
}

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