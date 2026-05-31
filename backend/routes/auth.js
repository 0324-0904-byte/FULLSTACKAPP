const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const config = require("../config/db.config");
const verifyToken = require("../middleware/auth");

const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// POST: Register
router.post("/register", (req, res) => {
    const { name, role, password } = req.body;

    db.query("SELECT * FROM user WHERE username = ?", [name], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) {
            return res.status(400).json({ success: false, message: "An account with this name already exists." });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const sql = "INSERT INTO user (username, role, password, status) VALUES (?, ?, ?, 'active')";
        
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
            { expiresIn: "5h" }
        );

        // FIX: Target the brand-new 'logs' table instead of 'login_history'
        const logSql = "INSERT INTO logs (user_id, action, login_timestamp) VALUES (?, 'User logged in',NOW())";
        db.query(logSql, [user.id], (logErr, logResult) => {
            if (logErr) {
                console.error("Database failed to record login audit:", logErr.message);
                return res.status(500).json({ success: false, message: "Logging initialization failed." });
            }

            // Return activeLogId so users.ts can save it for logout tracking
            // ADDED: Fallback mapping parameters para sa profile binding fields
            res.json({
                success: true,
                token: token,
                activeLogId: logResult.insertId, 
                user: { 
                    id: user.id, 
                    name: user.username, 
                    role: user.role,
                    email: user.email || '',
                    bio: user.bio || ''
                }
            });
        });
    });
});
 
// POST: Logout 
router.post("/logout", verifyToken, (req, res) => {
    const { activeLogId } = req.body;

    if (!activeLogId || activeLogId === "null" || activeLogId === "undefined") {
        console.warn("Logout requested but missing a valid session tracking ID payload.");
        return res.json({ 
            success: true, 
            message: "Client cleared immediately without database timestamp update." 
        });
    }

    const logSql = "UPDATE logs SET logout_timestamp = NOW() WHERE id = ?";
    db.query(logSql, [activeLogId], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Failed to record logout history asset." });
        }

        res.json({ 
            success: true, 
            message: "Logout completed smoothly." 
        });
    });
});

module.exports = router;