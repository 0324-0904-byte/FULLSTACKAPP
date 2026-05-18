const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const config = require('../config/db.config');
const verifyToken = require('../middleware/auth');

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


// Fetch & Filter Documents (Protected)
router.get('/', verifyToken, (req, res) => {
    const { folder_id, search } = req.query;
    
    let sql = `SELECT d.*, f.folder_name, u.username AS uploader_name 
               FROM document d 
               LEFT JOIN folder f ON d.folder_id = f.id 
               LEFT JOIN user u ON d.uploaded_by = u.id 
               WHERE 1=1`;
    let params = [];

    if (folder_id && folder_id !== 'null' && folder_id !== '') {
        sql += " AND d.folder_id = ?";
        params.push(folder_id);
    }
    if (search) {
        sql += " AND (d.title LIKE ? OR d.category LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += " ORDER BY d.upload_date DESC";

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});


// Secure Upload Document (Protected)
router.post('/upload', verifyToken, upload.single('file'), (req, res) => {
    const { title, category, folder_id } = req.body;
    const userId = req.user.id; // SECURE FIXED: Sourced straight from token!
    const targetFolder = (folder_id && folder_id !== 'null' && folder_id !== '') ? folder_id : null;
    const filePath = req.file ? req.file.filename : '';

    if (!filePath) {
        return res.status(400).json({ success: false, message: "No file binary transmitted." });
    }

    const sql = "INSERT INTO document (title, file_path, folder_id, uploaded_by, category) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [title, filePath, targetFolder, userId, category || 'General'], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", [userId, `Uploaded Document: ${title}`]);
        res.json({ success: true });
    });
});


// Update Metadata (Protected)
router.put('/:id', verifyToken, (req, res) => {
    const docId = req.params.id;
    const { title, category, folder_id } = req.body;
    const userId = req.user.id; 
    const targetFolder = (folder_id === 'null' || !folder_id) ? null : folder_id;

    // FIX: Target singular table 'document'
    const sql = "UPDATE document SET title = ?, category = ?, folder_id = ? WHERE id = ?";
    db.query(sql, [title, category, targetFolder, docId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", [userId, `Modified document metadata ID ${docId}`]);
        res.json({ success: true });
    });
});


// 4Purge Document Record & Binary Asset (Protected)
router.delete('/:id', verifyToken, (req, res) => {
    const docId = req.params.id;
    const userId = req.user.id;

    // Fetch details first to clear disk storage space
    db.query("SELECT file_path, title FROM document WHERE id = ?", [docId], (err, records) => {
        if (err) return res.status(500).json({ error: err.message });
        if (records.length === 0) return res.status(404).json({ error: "Document asset not found" });

        const filename = records[0].file_path;
        const filepath = path.join(uploadDir, filename);

        // Safely unlink physical file from disk space
        if (filename && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }

        // Delete from relational rows
        db.query("DELETE FROM document WHERE id = ?", [docId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", [userId, `Deleted Document: ${records[0].title}`]);
            res.json({ success: true });
        });
    });
});


// Secure Asset Download Pipeline (Protected)
router.get('/download/:id', verifyToken, (req, res) => {
    const docId = req.params.id;
    const userId = req.user.id;

    db.query("SELECT file_path, title FROM document WHERE id = ?", [docId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "File reference not found" });

        db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", [userId, `Downloaded Document: ${results[0].title}`]);
        res.download(path.join(uploadDir, results[0].file_path), results[0].title);
    });
});


// Folder Access Permissions Matrix (Protected)
router.post('/permissions', verifyToken, (req, res) => {
    const { folder_id, user_id, can_view, can_upload } = req.body;

    const sql = `INSERT INTO folder_permissions (folder_id, user_id, can_view, can_upload) 
                 VALUES (?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE can_view = ?, can_upload = ?`;
                 
    db.query(sql, [folder_id, user_id, can_view, can_upload, can_view, can_upload], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;