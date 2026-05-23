const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const config = require('../config/db.config');
const verifyToken = require('../middleware/auth');
const isAdmin = require('../middleware/role');

const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// --- ENHANCED STORAGE ENGINE DEFINITION ---
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// 1. Fetch & Filter Documents 
router.get('/document', (req, res) => {
    const { folderId, search } = req.query; 
    
    // NEW CODE 'd.description' included in SELECT===========
    let sql = `SELECT d.id, d.name AS title, d.description, d.timestamp AS upload_date, 
                      'General' AS category, f.folder_name, u.username AS uploader_name 
               FROM document d 
               LEFT JOIN folder f ON d.folder_id = f.folder_id 
               LEFT JOIN user u ON d.uploaded_by = u.id 
               WHERE 1=1`;
    // ==========================================
    
    let params = [];

    if (folderId && folderId !== 'null' && folderId !== '') {
        sql += " AND d.folder_id = ?";
        params.push(folderId);
    }
    if (search) {
        sql += " AND d.name LIKE ?";
        params.push(`%${search}%`);
    }
    sql += " ORDER BY d.timestamp DESC";

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. Secure Upload Document ========================
router.post('/upload', upload.single('file'), verifyToken, (req, res) => {
    const { title, folder_id, uploaded_by } = req.body;
    const targetFolder = (folder_id && folder_id !== 'null' && folder_id !== '') ? folder_id : null;
    const fileNameString = req.file ? req.file.filename : title;

    //NEW CODE FOR DOCU DESCRIPTION (TIMESTAMP)
    const currentTime = new Date().toLocaleString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true,
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
    const dynamicDescription = `Uploaded on ${currentTime}`;
    //==================================================


    // NEW CODE Changed static string query parameter to dynamic variable (?)========
    const sql = "INSERT INTO document (name, description, uploaded_by, folder_id) VALUES (?, ?, ?, ?)";
    db.query(sql, [fileNameString, dynamicDescription, uploaded_by || req.user.id, targetFolder], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
    // ==========================================
});


// 3. Update Metadata (ADMIN ONLY) 
router.put('/document/:id', [verifyToken, isAdmin], (req, res) => {
    const docId = req.params.id;
    const { title, folder_id } = req.body;
    const targetFolder = (folder_id === 'null' || !folder_id) ? null : folder_id;

    const sql = "UPDATE document SET name = ?, folder_id = ? WHERE id = ?";
    db.query(sql, [title, targetFolder, docId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Metadata updated successfully" });
    });
});

router.delete('/document/:id', [verifyToken, isAdmin], (req, res) => {
    executeDeletion(req, res);
});

router.delete('/documents/:id', (req, res) => {
    executeDeletion(req, res);
});

function executeDeletion(req, res) {
    const docId = req.params.id;
    
    // Aligned: Safely query the document row by ID using your real schema columns
    db.query("SELECT name FROM document WHERE id = ?", [docId], (err, records) => {
        if (err) return res.status(500).json({ error: err.message });
        if (records.length === 0) return res.status(404).json({ error: "Document asset not found" });

        const filename = records[0].name;
        const filepath = path.join(uploadDir, filename);

        // Safely clear out the actual asset file from local disk space storage
        if (filename && fs.existsSync(filepath)) {
            try {
                fs.unlinkSync(filepath);
            } catch (fsErr) {
                console.error("Physical disk cleanup note:", fsErr.message);
            }
        }

        // Wipe out the relational table row row directly from the database schema
        db.query("DELETE FROM document WHERE id = ?", [docId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Asset purged cleanly" });
        });
    });
}


// 5. Secure Asset Download Pipeline 
router.get('/document/download/:id', verifyToken, (req, res) => {
    const docId = req.params.id;

    db.query("SELECT name FROM document WHERE id = ?", [docId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "File reference not found" });

        const filename = results[0].name;
        res.download(path.join(uploadDir, filename), filename);
    });
});

module.exports = router;