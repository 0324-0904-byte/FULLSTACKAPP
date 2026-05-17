const db = require('../config/db');
const { logAction } = require('../middleware/logger');

const getFolders = async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM folders");
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createFolder = async (req, res) => {
    try {
        const { folder_name, user_id } = req.body;
        await db.query("INSERT INTO folders (folder_name) VALUES (?)", [folder_name]);
        await logAction(user_id, `Created folder directory entity: "${folder_name}"`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const renameFolder = async (req, res) => {
    try {
        const { folder_name, user_id } = req.body;
        await db.query("UPDATE folders SET folder_name = ? WHERE id = ?", [folder_name, req.params.id]);
        await logAction(user_id, `Renamed folder ID ${req.params.id} to "${folder_name}"`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteFolder = async (req, res) => {
    try {
        const userId = req.query.user_id;
        await db.query("DELETE FROM folders WHERE id = ?", [req.params.id]);
        await logAction(userId, `Deleted folder directory reference ID: ${req.params.id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getFolders, createFolder, renameFolder, deleteFolder };