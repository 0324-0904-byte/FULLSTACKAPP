const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const config = require('../config/db.config');
const verifyToken = require('../middleware/auth');

const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

// Fetch System Operational Audits (Protected)
router.get('/', verifyToken, (req, res) => {
    const sql = `SELECT l.*, u.username AS user_name 
                 FROM logs l 
                 LEFT JOIN user u ON l.user_id = u.id 
                 ORDER BY l.action_time DESC`;
                 
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

module.exports = router;