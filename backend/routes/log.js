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
router.get('/logs', verifyToken, (req, res) => {
    const sql = `
        SELECT 
            l.id, 
            l.user_id, 
            u.username AS user_name, 
            IF(l.logout_timestamp IS NULL, 'User Login Successful (Active)', 'User Session Terminated / Logout') AS action, 
            l.login_timestamp AS action_time
        FROM logs l
        LEFT JOIN user u ON l.user_id = u.id
        ORDER BY l.login_timestamp DESC`;
                 
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

module.exports = router;