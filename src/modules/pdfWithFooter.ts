import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { Buffer } from 'buffer';

// Interface definitions for type safety
interface PDFOptions {
  outputPath?: string;
  fontSize?: number;
  fontFamily?: string;
  lineGap?: number;
  pageMargin?: number;
  logoWidth?: number;
  companyNameFontSize?: number;
  paragraphFontSize?: number;
  signatureFontSize?: number;
  designationFontSize?: number;
}

interface SignatureInfo {
  name: string;
  designation: string;
}

// Default options
const DEFAULT_OPTIONS: PDFOptions = {
  outputPath: './output.pdf',
  fontSize: 12,
  fontFamily: 'Helvetica',
  lineGap: 5,
  pageMargin: 50,
  logoWidth: 100,
  companyNameFontSize: 16,
  paragraphFontSize: 12,
  signatureFontSize: 12,
  designationFontSize: 10
};

/**
 * Safely fetches an image from a URL and returns it as a buffer
 * Using proper error handling and timeout to prevent Zlib stack issues
 */
async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  try {
    // Set a reasonable timeout to prevent hanging
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error fetching image:', error.message);
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
}

/**
 * Create directory if it doesn't exist
 */
async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dirname = path.dirname(filePath);
  const mkdir = promisify(fs.mkdir);
  
  try {
    await mkdir(dirname, { recursive: true });
  } catch (error) {
    // Directory already exists or cannot be created
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Create a PDF with logo, company name, paragraph and signature
 */
async function createStructuredPDF(
  logoUrl: string,
  companyName: string,
  paragraphText: string,
  signatureInfo: SignatureInfo,
  options: PDFOptions = {}
): Promise<Buffer> {
  // Merge default options with provided options
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise(async (resolve, reject) => {
    try {
      // Create a new document with better memory handling
      const doc = new PDFDocument({
        autoFirstPage: true,
        bufferPages: true, // Buffer pages for better memory management
        compress: true,    // Use compression but with proper error handling
        size: 'A4',
        margin: mergedOptions.pageMargin
      });
      
      // Collect the PDF data chunks
      const chunks: Buffer[] = [];
      
      // Handle data event - collect chunks instead of piping directly
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      // When the document is ended, concatenate all chunks into a single buffer
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });
      
      // Handle any errors during PDF generation
      doc.on('error', (err) => {
        reject(new Error(`PDF generation error: ${err.message}`));
      });
      
      // Set default font and size
      doc.font(mergedOptions.fontFamily)
         .fontSize(mergedOptions.fontSize);
         
      // Fetch and add logo image if provided
      if (logoUrl) {
        try {
          const imageBuffer = await fetchImageBuffer(logoUrl);
          
          // Add logo to top left
          doc.image(imageBuffer, 
                    mergedOptions.pageMargin, 
                    mergedOptions.pageMargin, 
                   { width: mergedOptions.logoWidth });
                   
          // Move down from the logo
          doc.moveDown(2);
        } catch (logoError) {
          console.warn(`Logo could not be added: ${logoError.message}. Continuing without logo.`);
          // Continue without logo rather than failing the entire PDF
        }
      }
      
      // Add company name
      doc.fontSize(mergedOptions.companyNameFontSize)
         .font(`${mergedOptions.fontFamily}-Bold`)
         .text(companyName, 
               mergedOptions.pageMargin + (mergedOptions.logoWidth || 0) + 20, 
               mergedOptions.pageMargin, 
               { align: 'left' });
      
      // Reset font and add paragraph with proper spacing
      doc.moveDown(3)
         .font(mergedOptions.fontFamily)
         .fontSize(mergedOptions.paragraphFontSize)
         .text(paragraphText, {
           align: 'left',
           width: doc.page.width - (2 * mergedOptions.pageMargin),
           lineGap: mergedOptions.lineGap
         });
      
      // Add space for signature
      doc.moveDown(4);
      
      // Add signature and designation
      doc.fontSize(mergedOptions.signatureFontSize)
         .text(signatureInfo.name, {
           align: 'right',
           width: doc.page.width - (2 * mergedOptions.pageMargin),
         })
         .fontSize(mergedOptions.designationFontSize)
         .text(signatureInfo.designation, {
           align: 'right',
           width: doc.page.width - (2 * mergedOptions.pageMargin),
         });
      
      // Finalize the PDF
      // Using a try/catch to handle any zlib errors during finalization
      try {
        doc.end();
      } catch (endError) {
        reject(new Error(`Error finalizing PDF: ${endError.message}`));
      }
      
    } catch (error) {
      reject(new Error(`Error in PDF creation: ${error.message}`));
    }
  });
}

/**
 * Create and save a PDF file to disk
 */
async function createAndSavePDF(
  logoUrl: string,
  companyName: string,
  paragraphText: string,
  signatureInfo: SignatureInfo,
  outputPath: string,
  options: PDFOptions = {}
): Promise<string> {
  try {
    // Ensure the output directory exists
    await ensureDirectoryExists(outputPath);
    
    // Generate the PDF buffer
    const pdfBuffer = await createStructuredPDF(
      logoUrl,
      companyName,
      paragraphText,
      signatureInfo,
      options
    );
    
    // Write the buffer to a file
    return new Promise((resolve, reject) => {
      const writeStream = createWriteStream(outputPath);
      
      writeStream.on('error', (err) => {
        reject(new Error(`Error writing PDF to disk: ${err.message}`));
      });
      
      writeStream.on('finish', () => {
        resolve(outputPath);
      });
      
      // Write the buffer to the stream and end the stream
      writeStream.write(pdfBuffer);
      writeStream.end();
    });
  } catch (error) {
    throw new Error(`Failed to create and save PDF: ${error.message}`);
  }
}
