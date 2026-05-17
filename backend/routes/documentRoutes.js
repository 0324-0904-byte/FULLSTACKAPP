const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentController = require('../controllers/documentController');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

router.get('/documents', documentController.getDocuments);
router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.put('/documents/:id', documentController.updateDocument);
router.delete('/documents/:id', documentController.deleteDocument);
router.get('/documents/download/:id', documentController.downloadDocument);

// Adding permission and log assignments straight to documents path maps
router.post('/permissions', documentController.updatePermissions);
router.get('/logs', documentController.getLogs);

module.exports = router;