require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const searchRoutes = require('./routes/search');

const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(path.join(uploadsDir, 'media'), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'avatars'), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'thumbnails'), { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/search', searchRoutes);

// SPA fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: 'API route not found'
        });
    }

    const htmlPages = ['register', 'dashboard', 'profile'];
    const pageName = req.path.replace('/', '').replace('.html', '');

    if (htmlPages.includes(pageName)) {
        return res.sendFile(
            path.join(__dirname, '..', 'public', `${pageName}.html`)
        );
    }

    res.sendFile(
        path.join(__dirname, '..', 'public', 'index.html')
    );
});

// Error handler MUST be last
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(
        `\n🚀 NitrklShare server running at http://localhost:${PORT}\n`
    );
});