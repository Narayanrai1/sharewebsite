const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./db-postgres');

function attachSocketServer(httpServer) {
  const io = new Server(httpServer);

  // Allow guests for public post updates; authenticate users who provide a token.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      socket.data.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = { id: decoded.id };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Derive the private room from the verified token, never from client input.
    if (socket.data.user) {
      socket.join(`user:${socket.data.user.id}`);
    }

    // Subscribe to a public post room after checking that the post exists.
    socket.on('post:join', async (postId) => {
      if (typeof postId !== 'string' || postId.length > 100) return;

      try {
        const result = await pool.query(
          'SELECT id FROM posts WHERE id = $1',
          [postId]
        );

        if (result.rows.length === 0) return;

        if (socket.data.currentPostRoom) {
          await socket.leave(socket.data.currentPostRoom);
        }

        const room = `post:${postId}`;
        await socket.join(room);
        socket.data.currentPostRoom = room;
      } catch (err) {
        console.error('Post room join error:', err);
      }
    });

    socket.on('post:leave', async (postId) => {
      const room = `post:${postId}`;

      if (socket.data.currentPostRoom === room) {
        await socket.leave(room);
        socket.data.currentPostRoom = null;
      }
    });
  });

  return io;
}

module.exports = attachSocketServer;