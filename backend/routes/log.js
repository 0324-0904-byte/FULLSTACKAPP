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
            l.id, l.user_id, u.username AS user_name,
            'User Login Successful (Active)' AS action,
            l.login_timestamp AS action_time
        FROM logs l
        LEFT JOIN user u ON l.user_id = u.id
        WHERE l.login_timestamp IS NOT NULL
        AND l.action IS NULL              
        AND l.logout_timestamp IS NULL    
        
        UNION ALL

        SELECT 
            l.id, l.user_id, u.username AS user_name,
            'User Session Terminated / Logout' AS action,
            l.logout_timestamp AS action_time
        FROM logs l
        LEFT JOIN user u ON l.user_id = u.id
        WHERE l.logout_timestamp IS NOT NULL

        UNION ALL
        
        SELECT 
            l.id, l.user_id, u.username AS user_name,
            l.action AS action,
            l.action_timestamp AS action_time
        FROM logs l
        LEFT JOIN user u ON l.user_id = u.id
        WHERE l.action IS NOT NULL AND l.action != ''
        ORDER BY action_time DESC`;
                 
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database Fetch Error (Logs):", err);
            return res.status(500).json({ error: err.message });
        }
        // console.log('Total rows:', results.length);
        // console.log('Logout rows:', results.filter(r => r.action.includes('Logout')));
        res.json(results);
    });
});

module.exports = router;