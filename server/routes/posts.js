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
// Get feed (sorted by most likes)
router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    // Unauthenticated feed results can be served from cache.
    const cacheKey = `feed:page:${page}:limit:${limit}`;
    if (!req.user) {
      const cached = await getCache(cacheKey);
      if (cached) return res.json(cached);
    }

    // Include each post's author in the same database query.
    const { count: total, rows: allPosts } = await Post.findAndCountAll({
      include: [{
        model: User,
        attributes: ['username', 'display_name', 'avatar_url']
      }],
      order: [['like_count', 'DESC'], ['created_at', 'DESC']],
      offset,
      limit
    });

    // Fetch this user's likes for the whole page in one query.
    let likedPostIds = new Set();
    if (req.user && allPosts.length > 0) {
      const likes = await Like.findAll({
        attributes: ['post_id'],
        where: {
          user_id: req.user.id,
          post_id: allPosts.map(post => post.id)
        }
      });
      likedPostIds = new Set(likes.map(like => like.post_id));
    }

    const enriched = allPosts.map(post => {
      const { User: author, ...postData } = post.toJSON();

      return {
        ...postData,
        username: author ? author.username : 'deleted',
        display_name: author ? author.display_name : 'Deleted User',
        author_avatar: author ? author.avatar_url : '',
        liked_by_user: req.user ? likedPostIds.has(post.id) : false
      };
    });

    const responseData = {
      posts: enriched,
      page,
      total_pages: Math.ceil(total / limit),
      total
    };

    // Cache only unauthenticated results, which don't depend on the viewer.
    if (!req.user) {
      await setCache(cacheKey, responseData, TTL.FEED);
    }

    res.json(responseData);
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
// Get single post
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    // const post = await posts.findOne({ id: req.params.id });
    const postResult = await pool.query(
    `SELECT *
     FROM posts
     WHERE id = $1`,
    [req.params.id]
    );

     const post = postResult.rows[0];
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
    // const user = await users.findOne({ username: req.params.username });
    // if (!user) return res.status(404).json({ error: 'User not found' });
    const userResult = await pool.query(
    `SELECT *
     FROM users
     WHERE username = $1`,
    [req.params.username]
    );

    const user = userResult.rows[0];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // const userPosts = await posts.find({ user_id: user.id }).sort({ created_at: -1 }).skip(skip).limit(limit);
    const postsResult = await pool.query(
    `SELECT *
     FROM posts
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [user.id, limit, skip]
    );

    const userPosts = postsResult.rows;
    // const total = await posts.count({ user_id: user.id });
    const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM posts
     WHERE user_id = $1`,
    [user.id]
    );

    const total = parseInt(countResult.rows[0].count);

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
    // const post = await posts.findOne({ id: req.params.id });
    const postResult = await pool.query(
      `SELECT *
      FROM posts
      WHERE id = $1`,
      [req.params.id]
    );

    const post = postResult.rows[0];
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

    // await comments.remove({ post_id: req.params.id }, { multi: true });
    // await likes.remove({ post_id: req.params.id }, { multi: true });
    // await posts.remove({ id: req.params.id });
    await pool.query(
    `DELETE FROM posts
     WHERE id = $1`,
    [req.params.id]
    );
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle like
router.post('/:id/like', authMiddleware, async (req, res) => {
    try {
        // 1. Check whether the post exists
        const postResult = await pool.query(
            `SELECT *
             FROM posts
             WHERE id = $1`,
            [req.params.id]
        );

        const post = postResult.rows[0];

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // 2. Check whether this user already liked the post
        const likeResult = await pool.query(
            `SELECT id
             FROM likes
             WHERE user_id = $1 AND post_id = $2`,
            [req.user.id, req.params.id]
        );

        const existingLike = likeResult.rows[0];

        // 3. Unlike
        if (existingLike) {
            await pool.query(
                `DELETE FROM likes
                 WHERE id = $1`,
                [existingLike.id]
            );

            await pool.query(
                `UPDATE posts
                 SET like_count = GREATEST(0, COALESCE(like_count, 0) - 1)
                 WHERE id = $1`,
                [req.params.id]
            );

            const updatedResult = await pool.query(
                `SELECT like_count
                 FROM posts
                 WHERE id = $1`,
                [req.params.id]
            );

            const updated = updatedResult.rows[0];

            return res.json({
                liked: false,
                like_count: updated.like_count
            });
        }

        // 4. Like
        await pool.query(
            `INSERT INTO likes
             (id, user_id, post_id, created_at)
             VALUES ($1, $2, $3, $4)`,
            [
                uuidv4(),
                req.user.id,
                req.params.id,
                new Date()
            ]
        );

        await pool.query(
            `UPDATE posts
             SET like_count = COALESCE(like_count, 0) + 1
             WHERE id = $1`,
            [req.params.id]
        );

        const updatedResult = await pool.query(
            `SELECT like_count
             FROM posts
             WHERE id = $1`,
            [req.params.id]
        );

        const updated = updatedResult.rows[0];

        res.json({
            liked: true,
            like_count: updated.like_count
        });

    } catch (err) {
        console.error('Like error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});
// Get comments for a post
router.get('/:id/comments', async (req, res) => {
    try {
        const commentsResult = await pool.query(
            `SELECT *
             FROM comments
             WHERE post_id = $1
             ORDER BY created_at ASC`,
            [req.params.id]
        );

        const postComments = commentsResult.rows;

        const enriched = await Promise.all(
            postComments.map(async (c) => {
                const authorResult = await pool.query(
                    `SELECT username, display_name, avatar_url
                     FROM users
                     WHERE id = $1`,
                    [c.user_id]
                );

                const author = authorResult.rows[0];

                return {
                    ...c,
                    username: author ? author.username : 'deleted',
                    display_name: author ? author.display_name : 'Deleted User',
                    author_avatar: author ? author.avatar_url : ''
                };
            })
        );

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

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: 'Comment text is required'
            });
        }

        // Check that the post exists
        const postResult = await pool.query(
            `SELECT id
             FROM posts
             WHERE id = $1`,
            [req.params.id]
        );

        const post = postResult.rows[0];

        if (!post) {
            return res.status(404).json({
                error: 'Post not found'
            });
        }

        // Create comment
        const id = uuidv4();
        const createdAt = new Date();

        await pool.query(
            `INSERT INTO comments
             (id, user_id, post_id, text, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                id,
                req.user.id,
                req.params.id,
                text.trim(),
                createdAt
            ]
        );

        // Increase comment count
        await pool.query(
            `UPDATE posts
             SET comment_count = COALESCE(comment_count, 0) + 1
             WHERE id = $1`,
            [req.params.id]
        );

        // Get author
        const authorResult = await pool.query(
            `SELECT username, display_name, avatar_url
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        const author = authorResult.rows[0];

        res.status(201).json({
            id,
            user_id: req.user.id,
            post_id: req.params.id,
            text: text.trim(),
            created_at: createdAt,
            username: author ? author.username : 'deleted',
            display_name: author ? author.display_name : 'Deleted User',
            author_avatar: author ? author.avatar_url : ''
        });

    } catch (err) {
        console.error('Add comment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
