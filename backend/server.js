const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
const config = require('./config/db.config');

const app = express();

// --- 1. GLOBAL SECURITY MIDDLEWARE (MUST RUN FIRST) ---
app.use(cors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 2. STATIC FILE SERVING ---
app.use('/uploads', (req, res, next) => {
    // Manually force CORS policy alignment for asset delivery requests
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
}, express.static(path.join(__dirname, '../uploads')));

// --- 3. DEDICATED ROUTE IMPORTS ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const folderRoutes = require('./routes/folder');
const documentRoutes = require('./routes/document');
const logRoutes = require('./routes/log');
const profileRoutes = require('./routes/profile');

// --- 4. MODULAR ROUTE MOUNTING ---
app.use('/auth', authRoutes);   
app.use('/users', userRoutes);  
app.use('/', folderRoutes);     
app.use('/', documentRoutes);   
app.use('/', logRoutes);    
app.use('/profile', profileRoutes);    

// --- 5. DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME
});

db.connect((err) => {
    if (err) { 
        console.error("DATABASE CONNECTION FAILED: " + err.message); 
        return; 
    }
    console.log("ERDMS DATABASE CONNECTED");
});

// --- 6. SERVER START ---
app.listen(3000, () => {
    console.log("ERDMS Backend Active on Port 3000");
});