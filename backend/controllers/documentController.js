const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { logAction } = require('../middleware/logger');

const uploadDir = path.join(__dirname, '../uploads');

const getDocuments = async (req, res) => {
    try {
        const { folder_id, search } = req.query;
        let sql = `SELECT d.*, f.folder_name, u.name AS uploader_name 
                   FROM documents d 
                   LEFT JOIN folders f ON d.folder_id = f.id 
                   LEFT JOIN users u ON d.uploaded_by = u.id 
                   WHERE 1=1`;
        let params = [];

        if (folder_id && folder_id !== 'null' && folder_id !== '') {
            sql += " AND d.folder_id = ?";
            params.push(folder_id);
        }
        if (search) {
            sql += " AND (d.title LIKE ? OR d.category LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const uploadDocument = async (req, res) => {
    try {
        const { title, category, folder_id, user_id } = req.body;
        const targetFolder = (folder_id && folder_id !== 'null' && folder_id !== '') ? folder_id : null;
        const filePath = req.file ? req.file.filename : '';
        
        const sql = "INSERT INTO documents (title, file_path, folder_id, uploaded_by, category) VALUES (?, ?, ?, ?, ?)";
        await db.query(sql, [title, filePath, targetFolder, user_id, category]);
        await logAction(user_id, `Uploaded Document: ${title}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateDocument = async (req, res) => {
    try {
        const { title, category, folder_id, user_id } = req.body;
        const targetFolder = (folder_id === 'null' || !folder_id) ? null : folder_id;
        
        const sql = "UPDATE documents SET title = ?, category = ?, folder_id = ? WHERE id = ?";
        await db.query(sql, [title, category, targetFolder, req.params.id]);
        await logAction(user_id, `Modified document metadata ID ${req.params.id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const userId = req.query.user_id;
        const [records] = await db.query("SELECT file_path, title FROM documents WHERE id = ?", [req.params.id]);
        
        if (records.length > 0) {
            const filepath = path.join(uploadDir, records[0].file_path);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            
            await db.query("DELETE FROM documents WHERE id = ?", [req.params.id]);
            await logAction(userId, `Deleted Document: ${records[0].title}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const [results] = await db.query("SELECT file_path, title FROM documents WHERE id = ?", [req.params.id]);
        if (results.length === 0) return res.status(404).json({ error: "File not found" });
        
        await logAction(req.query.user_id, `Downloaded Document: ${results[0].title}`);
        res.download(path.join(uploadDir, results[0].file_path));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updatePermissions = async (req, res) => {
    try {
        const { folder_id, user_id, can_view, can_upload } = req.body;
        const sql = `INSERT INTO folder_permissions (folder_id, user_id, can_view, can_upload) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE can_view = ?, can_upload = ?`;
        await db.query(sql, [folder_id, user_id, can_view, can_upload, can_view, can_upload]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getLogs = async (req, res) => {
    try {
        const [results] = await db.query("SELECT l.*, u.name AS user_name FROM logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.action_time DESC");
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getDocuments, uploadDocument, updateDocument, deleteDocument, downloadDocument, updatePermissions, getLogs };