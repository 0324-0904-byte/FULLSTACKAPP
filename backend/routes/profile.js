const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const config = require('../config/db.config'); 
const bcrypt = require('bcryptjs'); 


const db = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// PUT Endpoint (including email)
router.put('/update-profile', async (req, res) => {
    const { userId, username, email, bio, password } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is needed." });
    }

    try {
        const checkSql = "SELECT id FROM user WHERE (email = ? OR username = ?) AND id != ?";
        db.query(checkSql, [email, username, userId], async (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            
            if (results.length > 0) {
                return res.status(400).json({ success: false, message: "The username or email is already taken." });
            }

            
            if (password && password.trim() !== "" && password !== "••••") {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                
                const updateWithPassSql = "UPDATE user SET username = ?, email = ?, bio = ?, password = ? WHERE id = ?";
                db.query(updateWithPassSql, [username, email, bio, hashedPassword, userId], (err, updateResult) => {
                    if (err) return res.status(500).json({ success: false, message: err.message });
                    return res.status(200).json({ success: true, message: "Profile & Password Updated!" });
                });
            } else {
                const updateSql = "UPDATE user SET username = ?, email = ?, bio = ? WHERE id = ?";
                db.query(updateSql, [username, email, bio, userId], (err, updateResult) => {
                    if (err) return res.status(500).json({ success: false, message: err.message });
                    return res.status(200).json({ success: true, message: "Profile Updated!" });
                });
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server Error." });
    }
});

module.exports = router;