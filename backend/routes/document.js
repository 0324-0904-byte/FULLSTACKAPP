const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
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

// Fetch & Filter Documents 
router.get('/document', (req, res) => {
    const { folderId, search } = req.query; 
    let sql = `SELECT d.id, d.name AS title, d.file_path, d.timestamp AS upload_date, 
                      'General' AS category, f.folder_name, u.username AS uploader_name 
               FROM document d 
               LEFT JOIN folder f ON d.folder_id = f.folder_id 
               LEFT JOIN user u ON d.uploaded_by = u.id 
               WHERE 1=1`;
    
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
        if (err) {
            console.error("Database Fetch Error:", err); 
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// UPLOAD DOCUMENT  
router.post('/upload', upload.single('file'), verifyToken, (req, res) => {
    const { title, folder_id, uploaded_by } = req.body;
    const targetFolder = (folder_id && folder_id !== 'null' && folder_id !== '') ? folder_id : null;
    const fileNameString = req.file ? req.file.filename : title;
    const timestamp = new Date(); 
    
    const userId = req.user ? req.user.id : (uploaded_by || null);

    const sql = "INSERT INTO document (name, file_path, timestamp, uploaded_by, folder_id) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [title, fileNameString, timestamp, userId, targetFolder], (err, result) => {
        if (err) {
            console.error("Database Error:", err); 
            return res.status(500).json({ error: err.message });
        }
        // action added to logs
        const logSql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
        const logAction = `Uploaded document: "${title}"`;
        db.query(logSql, [userId, logAction], (logErr) => {
            if (logErr) console.error("Logging Error (Upload):", logErr.message);
            
            res.json({ success: true });
        });
    });
});


// Update Metadata (name, folder) 
router.put('/document/:id', [verifyToken, isAdmin], (req, res) => {
    const docId = req.params.id;
    const { title, folder_id, uploaded_by } = req.body; 
    const targetFolder = (folder_id === 'null' || !folder_id) ? null : folder_id;
    const userId = req.user ? req.user.id : (uploaded_by || null);

    const sql = "UPDATE document SET name = ?, folder_id = ? WHERE id = ?";
    db.query(sql, [title, targetFolder, docId], (err, result) => {
        if (err) {
            console.error("Database Update Error:", err);
            return res.status(500).json({ error: err.message });
        }

        // action added to logs
        const logSql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
        const logAction = `Updated metadata for document ID ${docId}. New title: "${title}"`;
        db.query(logSql, [userId, logAction], (logErr) => {
            if (logErr) console.error("Logging Error (Update):", logErr.message);
            
            res.json({ success: true, message: "Metadata updated successfully" });
        });
    });
});

// Delete Document Asset 
router.delete('/document/:id', [verifyToken, isAdmin], (req, res) => {
    const docId = req.params.id;
    const userId = req.user ? req.user.id : null;
    
    db.query("SELECT name, file_path FROM document WHERE id = ?", [docId], (err, records) => {
        if (err) return res.status(500).json({ error: err.message });
        if (records.length === 0) return res.status(404).json({ error: "Document not found" });

        const docTitle = records[0].name;
        const filename = records[0].file_path;
        const filepath = path.join(uploadDir, filename);

        if (filename && fs.existsSync(filepath)) {
            try {
                fs.unlinkSync(filepath);
            } catch (fsErr) {
                console.error("Physical disk cleanup note:", fsErr.message);
            }
        }

        db.query("DELETE FROM document WHERE id = ?", [docId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // action added to logs
            const logSql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
            const logAction = `Deleted document asset: "${docTitle}" (ID: ${docId})`;
            db.query(logSql, [userId, logAction], (logErr) => {
                if (logErr) console.error("Logging Error (Delete):", logErr.message);
                
                res.json({ success: true, message: "File Deleted Successfully." });
            });
        });
    });
});


// --- 5. SECURE ASSET DOWNLOAD PIPELINE ---
// Explicitly maps both variations to match her specific frontend plural call safely
router.get(['/document/download/:id', '/documents/download/:id'], verifyToken, (req, res) => {
    const docId = req.params.id;
    const userId = req.user ? req.user.id : null;

    db.query("SELECT name, file_path FROM document WHERE id = ?", [docId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "File reference not found in DB rows." });

        const systemFilename = results[0].file_path;
        // If systemFilename turns out to be blank, fall back to results[0].name safely
        const targetFile = systemFilename || results[0].name;
        const userDisplayTitle = results[0].name; 

        const fullPhysicalPath = path.join(uploadDir, targetFile);

        // Check if the physical binary asset actually exists on your hard drive before attempting to stream it!
        if (!fs.existsSync(fullPhysicalPath)) {
            console.error(`🔴 FILE NOT FOUND ON DISK: Database record exists, but file is missing at: ${fullPhysicalPath}`);
            return res.status(404).json({ 
                error: "Physical file asset missing from local disk storage space.",
                note: "The database row matches, but the physical file was deleted from the uploads directory."
            });
        }

        // Trigger the file transmission stream safely since it passed the path verification test
        res.download(fullPhysicalPath, userDisplayTitle, (downloadErr) => {
            if (downloadErr) {
                console.error("Physical download transmission error:", downloadErr);
            } else {
                // Smooth audit trail addition targeting your unified logs table schema
                const logSql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
                const logAction = `Downloaded document: "${userDisplayTitle}" (ID: ${docId})`;
                db.query(logSql, [userId, logAction], (logErr) => {
                    if (logErr) console.error("Logging Error (Download):", logErr.message);
                });
            }
        });
    });
});

// --- 6. ASSET INLINE PREVIEW PIPELINE ---
router.get(['/document/:id/preview', '/documents/:id/preview'], (req, res) => {
    const docId = req.params.id;

    db.query("SELECT name, file_path FROM document WHERE id = ?", [docId], (err, results) => {
        if (err) return res.status(500).send("Database error encountered during retrieval.");
        if (results.length === 0) return res.status(404).send("Document reference matching that identifier was not found.");

        const systemFilename = results[0].file_path;
        const targetFile = systemFilename || results[0].name;
        const fullPhysicalPath = path.join(uploadDir, targetFile);

        // Check if file physically exists on server disk space
        if (!fs.existsSync(fullPhysicalPath)) {
            return res.status(404).send("The file record exists in our system rows, but the physical document asset is missing from storage.");
        }

        const ext = path.extname(fullPhysicalPath).toLowerCase();

        // --- DYNAMIC FORMAT INTERCEPTION ---
        if (ext === '.docx' || ext === '.xlsx') {
            const outputDir = path.join(__dirname, '../../uploads/temp');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            // CRITICAL: We 'return' here so Express stops moving down!
            return exec(`libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${fullPhysicalPath}"`, (execErr) => {
                if (execErr) {
                    console.error("LibreOffice Error:", execErr);
                    return res.status(500).send("Document conversion failed.");
                }
                
                const pdfPath = path.join(outputDir, targetFile.replace(ext, '.pdf'));
                res.writeHead(200, { 
                    'Content-Type': 'application/pdf', 
                    'Content-Disposition': 'inline' 
                });
                fs.createReadStream(pdfPath).pipe(res);
            });
        }

        // --- STANDARD FORMAT RENDER ---
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.txt') contentType = 'text/plain';

        // This was running twice for docx files! Now it's safely blocked by the return above.
        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Disposition': 'inline'
        });

        const fileStream = fs.createReadStream(fullPhysicalPath);
        fileStream.pipe(res);
    });
});

module.exports = router;