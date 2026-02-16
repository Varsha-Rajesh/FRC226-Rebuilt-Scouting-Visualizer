const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();

const uploadDir = path.join(os.tmpdir(), 'uploads');
const tempDir = path.join(os.tmpdir(), 'temp');

[uploadDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

async function deleteIfExists(filename) {
  const filePath = path.join(uploadDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted existing file: ${filename}`);
    }
  } catch (err) {
    console.error(`Error deleting file ${filename}:`, err);
    throw err;
  }
}

const upload = multer({
  dest: tempDir,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.post('/uploads', upload.single('dataFile'), async (req, res) => {
  console.log('Upload request received');

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadType = req.body.uploadType;
  let targetFilename;

  if (uploadType === 'csvData') {
    targetFilename = 'data.csv';
  } else if (uploadType === 'csvPitScouting') {
    targetFilename = 'pit_scouting.csv';
  } else if (uploadType === 'csvSchedule') {
    targetFilename = 'schedule.csv';
  } else {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid upload type' });
  }

  try {
    await deleteIfExists(targetFilename);

    const newPath = path.join(uploadDir, targetFilename);
    fs.copyFileSync(req.file.path, newPath);
    fs.unlinkSync(req.file.path);

    console.log(`Saved new file as ${targetFilename}`);
    return res.status(200).json({
      message: 'File uploaded successfully',
      filename: targetFilename,
      size: req.file.size
    });

  } catch (error) {
    console.error('Upload failed:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete endpoint
app.delete('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${filename}`);
      return res.status(200).json({ message: 'File deleted successfully' });
    } else {
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error(`Error deleting file ${filename}:`, err);
    return res.status(500).json({ error: 'Error deleting file' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;