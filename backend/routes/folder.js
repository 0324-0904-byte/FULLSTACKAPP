const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const config = require('../config/db.config');
const verifyToken = require('../middleware/auth'); 

// Local connection using the clean config parameters
const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// Fetch All Folders (Protected)
router.get('/', verifyToken, (req, res) => {
    db.query("SELECT * FROM folder ORDER BY folder_name ASC", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

// Create Folder Directory (Protected)
router.post('/', verifyToken, (req, res) => {
    const { folder_name } = req.body; 
    const userId = req.user.id;      

    if (!folder_name || !folder_name.trim()) {
        return res.status(400).json({ success: false, message: "Folder name required." });
    }

    const sql = "INSERT INTO folder (folder_name) VALUES (?)";
    db.query(sql, [folder_name], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // Audit Trail Integration
        db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", 
            [userId, `Created folder directory entity: "${folder_name}"`]
        );

        res.json({ success: true });
    });
});

// Rename Folder Directory (Protected)
router.put('/:id', verifyToken, (req, res) => {
    const folderId = req.params.id;
    const { folder_name } = req.body;
    const userId = req.user.id; 

    const sql = "UPDATE folder SET folder_name = ? WHERE id = ?";
    db.query(sql, [folder_name, folderId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", 
            [userId, `Renamed folder ID ${folderId} to "${folder_name}"`]
        );

        res.json({ success: true });
    });
});

// Drop Folder Directory Safely (Protected)
router.delete('/:id', verifyToken, (req, res) => {
    const folderId = req.params.id;
    const userId = req.user.id; 

    db.query("UPDATE document SET folder_id = NULL WHERE folder_id = ?", [folderId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query("DELETE FROM folder WHERE id = ?", [folderId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", 
                [userId, `Deleted folder directory reference ID: ${folderId}`]
            );

            res.json({ success: true });
        });
    });
});

module.exports = router;