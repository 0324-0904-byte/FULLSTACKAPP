const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');

router.get('/folders', folderController.getFolders);
router.post('/folders', folderController.createFolder);
router.put('/folders/:id', folderController.renameFolder);
router.delete('/folders/:id', folderController.deleteFolder);

module.exports = router;