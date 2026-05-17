const db = require('../config/db');

const getUsers = async (req, res) => {
    try {
        const [results] = await db.query("SELECT id, name, role, status FROM users");
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createUser = async (req, res) => {
    try {
        const { name, password, role } = req.body;
        await db.query("INSERT INTO users (name, password, role) VALUES (?, ?, ?)", [name, password, role || 'User']);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { name, role, status } = req.body;
        await db.query("UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?", [name, role, status, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };