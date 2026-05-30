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


router.get('/me', verifyToken, (req, res) => {
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized session state." });

    db.query("DESCRIBE user", (descErr, columns) => {
        if (descErr) return res.status(500).json({ success: false, message: descErr.message });

        const hasBloColumn = columns.some(col => col.Field === 'blo');
        const bioColumnName = hasBloColumn ? 'blo' : 'bio';

        db.query(`SELECT username, email, ${bioColumnName} AS bio, profile_pic FROM user WHERE id = ?`, [userId], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (results.length === 0) return res.status(404).json({ success: false, message: "User not found." });

            return res.status(200).json({ success: true, user: results[0] });
        });
    });
});


router.put('/update-profile', verifyToken, upload.single('profilePic'), (req, res) => {
    const { userId, username, email, bio, password } = req.body;

    if (!userId) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, message: "User ID is needed." });
    }

if (email !== undefined && email !== null && email.trim() !== "") {
    const backendEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!backendEmailRegex.test(email.trim())) {
        return res.status(400).json({ 
            success: false, 
            message: "The provided email format is invalid. Please double-check your entry." 
        });
    }
}
    db.query("SELECT email, username, profile_pic FROM user WHERE id = ?", [userId], (err, userResults) => {
        if (err) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(500).json({ success: false, message: err.message });
        }
        if (userResults.length === 0) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const currentUser = userResults[0];
        const targetEmail = (email !== undefined && email !== null && email.trim() !== "") ? email : currentUser.email;
        const targetUsername = (username !== undefined && username !== null && username.trim() !== "") ? username : currentUser.username;

        const checkSql = "SELECT id FROM user WHERE (email = ? OR username = ?) AND id != ?";
        db.query(checkSql, [targetEmail, targetUsername, userId], (checkErr, duplicateUsers) => {
            if (checkErr) {
                if (req.file) fs.unlink(req.file.path, () => {});
                return res.status(500).json({ success: false, message: checkErr.message });
            }
            if (duplicateUsers && duplicateUsers.length > 0) {
                if (req.file) fs.unlink(req.file.path, () => {});
                return res.status(400).json({ success: false, message: "The username or email is already taken." });
            }

            db.query("DESCRIBE user", async (descErr, columns) => {
                if (descErr) {
                    if (req.file) fs.unlink(req.file.path, () => {});
                    return res.status(500).json({ success: false, message: descErr.message });
                }

                const hasBloColumn = columns.some(col => col.Field === 'blo');
                const bioColumnName = hasBloColumn ? 'blo' : 'bio';
                const newPhotoFilename = req.file ? req.file.filename : null;

                let updateFields = [];
                let params = [];

                if (username !== undefined && username !== null && username.trim() !== "") {
                    updateFields.push("username = ?");
                    params.push(username);
                }
                if (email !== undefined && email !== null && email.trim() !== "") {
                    updateFields.push("email = ?");
                    params.push(email);
                }
                if (bio !== undefined && bio !== null) {
                    updateFields.push(`${bioColumnName} = ?`);
                    params.push(bio);
                }
                if (newPhotoFilename) {
                    updateFields.push("profile_pic = ?");
                    params.push(newPhotoFilename);
                }

                const executeSqlUpdate = (finalSql, finalParams) => {
                    db.query(finalSql, finalParams, (updateErr) => {
                        if (updateErr) {
                            if (req.file) fs.unlink(req.file.path, () => {});
                            return res.status(500).json({ success: false, message: updateErr.message });
                        }

                        if (newPhotoFilename && currentUser.profile_pic) {
                            const oldFilePath = path.join(uploadDir, currentUser.profile_pic);
                            fs.unlink(oldFilePath, () => {});
                        }

                        return res.status(200).json({ 
                            success: true, 
                            message: "Profile Updated successfully!", 
                            profile_pic: newPhotoFilename || currentUser.profile_pic 
                        });
                    });
                };

                if (password && password.trim() !== "" && password !== "••••") {
                    try {
                        const salt = await bcrypt.genSalt(10);
                        const hashedPassword = await bcrypt.hash(password, salt);
                        
                        updateFields.push("password = ?");
                        params.push(hashedPassword);

                        let finalSql = `UPDATE user SET ${updateFields.join(", ")} WHERE id = ?`;
                        params.push(userId);
                        
                        executeSqlUpdate(finalSql, params);
                    } catch (hashErr) {
                        if (req.file) fs.unlink(req.file.path, () => {});
                        return res.status(500).json({ success: false, message: "Password processing failure." });
                    }
                } else {
                    if (updateFields.length === 0) {
                        return res.status(200).json({ success: true, message: "No adjustments required.", profile_pic: currentUser.profile_pic });
                    }
                    
                    let finalSql = `UPDATE user SET ${updateFields.join(", ")} WHERE id = ?`;
                    params.push(userId);
                    
                    executeSqlUpdate(finalSql, params);
                }
            });
        });
    });
});

router.put('/remove-photo', verifyToken, (req, res) => {
    const userId = req.user ? req.user.id : req.body.userId;

    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required." });
    }

    db.query("SELECT profile_pic FROM user WHERE id = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length === 0) return res.status(404).json({ success: false, message: "User not found." });

        const currentPic = results[0].profile_pic;

        db.query("UPDATE user SET profile_pic = '' WHERE id = ?", [userId], (updateErr) => {
            if (updateErr) return res.status(500).json({ success: false, message: updateErr.message });

            if (currentPic) {
                const filePath = path.join(uploadDir, currentPic);

                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error("Failed to delete image file from storage:", unlinkErr);
                        }
                    });
                }
            }

            return res.status(200).json({ 
                success: true, 
                message: "Profile photo removed successfully!",
                profile_pic: '' 
            });
        });
    });
});

module.exports = router;