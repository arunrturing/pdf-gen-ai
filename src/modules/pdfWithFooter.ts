import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { promisify } from 'util';
import { Buffer } from 'buffer';

// Define interfaces for type safety
interface PDFOptions {
  outputPath: string;
  margin?: number;
  headerHeight?: number;
  footerHeight?: number;
  fontSize?: {
    header?: number;
    text?: number;
    footer?: number;
    signature?: number;
    designation?: number;
  };
}

interface SignatureInfo {
  name: string;
  designation: string;
}

/**
 * Creates a PDF document with header, content paragraph, and footer
 * @param logoUrl URL of the company logo
 * @param companyName Name of the company
 * @param paragraphText Main content text
 * @param signatureInfo Signature and designation information
 * @param options PDF generation options
 * @returns Promise resolving to the output file path
 */
export async function createPDF(
  logoUrl: string,
  companyName: string,
  paragraphText: string,
  signatureInfo: SignatureInfo,
  options: PDFOptions
): Promise<string> {
  // Default values
  const margin = options.margin || 50;
  const headerHeight = options.headerHeight || 80;
  const footerHeight = options.footerHeight || 50;
  
  const fontSize = {
    header: options.fontSize?.header || 16,
    text: options.fontSize?.text || 12,
    footer: options.fontSize?.footer || 10,
    signature: options.fontSize?.signature || 12,
    designation: options.fontSize?.designation || 10
  };

  // Create directory if it doesn't exist
  await ensureDirectoryExists(options.outputPath);

  // Create a write stream
  const stream = fs.createWriteStream(options.outputPath);

  return new Promise<string>((resolve, reject) => {
    // Create a new PDF document
    const doc = new PDFDocument({
      autoFirstPage: true,
      margins: {
        top: margin + headerHeight,
        bottom: margin + footerHeight,
        left: margin,
        right: margin
      },
      bufferPages: true // Important: buffer pages to allow for page numbering
    });

    // Pipe the PDF to the write stream
    doc.pipe(stream);

    // Handle stream errors
    stream.on('error', (err) => {
      reject(new Error(`Error writing to PDF stream: ${err.message}`));
    });

    // When the document is completed
    stream.on('finish', () => {
      resolve(options.outputPath);
    });

    // Set up event handling for errors in PDF generation
    doc.on('error', (err) => {
      reject(new Error(`Error in PDF generation: ${err.message}`));
    });

    // Define a function to add header to each page
    const addHeader = async (): Promise<void> => {
      try {
        // Add logo if URL is provided
        if (logoUrl) {
          try {
            const logoBuffer = await fetchLogo(logoUrl);
            
            // Draw the logo at the top left
            doc.image(logoBuffer, margin, margin, { 
              width: 100 // Adjust logo width as needed
            });
          } catch (logoError) {
            console.warn(`Could not add logo: ${logoError.message}`);
            // Continue without logo
          }
        }

        // Add company name at the top right
        doc.font('Helvetica-Bold')
           .fontSize(fontSize.header)
           .text(companyName, 
                 margin + 120, // Position after logo with some spacing
                 margin, 
                 { align: 'left' });

        // Reset font for content
        doc.font('Helvetica')
           .fontSize(fontSize.text);
      } catch (error) {
        throw new Error(`Error adding header: ${error.message}`);
      }
    };

    // Define a function to add footer to each page
    const addFooter = (pageNumber: number, totalPages: number): void => {
      const footerY = doc.page.height - margin - 20;
      
      // Add current date on the left
      const currentDate = new Date().toLocaleDateString();
      doc.font('Helvetica')
         .fontSize(fontSize.footer)
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
    };

    // Add the main paragraph content
    const addContent = (): void => {
      const contentY = margin + headerHeight + 20;
      
      doc.font('Helvetica')
         .fontSize(fontSize.text)
         .text(paragraphText, 
               margin, 
               contentY, 
               { 
                 align: 'left',
                 width: doc.page.width - (2 * margin)
               });
    };

    // Add the signature and designation
    const addSignature = (): void => {
      const signatureY = doc.y + 50; // Add some space after the content
      
      doc.font('Helvetica-Bold')
         .fontSize(fontSize.signature)
         .text(signatureInfo.name, 
               doc.page.width - margin - 150, 
               signatureY, 
               { align: 'left', width: 150 });
               
      doc.font('Helvetica')
         .fontSize(fontSize.designation)
         .text(signatureInfo.designation, 
               doc.page.width - margin - 150,
               doc.y + 5, 
               { align: 'left', width: 150 });
    };

    // Main execution
    const generateDocument = async (): Promise<void> => {
      try {
        // Add header
        await addHeader();
        
        // Add content
        addContent();
        
        // Add signature
        addSignature();
        
        // Get total pages
        const totalPages = doc.bufferedPageRange().count;
        
        // Add footer to each page with page numbers
        let pageNumber = 0;
        const pageRange = doc.bufferedPageRange();
        
        for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
          pageNumber++;
          doc.switchToPage(i);
          addFooter(pageNumber, totalPages);
        }
        
        // Finalize the PDF
        doc.end();
      } catch (error) {
        reject(new Error(`Error generating PDF document: ${error.message}`));
      }
    };
    
    // Start document generation
    generateDocument().catch((error) => {
      reject(error);
    });
  });
}

/**
 * Fetches a logo from url and returns it as a buffer
 */
async function fetchLogo(url: string): Promise<Buffer> {
  try {
    // Handle different types of URLs (http, https, file)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 10000 // 10 seconds timeout to prevent hanging
      });
      return Buffer.from(response.data);
    } else {
      // Assume it's a local file
      return await promisify(fs.readFile)(url);
    }
  } catch (error) {
    throw new Error(`Failed to fetch logo: ${error.message}`);
  }
}

/**
 * Ensures the directory exists for the output file
 */
async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dirPath = path.dirname(filePath);
  try {
    await promisify(fs.mkdir)(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Example usage function
 */
export async function generateExamplePDF(): Promise<void> {
  try {
    const logoUrl = 'https://example.com/logo.png'; // Replace with actual logo URL
    const companyName = 'Your Company Name';
    const paragraphText = 'This is an example paragraph that will be included in the PDF. It demonstrates the text layout in the document. The text is properly formatted and aligned.';
    
    const signatureInfo: SignatureInfo = {
      name: 'John Doe',
      designation: 'Chief Executive Officer'
    };
    
    const outputPath = path.join(__dirname, 'output', `document-${Date.now()}.pdf`);
    
    await createPDF(
      logoUrl,
      companyName,
      paragraphText,
      signatureInfo,
      {
        outputPath,
        margin: 50,
        fontSize: {
          header: 18,
          text: 12,
          footer: 10,
          signature: 12,
          designation: 10
        }
      }
    );
    
    console.log(`PDF created successfully at: ${outputPath}`);
  } catch (error) {
    console.error('Failed to generate PDF:', error.message);
  }
}