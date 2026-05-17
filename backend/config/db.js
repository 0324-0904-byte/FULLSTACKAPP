const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fullstack_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Using a promise wrapper handles clean query flows
const db = pool.promise();

pool.getConnection((err, connection) => {
    if (err) console.error("Database connection failed:", err);
    else {
        console.log("Connected to MySQL Database Pool.");
        connection.release();
    }
});

module.exports = db;