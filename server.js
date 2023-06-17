require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path'); 
const app = express();
const upload = multer({ dest: 'uploads/' });
const bcrypt = require('bcryptjs');
const passport = require('./passport');
const dbModule = require('./db');
const db = dbModule.db
const jwt = require('jsonwebtoken');
const queries = require('./queries');
const cors = require('cors');
const router = express.Router();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  return regex.test(email);
}

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUserByUsername = await db.oneOrNone(queries.checkIfUsernameExists, [username]);
    const existingUserByEmail = await db.oneOrNone(queries.checkIfEmailExists, [email]);

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password should be at least 8 characters long' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.none('INSERT INTO webtech.userDB (username, email, password) VALUES ($1, $2, $3)', [username, email, hashedPassword]);

    res.json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register user', message: err.message });
  }
});

app.post('/login', passport.authenticate('local', { session: false }), (req, res) => {
  const user = req.user;
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {expiresIn: '1h'});
  res.json({ token });
});

app.post('/api/upload', passport.authenticate('jwt', { session: false }), upload.single('file'), async (req, res) => {
  console.log(req.user);
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const originalFilename = req.file.originalname;

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.mp3', '.wav', '.mp4', '.mov', '.zip', '.tar', '.gz'];
  const originalExtension = path.extname(originalFilename);

  if (!allowedExtensions.includes(originalExtension)) {
    await fs.promises.unlink(req.file.path);
    return res.status(400).json({ error: 'Invalid file type' });
  }

  const newFilename = `${req.file.filename}${originalExtension}`;
  const oldPath = path.join(__dirname, 'uploads', req.file.filename);
  const newPath = path.join(__dirname, 'uploads', newFilename);

  try {
    await fs.promises.rename(oldPath, newPath);
    const metadata = {
      userId: req.user.id,
      filename: newFilename,
      originalName: originalFilename,
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      mimeType: req.file.mimetype,
      path: newPath
    };

    await db.none('INSERT INTO webtech.files (userId, filename, originalName, size, uploadDate, mimeType, path) VALUES ($1, $2, $3, $4, $5, $6, $7)', [metadata.userId, metadata.filename, metadata.originalName, metadata.size, metadata.uploadDate, metadata.mimeType, metadata.path]);
    res.status(201).json({
      message: 'File uploaded successfully!',
      filename: newFilename,
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to upload the file' });
  }
});

app.get('/api/uploads', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const files = await db.any('SELECT * FROM webtech.files WHERE userId = $1', [req.user.id]);
    res.json({ files });
  } catch (error) {
    res.status(400).json({ message: 'Error reading files' });
  };
});

app.get('/api/uploads/:filename', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  const fileMetadata = await db.oneOrNone('SELECT * FROM webtech.files WHERE filename = $1', [filename]);

  if (!fileMetadata) {
    return res.status(404).json({ error: 'File not found in metadata' });
  }

  if (fileMetadata.userid !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    const contentType = getContentType(filename);
    res.contentType(contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.delete('/api/delete',passport.authenticate('jwt', { session: false }), async (req, res) => {
  const filename = req.body.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  const fileMetadata = await db.oneOrNone('SELECT * FROM webtech.files WHERE filename = $1', [filename]);

  if (!fileMetadata) {
    return res.status(404).json({ error: 'File not found in metadata' });
  }

  if (fileMetadata.userid !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    await fs.promises.unlink(filePath);
    await db.none('DELETE FROM webtech.files WHERE filename = $1', [filename]);
    res.json({ message: `File "${filename}" deleted successfully!` });
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  };
});

app.put('/api/rename',passport.authenticate('jwt', { session: false }), async (req, res) => {
  const oldFilename = req.body.oldFilename;
  const newFilename = req.body.newFilename;

  const fileMetadata = await db.oneOrNone('SELECT * FROM webtech.files WHERE filename = $1', [oldFilename]);

  if (!fileMetadata) {
    return res.status(404).json({ error: 'File not found in metadata' });
  }

  if (fileMetadata.userid !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!newFilename) {
    return res.status(400).json({ error: 'New filename is required' });
  }

  const oldFilePath = path.join(__dirname, 'uploads', oldFilename);
  const newFilePath = path.join(__dirname, 'uploads', newFilename);

  try {
    await fs.promises.access(oldFilePath, fs.constants.F_OK)
    await fs.promises.rename(oldFilePath, newFilePath);
    await db.none('UPDATE webtech.files SET filename = $1 WHERE filename = $2', [newFilename, oldFilename]);
    res.json({ message: `File "${oldFilename}" renamed to "${newFilename}" successfully!` });
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  };
});

app.get('/api/download/:filename', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const filename = req.params.filename;
  const fileMetadata = await db.oneOrNone('SELECT * FROM webtech.files WHERE filename = $1', [filename]);

  if (!fileMetadata) {
      return res.status(404).json({ error: 'File not found in metadata' });
  }

  if (fileMetadata.userid !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
  }

  const filePath = path.join(__dirname, 'uploads', filename);
  res.download(filePath, fileMetadata.originalName, function(err){
      if (err) {
          console.log(err);
          res.status(500).json({ error: 'Download failed' });
      }
  });
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

const port = 3000; 
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
// require('dotenv').config();
// const express = require('express');
// const multer = require('multer');
// const fs = require('fs');
// const path = require('path'); 
// const app = express();
// const upload = multer({ dest: 'uploads/' });
// const bcrypt = require('bcryptjs');
// const passport = require('./passport');
// const dbModule = require('./db');
// const db = dbModule.db
// const jwt = require('jsonwebtoken');
// const queries = require('./queries');
// const cors = require('cors');
// const router = express.Router();

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(passport.initialize());

// function isValidEmail(email) {
//   const regex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
//   return regex.test(email);
// }

// app.post('/register', async (req, res) => {
//   const { username, email, password } = req.body;

//   try {
//     const existingUserByUsername = await db.oneOrNone(queries.checkIfUsernameExists, [username]);
//     const existingUserByEmail = await db.oneOrNone(queries.checkIfEmailExists, [email]);

//     if (!isValidEmail(email)) {
//       return res.status(400).json({ error: 'Invalid email' });
//     }

//     if (existingUserByUsername) {
//       return res.status(400).json({ error: 'Username already exists' });
//     }

//     if (existingUserByEmail) {
//       return res.status(400).json({ error: 'Email already exists' });
//     }

//     if (password.length < 8) {
//       return res.status(400).json({ error: 'Password should be at least 8 characters long' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     await db.none('INSERT INTO webtech.userDB (username, email, password) VALUES ($1, $2, $3)', [username, email, hashedPassword]);

//     res.json({ message: 'User registered successfully!' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to register user', message: err.message });
//   }
// });

// app.post('/login', passport.authenticate('local', { session: false }), (req, res) => {
//   const user = req.user;
//   const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {expiresIn: '1h'});
//   res.json({ token });
// });

// app.post('/api/upload', passport.authenticate('jwt', { session: false }), upload.single('file'), async (req, res) => {
//   console.log(req.user);
//   if (!req.file) {
//     return res.status(400).json({ error: 'No file provided' });
//   }

//   const originalFilename = req.file.originalname;

//   const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.mp3', '.wav', '.mp4', '.mov', '.zip', '.tar', '.gz'];
//   const originalExtension = path.extname(originalFilename);

//   if (!allowedExtensions.includes(originalExtension)) {
//     await fs.promises.unlink(req.file.path);
//     return res.status(400).json({ error: 'Invalid file type' });
//   }

//   const newFilename = `${req.file.filename}${originalExtension}`;
//   const oldPath = path.join(__dirname, 'uploads', req.file.filename);
//   const newPath = path.join(__dirname, 'uploads', newFilename);

//   try {
//     await fs.promises.rename(oldPath, newPath);
//     const metadata = {
//       userId: req.user.id,
//       filename: newFilename,
//       originalName: originalFilename,
//       size: req.file.size,
//       uploadDate: new Date().toISOString(),
//       mimeType: req.file.mimetype,
//       path: newPath,
//       parentFolderId: req.body.parentFolderId
//     };

//     await db.none('INSERT INTO webtech.files (userId, filename, originalName, size, uploadDate, mimeType, path, parentFolderId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [metadata.userId, metadata.filename, metadata.originalName, metadata.size, metadata.uploadDate, metadata.mimeType, metadata.path, metadata.parentFolderId]);
//     res.status(201).json({
//       message: 'File uploaded successfully!',
//       filename: newFilename,
//     });
//   } catch (error) {
//     res.status(400).json({ error: 'Failed to upload the file' });
//   }
// });

// app.get('/api/uploads', passport.authenticate('jwt', { session: false }), async (req, res) => {
//   try {
//     const files = await db.any('SELECT * FROM webtech.files WHERE userId = $1 AND parentFolderId = $2', [req.user.id, req.query.parentFolderId]);
//     res.json({ files });
//   } catch (error) {
//     res.status(400).json({ message: 'Error reading files' });
//   };
// });

// app.get('/api/uploads/:filename', passport.authenticate('jwt', { session: false }), async (req, res) => {
//   const filename = req.params.filename;
//   const filePath = path.join(__dirname, 'uploads', filename);
//   const fileMetadata = await db.oneOrNone('SELECT * FROM webtech.files WHERE filename = $1', [filename]);

//   if (!fileMetadata) {
//     return res.status(404).json({ error: 'File not found in metadata' });
//   }

//   if (fileMetadata.userid !== req.user.id) {
//     return res.status(403).json({ error: 'Access denied' });
//   }

//   try {
//     await fs.promises.access(filePath, fs.constants.F_OK)
//     const contentType = getContentType(filename);
//     res.contentType(contentType);
//     res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//     const fileStream = fs.createReadStream(filePath);
//     fileStream.pipe(res);
//   } catch (error) {
//     res.status(404).json({ error: 'File not found' });
//   }
// });

// app.delete('/api/delete',passport.authenticate('jwt', { session: false }), async (req, res) => {
//   const filename = req.body.filename;
//   const filePath = path.join(__dirname, 'uploads', filename);
//   const fileMetadata = await db.oneOrNone('SELECT * FROM webtech.files WHERE filename = $1', [filename]);

//   if (!fileMetadata) {
//     return res.status(404).json({ error: 'File not found in metadata' });
//   }

//   if (fileMetadata.userid !== req.user.id) {
//     return res.status(403).json({ error: 'Access denied' });
//   }

//   try {
//     await fs.promises.access(filePath, fs.constants.F_OK)
//     await fs.promises.unlink(filePath);
//     await db.none('DELETE FROM webtech.files WHERE filename = $1', [filename]);
//     res.json({ message: `File "${filename}" deleted successfully!` });
//   } catch (error) {
//     res.status(404).json({ error: 'File not found' });
//   }
// });

// app.post('/api/folder', passport.authenticate('jwt', { session: false }), async (req, res) => {
//   const { name, parentFolderId } = req.body;

//   try {
//     await db.none('INSERT INTO webtech.folderDB (name, parentFolderId, userId) VALUES ($1, $2, $3)', [name, parentFolderId, req.user.id]);
//     res.json({ message: 'Folder created successfully!' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to create folder', message: err.message });
//   }
// });

// app.get('/api/folder', passport.authenticate('jwt', { session: false }), async (req, res) => {
//   try {
//     const folders = await db.any('SELECT * FROM webtech.folderDB WHERE userId = $1 AND parentFolderId = $2', [req.user.id, req.query.parentFolderId]);
//     res.json({ folders });
//   } catch (error) {
//     res.status(400).json({ message: 'Error reading folders' });
//   };
// });

// app.listen(process.env.PORT || 3000, () => {
//   console.log(`Server is running on port ${process.env.PORT || 3000}`);
// });
