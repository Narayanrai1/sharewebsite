const express = require('express');
const pool = require('../db-postgres');
const { getCache, setCache } = require('../cache');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const requestedPage = parseInt(req.query.page, 10) || 1;
    const page = Math.max(requestedPage, 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const userId = req.user ? req.user.id : null;

    // Cache public results only; authenticated results include user-specific likes.
    const cacheKey =
      `search:v1:${encodeURIComponent(query.toLowerCase())}:page:${page}`;

    if (!userId) {
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const pattern = `%${query}%`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM posts p
       WHERE p.title ILIKE $1
          OR p.description ILIKE $1
          OR p.content_text ILIKE $1`,
      [pattern]
    );

    const postsResult = await pool.query(
      `SELECT
         p.*,
         u.username,
         u.display_name,
         u.avatar_url AS author_avatar,
         CASE
           WHEN p.title ILIKE $1 THEN 3
           ELSE 0
         END
         + CASE
           WHEN p.description ILIKE $1 THEN 2
           ELSE 0
         END
         + CASE
           WHEN p.content_text ILIKE $1 THEN 1
           ELSE 0
         END AS relevance_score,
         EXISTS (
           SELECT 1
           FROM likes l
           WHERE l.post_id = p.id
             AND l.user_id = $4
         ) AS liked_by_user
       FROM posts p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.title ILIKE $1
          OR p.description ILIKE $1
          OR p.content_text ILIKE $1
       ORDER BY relevance_score DESC, p.like_count DESC, p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [pattern, limit, offset, userId]
    );

    const total = Number(countResult.rows[0].total);

    const responseData = {
      posts: postsResult.rows,
      query,
      page,
      total_pages: Math.ceil(total / limit),
      total
    };

    if (!userId) {
      await setCache(cacheKey, responseData, 60);
    }

    res.json(responseData);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;