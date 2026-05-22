const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const config = require("../config/db.config");
const verifyToken = require("../middleware/auth"); 
const isAdmin = require('../middleware/role');

const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// GET: All Users (Protected)
router.get("/", [verifyToken, isAdmin], (req, res) => {
    db.query("SELECT id, username, role, status FROM user ORDER BY username ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});


// POST: Add User
router.post("/", [verifyToken, isAdmin], (req, res) => {
    const { username, role, password } = req.body;

    db.query("SELECT * FROM user WHERE username = ?", [username], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Server error" });
        if (results.length > 0)
            return res.status(400).json({ success: false, message: "An account with this name already exists." });

        const hashedPassword = bcrypt.hashSync(password, 8);

        const sql = "INSERT INTO user (username, role, password, status) VALUES (?, ?, ?, 'Active')";
        db.query(sql, [username, role, hashedPassword], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.status(201).json({ success: true, message: "User Created Successfully" });
        });
    });
});


// PUT: Update User (name, role, status, soft-delete)
router.put("/:id", [verifyToken, isAdmin], (req, res) => {
    const userId = req.params.id;
    const { username, role, status } = req.body; 

    if (status && !['active', 'deactivated'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const sql = "UPDATE user SET username = ?, role = ?, status = ? WHERE id = ?";
    
    db.query(sql, [username, role, status, userId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found." 
            });
        }

        res.json({ success: true, message: "User details and status updated successfully" });
    });
});

module.exports = router;