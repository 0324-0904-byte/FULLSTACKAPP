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

// PUT: Update User (name, role, status, soft-delete)
router.put("/:id", [verifyToken, isAdmin], (req, res) => {
    const userId = req.params.id;
    const { username, role, status } = req.body; 

    if (status && !['active', 'deactivated'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    // check the user's current role in the database
    const checkSql = "SELECT role FROM user WHERE id = ?";
    db.query(checkSql, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const currentUser = rows[0];

        // Define these variables here so they are available for all checks below
        const isCurrentAdmin = currentUser.role === 'admin';
        const isNewAdmin = role === 'admin';

        //NEW CODE FOR BLOCKING ROLE CHANGE FOR ADMIN============
        if (isCurrentAdmin && role && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: "Protected action: Admin privileges are permanent and cannot be revoked."
            });
        }
        // ==========================================

        // don't allow admin deactivation
        if ((isCurrentAdmin || isNewAdmin) && status === 'deactivated') {
            return res.status(400).json({ 
                success: false, 
                message: "Protected action: Administrators cannot be deactivated." 
            });
        }

        // proceed with update
        const updateSql = "UPDATE user SET username = ?, role = ?, status = ? WHERE id = ?";
        db.query(updateSql, [username, role, status, userId], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            
            res.json({ success: true, message: "User details and status updated successfully" });
        });
    });
});

module.exports = router;