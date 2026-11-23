const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mediaDir = path.join(__dirname, '..', '..', 'media');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

const storage = multer.diskStorage({
  destination: mediaDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// POST /api/media
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  res.json({
    url: `/media/${req.file.filename}`,
    filename: req.file.originalname,
    size: req.file.size,
    content_type: req.file.mimetype,
  });
});

module.exports = router;
