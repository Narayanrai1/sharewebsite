const express = require('express');
const { users, posts, likes } = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { q, page: pageStr } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = q.trim().toLowerCase();
    const page = parseInt(pageStr) || 1;
    const limit = 20;

    // Get all posts and score them
    const allPosts = await posts.find({});

    const scored = allPosts.map(post => {
      let score = 0;
      const titleLower = (post.title || '').toLowerCase();
      const descLower = (post.description || '').toLowerCase();
      const textLower = (post.content_text || '').toLowerCase();

      if (titleLower.includes(query)) score += 3;
      if (descLower.includes(query)) score += 2;
      if (textLower.includes(query)) score += 1;

      return { ...post, relevance_score: score };
    }).filter(p => p.relevance_score > 0);

    // Sort by relevance, then likes, then date
    scored.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
      if ((b.like_count || 0) !== (a.like_count || 0)) return (b.like_count || 0) - (a.like_count || 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });

    const total = scored.length;
    const offset = (page - 1) * limit;
    const paginated = scored.slice(offset, offset + limit);

    const userId = req.user ? req.user.id : null;
    const enriched = await Promise.all(paginated.map(async (post) => {
      const author = await users.findOne({ id: post.user_id });
      let liked_by_user = false;
      if (userId) {
        const like = await likes.findOne({ user_id: userId, post_id: post.id });
        liked_by_user = !!like;
      }
      return {
        ...post,
        username: author ? author.username : 'deleted',
        display_name: author ? author.display_name : 'Deleted User',
        author_avatar: author ? author.avatar_url : '',
        liked_by_user
      };
    }));

    res.json({
      posts: enriched,
      query: q.trim(),
      page,
      total_pages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
