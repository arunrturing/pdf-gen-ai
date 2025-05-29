import { createBasePDF } from '@modules';
import fs from 'fs';
import path from 'path';

 async function savePDFToFile(
  pdfBuffer: Buffer, 
  filename?: string
): Promise<string> {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.resolve('./output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename with timestamp if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `document-${timestamp}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);
    
    // Write buffer to file
    await fs.promises.writeFile(outputPath, pdfBuffer);
    console.log(`PDF saved to: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('Error saving PDF to file:', error);
    throw error;
  }
}

describe('PDF Generator', () => {
    test('should generate PDF with company name only', async () => {
        const companyName = "Test Company Ltd";
        const logoUrl = "";
        
        const pdfBuffer = await createBasePDF(logoUrl, companyName);
        
        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer.length).toBeGreaterThan(0);
        expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    });

    test('should generate PDF with company name and logo URL', async () => {
        const companyName = "NOMS Pvt Ltd";
        const logoUrl = "https://multi-tenant-dev.n-oms.in/assets/logo-hd2-BZqe1saO.png";
        
        const pdfBuffer = await createBasePDF(logoUrl, companyName);
        
        expect(pdfBuffer).toBeDefined();
        //expect(pdfBuffer.length).toBeGreaterThan(70000);
        expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
        const pdfPath = await savePDFToFile(pdfBuffer, "new-company.pdf");
        console.log(`PDF saved successfully at: ${pdfPath}`);
    });
});