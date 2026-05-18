const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const config = require("../config/db.config");
const verifyToken = require("../middleware/auth"); // Protect these routes!

const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// GET: All Users (Protected)
router.get("/", verifyToken, (req, res) => {
    db.query("SELECT id, name, role, status FROM user ORDER BY name ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});


// POST: Add User
router.post("/", (req, res) => {
    const { name, role, password } = req.body;

    db.query("SELECT * FROM user WHERE name = ?", [name], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Server error" });
        if (results.length > 0)
            return res.status(400).json({ success: false, message: "An account with this name already exists." });

        const sql = "INSERT INTO user (name, role, password, status) VALUES (?, ?, ?, 'Active')";
        db.query(sql, [name, role, password], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.status(201).json({ success: true, message: "User Created Successfully" });
        });
    });
});


// PUT: Update User (Protected)
router.put("/:id", verifyToken, (req, res) => {
    const userId = req.params.id;
    const { name, role, status } = req.body;

    const sql = "UPDATE user SET name = ?, role = ?, status = ? WHERE id = ?";
    db.query(sql, [name, role, status, userId], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: "User details updated successfully" });
    });
});

// DELETE: Delete User (Protected)
router.delete("/:id", verifyToken, (req, res) => {
    const userId = req.params.id;
    db.query("SET FOREIGN_KEY_CHECKS = 0", (err) => {
        db.query("DELETE FROM user WHERE id = ?", [userId], (err) => {
            db.query("SET FOREIGN_KEY_CHECKS = 1", () => {
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true, message: "User Deleted Successfully" });
            });
        });
    });
});

module.exports = router;