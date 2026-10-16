const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// const { users, posts, likes, comments } = require('../db');
const pool = require('../db-postgres');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'media');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 },
  fileFilter: (req, file, cb) => {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
    const pdfExts = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    // Allow image files for the thumbnail field
    if (file.fieldname === 'thumbnail') {
      if (imageExts.includes(ext)) cb(null, true);
      else cb(new Error('Thumbnail must be an image file'));
      return;
    }
    const allAllowed = [...imageExts, ...videoExts, ...audioExts, ...pdfExts];
    if (allAllowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  }
});

// Accept two fields: 'media' (the main file) and 'thumbnail' (optional custom thumbnail)
const uploadFields = upload.fields([
  { name: 'media', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

// Helper to enrich post with author info
async function enrichPost(post, userId) {
    const authorResult = await pool.query(
        `SELECT username, display_name, avatar_url
         FROM users
         WHERE id = $1`,
        [post.user_id]
    );

    const author = authorResult.rows[0];

    let liked_by_user = false;

    if (userId) {
        const likeResult = await pool.query(
            `SELECT 1
             FROM likes
             WHERE user_id = $1 AND post_id = $2`,
            [userId, post.id]
        );

        liked_by_user = likeResult.rows.length > 0;
    }

    return {
        ...post,
        username: author ? author.username : 'deleted',
        display_name: author ? author.display_name : 'Deleted User',
        author_avatar: author ? author.avatar_url : '',
        liked_by_user
    };
}
// Create post
router.post('/', authMiddleware, uploadFields, async (req, res) => {
  try {
    const { title, description, content_type, content_text } = req.body;

    if (!title || !content_type) {
      return res.status(400).json({ error: 'Title and content type are required' });
    }

    if (!['text', 'image', 'video', 'audio', 'pdf'].includes(content_type)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    if (content_type === 'text' && !content_text) {
      return res.status(400).json({ error: 'Text content is required for text posts' });
    }

    const mediaFile = req.files && req.files['media'] ? req.files['media'][0] : null;
    const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

    if (['image', 'video', 'audio', 'pdf'].includes(content_type) && !mediaFile) {
      return res.status(400).json({ error: 'Media file is required for this content type' });
    }

    const id = uuidv4();
    let media_url = '';
    let thumbnail_url = '';

    if (mediaFile) {
      media_url = `/uploads/media/${mediaFile.filename}`;
      // For images, use the same file as thumbnail
      if (content_type === 'image') {
        thumbnail_url = media_url;
      }
    }

    // If user provided a custom thumbnail (optional for video/audio/pdf), use it
    if (thumbnailFile) {
      thumbnail_url = `/uploads/media/${thumbnailFile.filename}`;
    }

    await pool.query(
    `INSERT INTO posts
    (id, user_id, title, description, content_type, content_text,
      media_url, thumbnail_url, like_count, comment_count, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      req.user.id,
      title,
      description || '',
      content_type,
      content_text || '',
      media_url,
      thumbnail_url,
      0,
      0,
      new Date()
    ]
    );
    const postResult = await pool.query(
    `SELECT * FROM posts WHERE id = $1`,
    [id]
    );

    const newPost = postResult.rows[0];
    const enriched = await enrichPost(newPost, req.user.id);
    res.status(201).json(enriched);
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get feed (sorted by most likes)
router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // const allPosts = await posts.find({}).sort({ like_count: -1, created_at: -1 }).skip(skip).limit(limit);
    const postsResult = await pool.query(
    `SELECT *
     FROM posts
     ORDER BY like_count DESC, created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, skip]
    );

    const allPosts = postsResult.rows;
    // const total = await posts.count({});
    const countResult = await pool.query(
    `SELECT COUNT(*) FROM posts`
    );

    const total = parseInt(countResult.rows[0].count);

    const userId = req.user ? req.user.id : null;
    const enriched = await Promise.all(allPosts.map(p => enrichPost(p, userId)));

    res.json({
      posts: enriched,
      page,
      total_pages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single post
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await posts.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const userId = req.user ? req.user.id : null;
    const enriched = await enrichPost(post, userId);
    res.json(enriched);
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's posts
router.get('/user/:username', optionalAuth, async (req, res) => {
  try {
    const user = await users.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const userPosts = await posts.find({ user_id: user.id }).sort({ created_at: -1 }).skip(skip).limit(limit);
    const total = await posts.count({ user_id: user.id });

    const userId = req.user ? req.user.id : null;
    const enriched = await Promise.all(userPosts.map(p => enrichPost(p, userId)));

    res.json({ posts: enriched, page, total_pages: Math.ceil(total / limit), total });
  } catch (err) {
    console.error('User posts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete post
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await posts.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    // Delete media files
    if (post.media_url) {
      const mediaPath = path.join(__dirname, '..', '..', post.media_url);
      if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
    }
    if (post.thumbnail_url && post.thumbnail_url !== post.media_url) {
      const thumbPath = path.join(__dirname, '..', '..', post.thumbnail_url);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }

    await comments.remove({ post_id: req.params.id }, { multi: true });
    await likes.remove({ post_id: req.params.id }, { multi: true });
    await posts.remove({ id: req.params.id });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle like
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const post = await posts.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existingLike = await likes.findOne({ user_id: req.user.id, post_id: req.params.id });

    if (existingLike) {
      await likes.remove({ _id: existingLike._id });
      await posts.update({ id: req.params.id }, { $set: { like_count: Math.max(0, (post.like_count || 0) - 1) } });
      const updated = await posts.findOne({ id: req.params.id });
      res.json({ liked: false, like_count: updated.like_count });
    } else {
      await likes.insert({ id: uuidv4(), user_id: req.user.id, post_id: req.params.id, created_at: new Date().toISOString() });
      await posts.update({ id: req.params.id }, { $set: { like_count: (post.like_count || 0) + 1 } });
      const updated = await posts.findOne({ id: req.params.id });
      res.json({ liked: true, like_count: updated.like_count });
    }
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get comments for a post
router.get('/:id/comments', async (req, res) => {
  try {
    const postComments = await comments.find({ post_id: req.params.id }).sort({ created_at: 1 });
    const enriched = await Promise.all(postComments.map(async (c) => {
      const author = await users.findOne({ id: c.user_id });
      return {
        ...c,
        username: author ? author.username : 'deleted',
        display_name: author ? author.display_name : 'Deleted User',
        author_avatar: author ? author.avatar_url : ''
      };
    }));
    res.json(enriched);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required' });

    const post = await posts.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const id = uuidv4();
    const newComment = await comments.insert({
      id,
      user_id: req.user.id,
      post_id: req.params.id,
      text: text.trim(),
      created_at: new Date().toISOString()
    });

    await posts.update({ id: req.params.id }, { $set: { comment_count: (post.comment_count || 0) + 1 } });

    const author = await users.findOne({ id: req.user.id });
    res.status(201).json({
      ...newComment,
      username: author.username,
      display_name: author.display_name,
      author_avatar: author.avatar_url
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
