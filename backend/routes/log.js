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
        SELECT * FROM (
            SELECT lh.id, lh.user_id, u.username AS user_name, 'User Login Successful' AS action, lh.login_timestamp AS action_time
            FROM login_history lh
            LEFT JOIN user u ON lh.user_id = u.id
            
            UNION ALL
            
            SELECT lo.id, lo.user_id, u.username AS user_name, 'User Logout Successful' AS action, lo.logout_timestamp AS action_time
            FROM logout_history lo
            LEFT JOIN user u ON lo.user_id = u.id
        ) AS unified_logs
        ORDER BY action_time DESC`;
                 
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

module.exports = router;