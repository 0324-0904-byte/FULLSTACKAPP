const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const folderRoutes = require('./routes/folderRoutes');
const documentRoutes = require('./routes/documentRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Expose public files asset directory path strings
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route Middleware Registrations
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', folderRoutes);
app.use('/api', documentRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Modular Server live on port ${PORT}`));