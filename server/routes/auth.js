const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

//
// const { users, posts } = require('../db');
const pool = require('../db-postgres');
//
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Avatar upload config
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed for avatars'));
  }
});

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, display_name } = req.body;

    if (!username || !email || !password || !display_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // const existingEmail = await users.findOne({ email: email.toLowerCase() });
    // const existingUser = await users.findOne({ username });
    // if (existingEmail || existingUser) {
    //   return res.status(409).json({ error: 'Username or email already taken' });
    // }


    const existingUser = await pool.query(
    `SELECT id FROM users
     WHERE email = $1 OR username = $2`,
    [email.toLowerCase(), username]
    );

    if (existingUser.rows.length > 0) {
        return res.status(409).json({
            error: 'Username or email already taken'
        });
    }

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);

    // const newUser = await users.insert({
    //   id,
    //   username,
    //   email: email.toLowerCase(),
    //   password_hash,
    //   display_name,
    //   bio: '',
    //   avatar_url: '',
    //   created_at: new Date().toISOString()
    // });

  await pool.query(
  `INSERT INTO users
   (id, username, email, password_hash, display_name, bio, avatar_url, created_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [
    id,
    username,
    email.toLowerCase(),
    password_hash,
    display_name,
    '',
    '',
    new Date()
  ]
  );

    const user = { id, username, email: email.toLowerCase(), display_name };
    const token = generateToken(user);

    res.status(201).json({ token, user: { ...user, bio: '', avatar_url: '' } });
  } catch (err) {
    console.error('Register error:', err);
    if (err.errorType === 'uniqueViolated') {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const postsResult = await pool.query(
      `SELECT like_count FROM posts WHERE user_id = $1`,
      [req.user.id]
    );

    const userPosts = postsResult.rows;

    const postCount = userPosts.length;

    const likeCount = userPosts.reduce(
      (sum, p) => sum + (p.like_count || 0),
      0
    );

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      post_count: postCount,
      total_likes: likeCount
    });

  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by username
router.get('/user/:username', async (req, res) => {
  try {
    const user = await users.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userPosts = await posts.find({ user_id: user.id });
    const postCount = userPosts.length;
    const likeCount = userPosts.reduce((sum, p) => sum + (p.like_count || 0), 0);

    res.json({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      post_count: postCount,
      total_likes: likeCount
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    const { display_name, bio } = req.body;

    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (req.file) {
      updates.avatar_url = `/uploads/avatars/${req.file.filename}`;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await users.update({ id: req.user.id }, { $set: updates });
    const user = await users.findOne({ id: req.user.id });

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
