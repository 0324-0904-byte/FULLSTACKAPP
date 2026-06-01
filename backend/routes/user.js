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

// PUT /profile/update-profile
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
        const updateSql = `UPDATE user SET username = ?, email = ?, bio = ?, password = ? WHERE id = ?`;
        db.query(updateSql, [username, email, bio, hashedPassword, userId], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            // action saved to db
            const logSql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
            db.query(logSql, [userId, `Updated own profile (with password change)`], (logErr) => {
                if (logErr) console.error("Logging Error (Profile Update):", logErr.message);
                res.json({ success: true, message: "Profile updated successfully!" });
            });
        });
    } else {
        const updateSql = `UPDATE user SET username = ?, email = ?, bio = ? WHERE id = ?`;
        db.query(updateSql, [username, email, bio, userId], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            // action saved to db
            const logSql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
            db.query(logSql, [userId, `Updated own profile`], (logErr) => {
                if (logErr) console.error("Logging Error (Profile Update):", logErr.message);
                res.json({ success: true, message: "Profile updated successfully!" });
            });
        });
    }
});

// GET /profile/me — no logging needed (read-only)
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

// GET: All Users — no logging needed (read-only)
router.get("/", [verifyToken, isAdmin], (req, res) => {
    db.query("SELECT id, username, role, status, email, bio FROM user ORDER BY username ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// PUT: Update User (admin action)
router.put("/:id", [verifyToken, isAdmin], (req, res) => {
    const userId = req.params.id;
    const { username, role, status, password } = req.body;
    const adminId = req.user ? req.user.id : null; // 

    if (password && password.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
    }

    if (status && !['active', 'deactivated'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const checkSql = "SELECT role, status, username FROM user WHERE id = ?";
    db.query(checkSql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });

        const currentUser = rows[0];
        const isCurrentAdmin = currentUser.role === 'admin';
        const targetRole = role || currentUser.role;
        const isNewAdmin = targetRole === 'admin';

        if (isCurrentAdmin && role && role !== 'admin') {
            return res.status(400).json({ success: false, message: "Protected action: Admin privileges are permanent and cannot be revoked." });
        }

        if ((isCurrentAdmin || isNewAdmin) && status === 'deactivated') {
            return res.status(400).json({ success: false, message: "Protected action: Administrators cannot be deactivated." });
        }

        // ✅ Build log message based on what changed
        const buildLogAction = () => {
            if (status === 'deactivated' && currentUser.status !== 'deactivated') {
                return `Deactivated user account: "${currentUser.username}" (ID ${userId})`;
            } else if (status === 'active' && currentUser.status === 'deactivated') {
                return `Reactivated user account: "${currentUser.username}" (ID ${userId})`;
            } else if (password) {
                return `Updated user account with password reset: "${currentUser.username}" (ID ${userId})`;
            } else {
                return `Updated user account details: "${currentUser.username}" (ID ${userId})`;
            }
        };

        const logAction = buildLogAction();

        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const updateSql = `UPDATE user SET username = ?, role = ?, status = ?, password = ? WHERE id = ?`;
            db.query(updateSql, [username || currentUser.username, targetRole, status || currentUser.status, hashedPassword, userId], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });

                // action saved to db
                db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", [adminId, logAction], (logErr) => {
                    if (logErr) console.error("Logging Error (Admin Update User):", logErr.message);
                    res.json({ success: true, message: "User details updated successfully" });
                });
            });
        } else {
            const updateSql = `UPDATE user SET username = ?, role = ?, status = ? WHERE id = ?`;
            db.query(updateSql, [username || currentUser.username, targetRole, status || currentUser.status, userId], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });

                // action saved to db
                db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", [adminId, logAction], (logErr) => {
                    if (logErr) console.error("Logging Error (Admin Update User):", logErr.message);
                    res.json({ success: true, message: "User details updated successfully" });
                });
            });
        }
    });
});

module.exports = router;