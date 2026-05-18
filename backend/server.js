const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2');
const config = require('./config/db.config');

// --- ROUTE IMPORTS ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const folderRoutes = require('./routes/folder');

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- STATIC FILE SERVING ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

db.connect((err) => {
    if (err) { console.error("DATABASE CONNECTION FAILED: " + err.message); return; }
    console.log("ERDMS DATABASE CONNECTED");
});

// --- AUDIT TRAIL HELPER ---
const createLog = (userId, action) => {
    db.query("INSERT INTO logs (user_id, action) VALUES (?, ?)", [userId, action], (err) => {
        if (err) console.error("Logging error:", err);
    });
};

// --- MODULAR ROUTES ---
app.use('/auth', authRoutes);    // /auth/login, /auth/register
app.use('/users', userRoutes);   // /users/, /users/:id

// --- FOLDER MANAGEMENT ---
app.get('/folders', (req, res) => {
    db.query("SELECT * FROM folder", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post('/folders', (req, res) => {
    const { name } = req.body;
    db.query("INSERT INTO folder (folder_name) VALUES (?)", [name], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// --- DOCUMENT VAULT ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
    const { title, folder_id, uploaded_by, category } = req.body;
    const filePath = req.file ? req.file.path : '';
    const sql = "INSERT INTO document (title, file_path, folder_id, uploaded_by, category) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [title, filePath, folder_id || null, uploaded_by, category || 'General'], (err) => {
        if (err) return res.status(500).json({ success: false });
        createLog(uploaded_by, `Uploaded Document: ${title}`);
        res.json({ success: true });
    });
});

app.get('/documents', (req, res) => {
    const search = req.query.search || '';
    const folderId = req.query.folderId || null;
    let sql = "SELECT * FROM document WHERE (title LIKE ? OR category LIKE ?)";
    let params = [`%${search}%`, `%${search}%`];
    if (folderId && folderId !== 'null' && folderId !== '') {
        sql += " AND folder_id = ?";
        params.push(folderId);
    }
    sql += " ORDER BY upload_date DESC";
    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// --- AUDIT LOGS ---
app.get('/logs', (req, res) => {
    const sql = `
        SELECT logs.*, user.name as user_name 
        FROM logs 
        LEFT JOIN user ON logs.user_id = user.id 
        ORDER BY action_time DESC
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// --- STATIC FILE SERVING ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- SERVER START ---
app.listen(3000, () => {
    console.log("ERDMS Backend Active on Port 3000");
});


// const authRoutes = require('./routes/auth');
// app.use('/auth', authRoutes);

// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');
// const multer = require('multer'); 
// const path = require('path');

// const app = express();

// // --- MIDDLEWARE ---
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // --- DATABASE CONNECTION ---
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'erdms_db'
// });

// db.connect((err) => {
//     if (err) {
//         console.error("DATABASE CONNECTION FAILED: " + err.message);
//         return;
//     }
//     console.log("-----------------------------------------");
//     console.log("  ERDMS PRODUCTION DATABASE CONNECTED   ");
//     console.log("-----------------------------------------");
// });

// // --- AUDIT TRAIL LOGGING ---
// const createLog = (userId, action) => {
//     const logSql = "INSERT INTO logs (user_id, action) VALUES (?, ?)";
//     db.query(logSql, [userId, action], (err) => {
//         if (err) console.error("Logging error:", err);
//     });
// };

// // --- AUTHENTICATION MODULE ---
// app.post('/login', (req, res) => {
//     const { name, password } = req.body;
//     const authSql = "SELECT * FROM user WHERE name = ? AND password = ?";
//     db.query(authSql, [name, password], (err, result) => {
//         if (err) return res.status(500).json({ success: false, error: err });
//         if (result.length > 0) {
//             const user = result[0];
//             createLog(user.id, "User Login Successful");
//             res.json({ 
//                 success: true, 
//                 role: user.role, 
//                 name: user.name, 
//                 id: user.id 
//             });
//         } else {
//             res.json({ success: false, message: "Invalid Credentials" });
//         }
//     });
// });

// // --- USER MANAGEMENT MODULE (FULL CRUD) ---
// app.get('/users', (req, res) => {
//     db.query("SELECT * FROM user ORDER BY name ASC", (err, result) => {
//         if (err) return res.status(500).json(err);
//         res.json(result);
//     });
// });

// // UPDATED: ADD USER WITH DUPLICATE CHECK
// app.post('/add-user', (req, res) => {
//     const { name, role, password } = req.body;

//     // 1. Check if name already exists
//     const checkSql = "SELECT * FROM user WHERE name = ?";
//     db.query(checkSql, [name], (err, results) => {
//         if (err) return res.status(500).json({ success: false, message: "Server error" });
        
//         if (results.length > 0) {
//             // Name exists, return error
//             return res.status(400).json({ success: false, message: "An account with this name already exists." });
//         }

//         // 2. Name is unique, proceed to insert
//         const sql = "INSERT INTO user (name, role, password, status) VALUES (?, ?, ?, 'Active')";
//         db.query(sql, [name, role, password], (err) => {
//             if (err) {
//                 console.error("Add User SQL Error:", err);
//                 return res.status(500).json({ success: false, message: err.message });
//             }
//             res.status(200).json({ success: true, message: "User Created Successfully" });
//         });
//     });
// });

// // THE UPDATE ROUTE (REINFORCED FOR SAVE BUTTON FIX)
// app.put('/update-user/:id', (req, res) => {
//     const userId = req.params.id;
//     const { name, role, status } = req.body;
    
//     console.log(`Updating User ID ${userId}:`, { name, role, status });

//     const sql = "UPDATE user SET name = ?, role = ?, status = ? WHERE id = ?";
//     db.query(sql, [name, role, status, userId], (err, result) => {
//         if (err) {
//             console.error("SQL UPDATE ERROR:", err);
//             return res.status(500).json({ success: false, message: err.message });
//         }
        
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ success: false, message: "No user found with that ID" });
//         }

//         res.json({ success: true, message: "User details updated in database" });
//     });
// });

// app.delete('/delete-user/:id', (req, res) => {
//     const userId = req.params.id;
//     db.query("SET FOREIGN_KEY_CHECKS = 0", (err) => {
//         const deleteSql = "DELETE FROM user WHERE id = ?";
//         db.query(deleteSql, [userId], (err) => {
//             db.query("SET FOREIGN_KEY_CHECKS = 1", () => {
//                 if (err) return res.status(500).json({ success: false });
//                 res.json({ success: true, message: "User Deleted Successfully" });
//             });
//         });
//     });
// });

// // --- FOLDER MANAGEMENT ---
// app.get('/folders', (req, res) => {
//     db.query("SELECT * FROM folder", (err, result) => {
//         if (err) return res.status(500).json(err);
//         res.json(result);
//     });
// });

// app.post('/folders', (req, res) => {
//     const { name } = req.body;
//     db.query("INSERT INTO folder (folder_name) VALUES (?)", [name], (err) => {
//         if (err) return res.status(500).json({ success: false });
//         res.json({ success: true });
//     });
// });

// // --- DOCUMENT VAULT (UPLOAD & SEARCH) ---
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => { cb(null, 'uploads/'); },
//     filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
// });
// const upload = multer({ storage: storage });

// app.post('/upload', upload.single('file'), (req, res) => {
//     const { title, folder_id, uploaded_by, category } = req.body;
//     const filePath = req.file ? req.file.path : '';
//     const sql = "INSERT INTO document (title, file_path, folder_id, uploaded_by, category) VALUES (?, ?, ?, ?, ?)";
//     db.query(sql, [title, filePath, folder_id || null, uploaded_by, category || 'General'], (err) => {
//         if (err) return res.status(500).json({ success: false });
//         createLog(uploaded_by, `Uploaded Document: ${title}`);
//         res.json({ success: true });
//     });
// });

// app.get('/documents', (req, res) => {
//     const search = req.query.search || '';
//     const folderId = req.query.folderId || null;
//     let sql = "SELECT * FROM document WHERE (title LIKE ? OR category LIKE ?)";
//     let params = [`%${search}%`, `%${search}%`];
//     if (folderId && folderId !== 'null' && folderId !== '') {
//         sql += " AND folder_id = ?";
//         params.push(folderId);
//     }
//     sql += " ORDER BY upload_date DESC";
//     db.query(sql, params, (err, result) => {
//         if (err) return res.status(500).json(err);
//         res.json(result);
//     });
// });

// // --- AUDIT TRAIL (JOINED TO SHOW USER NAMES) ---
// app.get('/logs', (req, res) => {
//     const sql = `
//         SELECT logs.*, user.name as user_name 
//         FROM logs 
//         LEFT JOIN user ON logs.user_id = user.id 
//         ORDER BY action_time DESC
//     `;
//     db.query(sql, (err, result) => {
//         if (err) return res.status(500).json(err);
//         res.json(result);
//     });
// });

// // --- STATIC ASSETS ---
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // --- SERVER START ---
// app.listen(3000, () => {
//     console.log("-----------------------------------------");
//     console.log("  ERDMS Backend Active on Port 3000     ");
//     console.log("  URL: http://localhost:3000            ");
//     console.log("-----------------------------------------");
// });