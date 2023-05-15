const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path'); 
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/upload', upload.single('file'), async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const originalFilename = req.file.originalname;

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.mp3', '.wav', '.mp4', '.mov', '.zip', '.tar', '.gz'];
  const originalExtension = path.extname(originalFilename);

  if (!allowedExtensions.includes(originalExtension)) {
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error(err);
      }
    });
    return res.status(400).json({ error: 'Invalid file type' });
  }

  const newFilename = `${req.file.filename}${originalExtension}`;
  const oldPath = path.join(__dirname, 'uploads', req.file.filename);
  const newPath = path.join(__dirname, 'uploads', newFilename);

  try {
    await fs.promises.rename(oldPath, newPath);
    res.status(201).json({
      message: 'File uploaded successfully!',
      filename: newFilename,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload the file' });
  }
});

app.get('/uploads', async (req, res) => {
  try {
    const files = await fs.promises.readdir('uploads/');
    res.json({ files });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error reading files' });
  };
});

app.get('/uploads/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  try {
    const fileExists = await fs.promises.access(filePath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const contentType = getContentType(filename);
    res.contentType(contentType);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve the file' });
  }
});


function getContentType(filename) {
  const ext = path.extname(filename);
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.doc':
    case '.docx':
      return 'application/msword';
    case '.xls':
    case '.xlsx':
      return 'application/vnd.ms-excel';
    case '.ppt':
    case '.pptx':
      return 'application/vnd.ms-powerpoint';
    case '.txt':
      return 'text/plain';
    case '.csv':
      return 'text/csv';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.zip':
      return 'application/zip';
    case '.tar':
      return 'application/x-tar';
    case '.gz':
      return 'application/gzip';
    default:
      return 'application/octet-stream';
  }
}

app.delete('/delete/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  try {
    const fileExists = await fs.promises.access(filePath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    await fs.promises.unlink(filePath);
    res.json({ message: `File "${filename}" deleted successfully!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete the file' });
  };
});

app.put('/rename/:filename', async (req, res) => {
  const oldFilename = req.params.filename;
  const newFilename = req.body.newFilename;

  if (!newFilename) {
    return res.status(400).json({ error: 'New filename is required' });
  }

  const oldFilePath = path.join(__dirname, 'uploads', oldFilename);
  const newFilePath = path.join(__dirname, 'uploads', newFilename);

  try {
    const fileExists = await fs.promises.access(oldFilePath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    await fs.promises.rename(oldFilePath, newFilePath);
    res.json({ message: `File "${oldFilename}" renamed to "${newFilename}" successfully!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rename the file' });
  };
});


const port = 3000; 
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
