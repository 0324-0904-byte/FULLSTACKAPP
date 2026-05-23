const express = require('express');
const router = express.Router();
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

// Fetch All Folders (Protected - Viewable by all logged-in users)
router.get('/folders', verifyToken, (req, res) => {
    db.query("SELECT folder_id AS id, folder_name, user_id FROM folder ORDER BY folder_name ASC", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

// Create Folder Directory 
router.post('/folders', [verifyToken, isAdmin], (req, res) => {
    const { folder_name } = req.body; 
    const userId = req.user.id;

    if (!folder_name || !folder_name.trim()) {
        return res.status(400).json({ success: false, message: "Folder name required." });
    }

    const sql = "INSERT INTO folder (folder_name, user_id) VALUES (?, ?)";
    db.query(sql, [folder_name, userId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", 
            [userId, `Created folder directory entity: "${folder_name}"`],
            (logErr) => {
                if (logErr) console.error("Logging Error (Create Folder):", logErr.message);
                
                res.json({ success: true, message: "Folder created successfully!" });
            }
        );
    });
});

// Rename Folder Directory 
router.put('/folders/:id', [verifyToken, isAdmin], (req, res) => {
    const folderId = req.params.id;
    const { folder_name } = req.body;
    const userId = req.user ? req.user.id : req.body.user_id; 

    const sql = "UPDATE folder SET folder_name = ? WHERE folder_id = ?";
    db.query(sql, [folder_name, folderId], (err, result) => {
        if (err) {
            console.error("Folder Update Query Error:", err);
            return res.status(500).json({ error: err.message });
        }

        db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", 
            [userId, `Renamed folder ID ${folderId} to "${folder_name}"`], 
            (logErr) => {
                if (logErr) console.error("System logs auditing insertion note:", logErr.message);
                
                return res.json({ success: true, message: "Folder updated cleanly" });
            }
        );
    });
});


// Drop Folder Directory Safely 
router.delete('/folders/:id', [verifyToken, isAdmin], (req, res) => {
    const folderId = req.params.id;
    const userId = req.user.id; 
    const cascade = req.query.cascade === 'true'; 

    db.query("SELECT folder_name FROM folder WHERE folder_id = ?", [folderId], (findErr, records) => {
        if (findErr) return res.status(500).json({ error: findErr.message });
        if (records.length === 0) return res.status(404).json({ error: "Folder not found" });

        const targetedFolderName = records[0].folder_name;

        const docQuery = cascade 
            ? "DELETE FROM document WHERE folder_id = ?" 
            : "UPDATE document SET folder_id = NULL WHERE folder_id = ?";

        db.query(docQuery, [folderId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query("DELETE FROM folder WHERE folder_id = ?", [folderId], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                const logAction = cascade 
                    ? `Deleted folder "${targetedFolderName}" (ID: ${folderId}) and permanently purged all its documents.` 
                    : `Deleted folder "${targetedFolderName}" (ID: ${folderId}). Associated documents moved to Global directory space.`;

                db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", 
                    [userId, logAction],
                    (logErr) => {
                        if (logErr) console.error("Logging Error (Delete Folder):", logErr.message);
                        
                        res.json({ success: true, message: "Folder removed cleanly." });
                    }
                );
            });
        });
    });
});

module.exports = router;