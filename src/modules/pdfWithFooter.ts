import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Buffer } from 'buffer';
import sizeOf from 'image-size';

/**
 * Options for customizing the PDF generation
 */
interface PDFOptions {
  /** Font to be used in the document */
  font?: string;
  /** Font size for paragraphs */
  fontSize?: number;
  /** Font size for company name in header */
  headerFontSize?: number;
  /** Font size for footer text */
  footerFontSize?: number;
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
  /** Maximum logo width in points */
  maxLogoWidth?: number;
  /** Maximum logo height in points */
  maxLogoHeight?: number;
  /** Space between header and content in points */
  headerBottomMargin?: number;
  /** Top offset for header position (smaller value places header higher) */
  headerTopOffset?: number;
  /** Date format for footer (defaults to 'MMMM DD, YYYY') */
  dateFormat?: string;
  /** Font size for signature */
  signatureFontSize?: number;
  /** Font size for designation */
  designationFontSize?: number;
  /** Space between signature and designation */
  signatureSpacing?: number;
}

/**
 * Result of logo processing with dimensions
 */
interface LogoResult {
  /** Image data buffer */
  imageData: Buffer;
  /** Original width of the logo */
  width: number;
  /** Original height of the logo */
  height: number;
}

/**
 * Signature information to be added to the PDF
 */
interface SignatureInfo {
  /** Name of the person signing */
  name: string;
  /** Designation or title of the person */
  designation: string;
}

/**
 * Creates a PDF document with header, footer, paragraphs, and signature
 * @param logoUrl URL of the logo image (can be a public S3 URL)
 * @param companyName Name of the company to display in the header
 * @param paragraphs Array of strings, each representing a paragraph
 * @param signatureInfo Optional signature and designation information
 * @param options Configuration options for the PDF
 * @returns Buffer containing the PDF data
 */
export const createCompleteDocumentPDF = async (
  logoUrl: string,
  companyName: string,
  paragraphs: string[],
  signatureInfo?: SignatureInfo,
  options: PDFOptions = {}
): Promise<Buffer> => {
  // Set default options
  const {
    font = 'Helvetica',
    fontSize = 12,
    headerFontSize = 18,
    footerFontSize = 10,
    marginLeft = 72, // 1 inch
    marginRight = 72, // 1 inch
    marginTop = 72, // 1 inch
    marginBottom = 72, // 1 inch
    lineHeight = 1.5,
    outputPath,
    maxLogoWidth = 150,
    maxLogoHeight = 50,
    headerBottomMargin = 30,
    headerTopOffset = 20,
    dateFormat = 'MMMM DD, YYYY',
    signatureFontSize = 12,
    designationFontSize = 10,
    signatureSpacing = 8
  } = options;

  // Calculate the content width
  const pageWidth = 612; // Default letter size width in points
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Fetch and process logo
  let logoResult: LogoResult;
  try {
    logoResult = await fetchLogo(logoUrl);
  } catch (error) {
    throw new Error(`Failed to fetch logo: ${error instanceof Error ? error.message : String(error)}`);
  }

  return new Promise((resolve, reject) => {
    try {
      // Create a document
      const doc = new PDFDocument({
        margins: {
          top: marginTop,
          bottom: marginBottom,
          left: marginLeft,
          right: marginRight
        },
        autoFirstPage: true
      });

      // Buffer to collect PDF data
      const chunks: Buffer[] = [];
      
      // Handle document data chunks
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // Handle document end
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      // Handle errors during PDF generation
      doc.on('error', (err) => {
        reject(err);
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

      // Add page numbers and date to each page
      setupFooter(doc, footerFontSize, dateFormat);

      // Position the header at the specified top offset
      const headerY = doc.page.margins.top - marginTop + headerTopOffset;

      // Add header with logo and company name at the adjusted position
      addHeaderWithLogo(doc, logoResult, companyName, {
        contentWidth,
        maxLogoWidth,
        maxLogoHeight,
        headerFontSize,
        font,
        y: headerY
      });

      // Reset cursor position to top margin plus header height plus spacing
      const logoHeight = Math.min(logoResult.height, maxLogoHeight);
      const effectiveHeaderHeight = Math.max(logoHeight, headerFontSize);
      doc.y = headerY + effectiveHeaderHeight + headerBottomMargin;

      // Set font for body content
      doc.font(font)
         .fontSize(fontSize);

      // Add paragraphs with left alignment
      paragraphs.forEach((paragraph) => {
        if (paragraph && paragraph.trim()) {
          doc.text(paragraph, {
            width: contentWidth,
            align: 'left',
            indent: 0,
            lineGap: (fontSize * lineHeight) - fontSize
          });
          
          // Add space between paragraphs
          doc.moveDown();
        }
      });

      // Add signature and designation if provided
      if (signatureInfo) {
        doc.moveDown(3); // Space before signature
        
        // Add signature
        doc.font(`${font}-Bold`)
          .fontSize(signatureFontSize)
          .text(signatureInfo.name, {
            width: contentWidth,
            align: 'right'
          });
        
        // Add designation
        doc.font(font)
          .fontSize(designationFontSize)
          .moveDown(signatureSpacing / designationFontSize)
          .text(signatureInfo.designation, {
            width: contentWidth,
            align: 'right'
          });
      }

      // Finalize the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Fetches a logo from a URL and returns it with its dimensions
 * @param logoUrl URL of the logo to fetch
 * @returns Promise resolving to logo data and dimensions
 */
async function fetchLogo(logoUrl: string): Promise<LogoResult> {
  try {
    const response = await axios.get(logoUrl, {
      responseType: 'arraybuffer'
    });
    
    const imageData = Buffer.from(response.data);
    
    // Use image-size library to get dimensions
    try {
      const dimensions = sizeOf(imageData);
      if (dimensions.width && dimensions.height) {
        return { 
          imageData,
          width: dimensions.width,
          height: dimensions.height 
        };
      }
    } catch (sizeError) {
      console.warn('Could not determine image size, using fallback dimensions');
    }
    
    // Fallback dimensions
    return { 
      imageData,
      width: 100,
      height: 50 
    };
  } catch (error) {
    throw new Error(`Error fetching logo: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Adds a header with logo and company name to the document
 */
function addHeaderWithLogo(
  doc: PDFKit.PDFDocument,
  logoResult: LogoResult,
  companyName: string,
  options: {
    contentWidth: number;
    maxLogoWidth: number;
    maxLogoHeight: number;
    headerFontSize: number;
    font: string;
    y: number;
  }
): void {
  const { imageData, width: originalWidth, height: originalHeight } = logoResult;
  const { contentWidth, maxLogoWidth, maxLogoHeight, headerFontSize, font, y } = options;

  // Scale logo to fit within maximum dimensions while preserving aspect ratio
  let logoWidth = originalWidth;
  let logoHeight = originalHeight;
  
  if (logoWidth > maxLogoWidth) {
    const scaleFactor = maxLogoWidth / logoWidth;
    logoWidth = maxLogoWidth;
    logoHeight = originalHeight * scaleFactor;
  }
  
  if (logoHeight > maxLogoHeight) {
    const scaleFactor = maxLogoHeight / logoHeight;
    logoHeight = maxLogoHeight;
    logoWidth = logoWidth * scaleFactor;
  }

  // Add logo on the left at the specified y position
  doc.image(imageData, doc.page.margins.left, y, {
    width: logoWidth,
    height: logoHeight
  });

  // Add company name on the right, vertically aligned with the logo
  doc.font(`${font}-Bold`)
     .fontSize(headerFontSize)
     .text(companyName, 
           doc.page.margins.left + logoWidth + 10, 
           y + (logoHeight / 2) - (headerFontSize / 2), 
           {
             width: contentWidth - logoWidth - 10,
             align: 'right'
           });
}

/**
 * Sets up footer with page number and date on each page
 */
function setupFooter(
  doc: PDFKit.PDFDocument, 
  footerFontSize: number,
  dateFormat: string
): void {
  // Format the current date
  const currentDate = formatDate(new Date(), dateFormat);
  
  // Add page numbers and date to each page
  const pageCount = { count: 0 };
  
  doc.on('pageAdded', () => {
    pageCount.count++;
    addFooter(doc, currentDate, pageCount.count, footerFontSize);
  });
  
  // Initialize the first page
  pageCount.count = 1;
  addFooter(doc, currentDate, pageCount.count, footerFontSize);
}

/**
 * Adds a footer with date and page number to the current page
 */
function addFooter(
  doc: PDFKit.PDFDocument, 
  dateText: string, 
  pageNumber: number,
  footerFontSize: number
): void {
  const originalY = doc.y; // Save current position
  
  // Calculate footer position
  const footerY = doc.page.height - doc.page.margins.bottom + 20;
  
  // Add date on the left
  doc.fontSize(footerFontSize)
     .text(
       dateText,
       doc.page.margins.left,
       footerY,
       { align: 'left' }
     );
  
  // Add page number on the right
  doc.fontSize(footerFontSize)
     .text(
       `Page ${pageNumber}`,
       doc.page.width - doc.page.margins.right,
       footerY,
       { align: 'right' }
     );
  
  doc.y = originalY; // Restore position
}

/**
 * Formats a date according to the specified format
 * Simple implementation for common date format without external dependencies
 */
function formatDate(date: Date, format: string): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  let result = format;
  
  // Replace month name
  result = result.replace('MMMM', month);
  
  // Replace day with leading zero if needed
  result = result.replace('DD', day < 10 ? `0${day}` : `${day}`);
  
  // Replace day without leading zero
  result = result.replace('D', `${day}`);
  
  // Replace year
  result = result.replace('YYYY', `${year}`);
  
  return result;
}