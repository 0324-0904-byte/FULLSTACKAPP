const db = require('../config/db');

async function logAction(userId, actionMessage) {
    try {
        const sql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
        await db.query(sql, [userId || null, actionMessage]);
    } catch (err) {
        console.error("Failed to write to logs:", err.message);
    }
}

module.exports = { logAction };