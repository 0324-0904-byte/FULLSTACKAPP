const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const config = require('../config/db.config'); 
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const verifyToken = require('../middleware/auth'); 

const db = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// --- PROFILE PICTURE STORAGE ENGINE ---
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, 'avatar-' + Date.now() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// 👤 GET Endpoint: Fetches current user profile metrics from the correct token payload context
router.get('/me', verifyToken, (req, res) => {
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized session state." });
    }

    db.query("DESCRIBE user", (descErr, columns) => {
        if (descErr) return res.status(500).json({ success: false, message: descErr.message });

        const hasBloColumn = columns.some(col => col.Field === 'blo');
        const bioColumnName = hasBloColumn ? 'blo' : 'bio';

        db.query(`SELECT username, email, ${bioColumnName} AS bio, profile_pic FROM user WHERE id = ?`, [userId], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (results.length === 0) return res.status(404).json({ success: false, message: "User not found." });

            return res.status(200).json({
                success: true,
                user: results[0]
            });
        });
    });
});

// PUT Endpoint: Update profile fields, passwords, and handle avatar uploads
router.put('/update-profile', verifyToken, upload.single('profilePic'), async (req, res) => {
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

            const newPhotoFilename = req.file ? req.file.filename : null;

            // Inspect column mapping definitions before sending updates to MySQL
            db.query("DESCRIBE user", async (descErr, columns) => {
                if (descErr) return res.status(500).json({ success: false, message: descErr.message });

                const hasBloColumn = columns.some(col => col.Field === 'blo');
                const bioColumnName = hasBloColumn ? 'blo' : 'bio';

                // 1. Password processing logic block
                if (password && password.trim() !== "" && password !== "••••") {
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(password, salt);

                    let updateWithPassSql = `UPDATE user SET username = ?, email = ?, ${bioColumnName} = ?, password = ?`;
                    let params = [username, email, bio, hashedPassword];

                    if (newPhotoFilename) {
                        updateWithPassSql += ", profile_pic = ?";
                        params.push(newPhotoFilename);
                    }
                    
                    updateWithPassSql += " WHERE id = ?";
                    params.push(userId);

                    db.query(updateWithPassSql, params, (err, updateResult) => {
                        if (err) return res.status(500).json({ success: false, message: err.message });
                        return res.status(200).json({ 
                            success: true, 
                            message: "Profile & Password Updated!",
                            profile_pic: newPhotoFilename
                        });
                    });
                } else {
                    // 2. Profile data processing logic block without password change
                    let updateSql = `UPDATE user SET username = ?, email = ?, ${bioColumnName} = ?`;
                    let params = [username, email, bio];

                    if (newPhotoFilename) {
                        updateSql += ", profile_pic = ?";
                        params.push(newPhotoFilename);
                    }

                    updateSql += " WHERE id = ?";
                    params.push(userId);

                    db.query(updateSql, params, (err, updateResult) => {
                        if (err) return res.status(500).json({ success: false, message: err.message });
                        return res.status(200).json({ 
                            success: true, 
                            message: "Profile Updated!",
                            profile_pic: newPhotoFilename
                        });
                    });
                }
            });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server Error." });
    }
});

module.exports = router;