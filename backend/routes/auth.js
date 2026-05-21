const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const config = require("../config/db.config");
const verifyToken = require("../middleware/auth");

// Create database connection for this router
const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// POST: Register / Add User securely
router.post("/register", (req, res) => {
    const { name, role, password } = req.body;

    // Check if user exists
    db.query("SELECT * FROM user WHERE username = ?", [name], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) {
            return res.status(400).json({ success: false, message: "An account with this name already exists." });
        }

        // Hash the password securely
        const hashedPassword = bcrypt.hashSync(password, 10);

        const sql = "INSERT INTO user (username, role, password, status) VALUES (?, ?, ?, 'Active')";
        db.query(sql, [name, role, hashedPassword], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.status(201).json({ success: true, message: "User Registered Successfully" });
        });
    });
});

// POST: Login
router.post("/login", (req, res) => {
    const { name, password } = req.body;

    db.query("SELECT * FROM user WHERE username = ?", [name], (err, result) => {
        if (err || result.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid Credentials" });
        }

        const user = result[0];

        // Compare incoming plain-text password with the secure hash in the database
        const isValidPassword = bcrypt.compareSync(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: "Invalid Credentials" });
        }

        // Generate an expiring 1-hour secure JWT token
        const token = jwt.sign(
            { id: user.id, name: user.username, role: user.role }, 
            config.JWT_SECRET, 
            { expiresIn: "1h" }
        );

        const logSql = "INSERT INTO login_history (user_id, login_timestamp) VALUES (?, NOW())";
        db.query(logSql, [user.id], (logErr) => {
            if (logErr) {
                console.error("Database failed to record login audit:", logErr.message);
            }

            res.json({
                success: true,
                token: token,
                user: { id: user.id, name: user.name, role: user.role }
            });
        });
    });
});

// Logout with logout history
router.post("/logout", verifyToken, (req, res) => {
    const userId = req.user.id;

    // 📝 WRITE TO LOGOUT LOGS TABLE
    const logSql = "INSERT INTO logout_history (user_id, logout_timestamp) VALUES (?, NOW())";
    db.query(logSql, [userId], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Failed to record logout history." });
        }

        res.json({ 
            success: true, 
            message: "Logout successfully. " 
        });
    });
});

// exports the router object so server.js can register these routes
module.exports = router;