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
    // MODIFIED: Changed l.timestamp to your new column name: l.action_timestamp
    const sql = `
        SELECT 
            l.id, 
            l.user_id, 
            u.username AS user_name, 
            CASE 
                WHEN l.action IS NOT NULL AND l.action != '' THEN l.action
                WHEN l.logout_timestamp IS NULL THEN 'User Login Successful (Active)'
                ELSE 'User Session Terminated / Logout'
            END AS action, 
            COALESCE(l.action_timestamp, l.login_timestamp) AS action_time
        FROM logs l
        LEFT JOIN user u ON l.user_id = u.id
        ORDER BY action_time DESC`;
                 
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database Fetch Error (Logs):", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

module.exports = router;