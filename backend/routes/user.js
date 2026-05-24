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

// =========================================================================
// PUT /profile/update-profile
// =========================================================================
router.put("/profile/update-profile", verifyToken, (req, res) => {
    const { userId, username, email, bio, password } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: "Critical Error: User ID is required." });
    }

    if (password && password.length < 8) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters long."
        });
    }

    if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const updateSql = `
            UPDATE user 
            SET username = ?, email = ?, bio = ?, password = ? 
            WHERE id = ?
        `;
        db.query(updateSql, [username, email, bio, hashedPassword, userId], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, message: "Profile and data fields locked into DB successfully!" });
        });
    } else {
        const updateSql = `
            UPDATE user 
            SET username = ?, email = ?, bio = ? 
            WHERE id = ?
        `;
        db.query(updateSql, [username, email, bio, userId], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, message: "Profile and data fields locked into DB successfully!" });
        });
    }
});

// =========================================================================
// GET /profile/me
// =========================================================================
router.get("/profile/me", verifyToken, (req, res) => {
    const currentId = req.userId || (req.user ? req.user.id : null);

    if (!currentId) {
        return res.status(400).json({ success: false, message: "User ID not found in token." });
    }

    db.query("SELECT id, username, email, bio, role FROM user WHERE id = ?", [currentId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });
        
        res.json({ success: true, user: rows[0] });
    });
});

// GET: All Users (Protected)
router.get("/", [verifyToken, isAdmin], (req, res) => {
    db.query("SELECT id, username, role, status, email, bio FROM user ORDER BY username ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// PUT: Update User (name, role, status, soft-delete)
router.put("/:id", [verifyToken, isAdmin], (req, res) => {
    const userId = req.params.id;
    const { username, role, status, password } = req.body; 

    // ================= PASSWORD VALIDATION =================
    if (password && password.length < 8) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters long."
        });
    }

    if (status && !['active', 'deactivated'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const checkSql = "SELECT role FROM user WHERE id = ?";
    db.query(checkSql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });

        const currentUser = rows[0];
        const isCurrentAdmin = currentUser.role === 'admin';
        
        // FIXED fallback check: Kung walang ipinasang role ang frontend gamitin ang kasalukuyang role ng user
        const targetRole = role || currentUser.role; 
        const isNewAdmin = targetRole === 'admin';

        // Block changing admin privilege to standard user
        if (isCurrentAdmin && role && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: "Protected action: Admin privileges are permanent and cannot be revoked."
            });
        }

        // Prevent admin deactivation
        if ((isCurrentAdmin || isNewAdmin) && status === 'deactivated') {
            return res.status(400).json({ 
                success: false, 
                message: "Protected action: Administrators cannot be deactivated." 
            });
        }

        // ================= UPDATE LOGIC EXECUTION =================
        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const updateSql = `
                UPDATE user 
                SET username = ?, role = ?, status = ?, password = ?
                WHERE id = ?
            `;
            db.query(updateSql, [username || currentUser.username, targetRole, status || currentUser.status, hashedPassword, userId], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: "User details updated successfully" });
            });
        } else {
            const updateSql = `
                UPDATE user 
                SET username = ?, role = ?, status = ?
                WHERE id = ?
            `;
            db.query(updateSql, [username || currentUser.username, targetRole, status || currentUser.status, userId], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: "User details updated successfully" });
            });
        }
    });
});

module.exports = router;