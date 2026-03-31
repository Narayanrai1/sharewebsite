const Datastore = require('nedb-promises');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const users = Datastore.create({ filename: path.join(dataDir, 'users.db'), autoload: true });
const posts = Datastore.create({ filename: path.join(dataDir, 'posts.db'), autoload: true });
const likes = Datastore.create({ filename: path.join(dataDir, 'likes.db'), autoload: true });
const comments = Datastore.create({ filename: path.join(dataDir, 'comments.db'), autoload: true });

// Indexes
users.ensureIndex({ fieldName: 'email', unique: true });
users.ensureIndex({ fieldName: 'username', unique: true });
likes.ensureIndex({ fieldName: 'user_id' });
likes.ensureIndex({ fieldName: 'post_id' });
posts.ensureIndex({ fieldName: 'user_id' });
posts.ensureIndex({ fieldName: 'like_count' });
comments.ensureIndex({ fieldName: 'post_id' });

module.exports = { users, posts, likes, comments };
