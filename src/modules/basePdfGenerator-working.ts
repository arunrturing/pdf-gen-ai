import PDFDocument from 'pdfkit';
import { Stream } from 'stream';
import * as https from 'https';
import * as http from 'http';

/**
 * Downloads an image from a URL
 * @param url URL to download the image from
 * @returns Promise that resolves to a Buffer containing the image data
 */
function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', (error) => {
      reject(error);
    });
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
    // Download the logo image first
    let logoBuffer: Buffer | null = null;
    if (logoS3Url) {
      try {
        logoBuffer = await downloadImage(logoS3Url);
      } catch (error) {
        console.warn('Failed to download logo, proceeding without it:', error);
      }
    }

    return new Promise((resolve, reject) => {
      // Create a document
      const doc = new PDFDocument({
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        autoFirstPage: true,
        size: 'A4'
      });

      // Buffer to store PDF data
      const chunks: Buffer[] = [];
      const stream = new Stream.Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        }
      });

      stream.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', (error) => {
        reject(error);
      });

      doc.pipe(stream);

      // Register font for header/footer
      doc.font('Helvetica');

      // Add header with logo and company name
      if (logoBuffer) {
        // Add logo to left side of header
        doc.image(logoBuffer, 50, 30, { width: 50 });
      }

      // Add company name to right side of header
      doc.fontSize(16)
         .text(companyName, 
           doc.page.width - 50 - doc.widthOfString(companyName), 
           40
         );

      // Add some content to the page so it's not empty
      doc.fontSize(12)
         .text('Generated on ' + new Date().toLocaleString(), 50, 100);

      // Add footer to the first page
      addFooter(doc);

      doc.end();
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Adds a footer with date and page number to the current page
 * @param doc PDF document to add footer to
 */
function addFooter(doc: PDFKit.PDFDocument): void {
  const currentDate = new Date().toLocaleDateString();
  const pageNumber = `Page 1`;
  
  const footerY = doc.page.height - 30;
  
  doc.fontSize(10)
     .text(currentDate, 50, footerY);
  
  doc.fontSize(10)
     .text(pageNumber, 
       doc.page.width - 50 - doc.widthOfString(pageNumber), 
       footerY
     );
}