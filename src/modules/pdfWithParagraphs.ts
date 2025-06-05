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
 * Creates a PDF document with a header (logo + company name) and left-aligned paragraphs
 * @param logoUrl URL of the logo image (can be a public S3 URL)
 * @param companyName Name of the company to display in the header
 * @param paragraphs Array of strings, each representing a paragraph
 * @param options Configuration options for the PDF
 * @returns Buffer containing the PDF data
 */
export const createHeaderedParagraphsPDF = async (
  logoUrl: string,
  companyName: string,
  paragraphs: string[],
  options: PDFOptions = {}
): Promise<Buffer> => {
  // Set default options
  const {
    font = 'Helvetica',
    fontSize = 12,
    headerFontSize = 18,
    marginLeft = 72, // 1 inch
    marginRight = 72, // 1 inch
    marginTop = 72, // 1 inch
    marginBottom = 72, // 1 inch
    lineHeight = 1.5,
    outputPath,
    maxLogoWidth = 150,
    maxLogoHeight = 50,
    headerBottomMargin = 30
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
        }
      });

      // Buffer to collect PDF data
      const chunks: Buffer[] = [];
      let result: Buffer;

      // Handle document data chunks
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // Handle document end
      doc.on('end', () => {
        result = Buffer.concat(chunks);
        resolve(result);
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

      // Add header with logo and company name
      addHeaderWithLogo(doc, logoResult, companyName, {
        contentWidth,
        maxLogoWidth,
        maxLogoHeight,
        headerFontSize,
        font
      });

      // Add spacing after header
      doc.moveDown(headerBottomMargin / fontSize);

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
            lineGap: (fontSize * lineHeight) - fontSize // Set line spacing
          });
          
          // Add space between paragraphs
          doc.moveDown();
        }
      });

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
    // Fetch image data from URL
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
      console.warn('Could not determine image size, using fallback dimensions:', sizeError);
    }
    
    // Fallback dimensions if we couldn't determine them
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
  }
) {
  const { imageData, width: originalWidth, height: originalHeight } = logoResult;
  const { contentWidth, maxLogoWidth, maxLogoHeight, headerFontSize, font } = options;

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

  // Save current position
  const { y: startY } = doc;
  
  // Add logo on the left
  doc.image(imageData, doc.page.margins.left, startY, {
    width: logoWidth,
    height: logoHeight
  });

  // Add company name on the right
  doc.font(`${font}-Bold`)
     .fontSize(headerFontSize)
     .text(companyName, 
           doc.page.margins.left + logoWidth + 10, 
           startY + (logoHeight / 2) - (headerFontSize / 2), 
           {
             width: contentWidth - logoWidth - 10,
             align: 'right'
           });

  // Move document position below the header (below logo or text, whichever is taller)
  const textHeight = headerFontSize;
  const newY = Math.max(startY + logoHeight, startY + textHeight);
  doc.y = newY;
}

/**
 * Creates and saves a PDF document with a header and paragraphs to a file
 * @param logoUrl URL of the logo image
 * @param companyName Name of the company to display in the header
 * @param paragraphs Array of strings, each representing a paragraph
 * @param outputPath Path where the PDF file should be saved
 * @param options Configuration options for the PDF
 * @returns Promise resolving to the file path where PDF was saved
 */
export const createAndSaveHeaderedParagraphsPDF = async (
  logoUrl: string,
  companyName: string,
  paragraphs: string[],
  outputPath: string,
  options: Omit<PDFOptions, 'outputPath'> = {}
): Promise<string> => {
  try {
    await createHeaderedParagraphsPDF(logoUrl, companyName, paragraphs, { ...options, outputPath });
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to create and save PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};