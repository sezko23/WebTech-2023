const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path'); 
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/upload', upload.single('file'), (req, res) => {
  const originalFilename = req.file.originalname;
  const originalExtension = path.extname(originalFilename);

  const newFilename = `${req.file.filename}${originalExtension}`;
  const oldPath = path.join(__dirname, 'uploads', req.file.filename);
  const newPath = path.join(__dirname, 'uploads', newFilename);
  fs.renameSync(oldPath, newPath);

  res.json({
    message: 'File uploaded successfully!',
    filename: newFilename,
  });
});

app.get('/uploads', (req, res) => {
    fs.readdir('uploads/', (err, files) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error reading files' });
      } else {
        res.json({ files });
      }
    });
  });

app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  const contentType = getContentType(filename);
  res.contentType(contentType);

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
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

app.delete('/delete/:filename', (req, res) => {
  const filename = req.params.filename;

  fs.unlink(`uploads/${filename}`, (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete the file.' });
    } else {
      res.json({ message: `File "${filename}" deleted successfully!` });
    }
  });
});

app.put('/rename/:filename', (req, res) => {
  const oldFilename = req.params.filename;
  const newFilename = req.body.newFilename;

  fs.rename(`uploads/${oldFilename}`, `uploads/${newFilename}`, (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to rename the file.' });
    } else {
      res.json({ message: `File "${oldFilename}" renamed to "${newFilename}" successfully!` });
    }
  });
});

const port = 3000; 
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
