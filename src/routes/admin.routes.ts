import { Router, Request, Response } from 'express';
import multer from 'multer';
import { processConstitutionPDF } from '../utils/pdf-processor.js';
import path from 'path';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('pdf'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const filePath = req.file.path;
    const result = await processConstitutionPDF(filePath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: 'PDF processed successfully. Note: Automatic article parsing logic should be refined for production.',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
