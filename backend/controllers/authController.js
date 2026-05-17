const db = require('../config/db');
const { logAction } = require('../middleware/logger');

const login = async (req, res) => {
    try {
        const { name, pass } = req.body;
        const [results] = await db.query(
            "SELECT * FROM users WHERE name = ? AND password = ? AND status = 'Active'", 
            [name, pass]
        );

        if (!results || results.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        await logAction(results[0].id, 'User Login Successful');
        res.json(results[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { login };