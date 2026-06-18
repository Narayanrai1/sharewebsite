# 📱 NitrklShare

A modern, feature-rich social media platform built with Node.js and vanilla JavaScript. Share posts, connect with users, and build your community with a beautiful Telegram-inspired design.

## ✨ Features

- **User Authentication** — Secure registration and login with JWT tokens
- **Create & Share Posts** — Post content with images and descriptions
- **Like System** — Engage with posts by liking them
- **Comments** — Add comments to posts for community discussion
- **User Profiles** — View user profiles with post history and statistics
- **Search** — Find posts by title, description, or content
- **Responsive Design** — Beautiful glassmorphism UI with Telegram-inspired aesthetics
- **Real-time Updates** — Dynamic feed and live post engagement

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: NeDB (embedded NoSQL)
- **Authentication**: JWT (JSON Web Tokens)
- **Design**: Glassmorphism with CSS Custom Properties

## 📁 Project Structure

```
sharewebsite/
├── public/                 # Frontend files
│   ├── index.html         # Landing page
│   ├── register.html      # Registration page
│   ├── dashboard.html     # Main feed
│   ├── profile.html       # User profiles
│   ├── post.html          # Individual post view
│   ├── css/
│   │   └── style.css      # Main stylesheet with design system
│   └── js/
│       ├── api.js         # Centralized API client
│       ├── dashboard.js   # Feed logic
│       ├── profile.js     # Profile page logic
│       ├── post.js        # Post page logic
│       └── auth.js        # Authentication logic
├── server/
│   ├── index.js           # Express app entry point
│   ├── db.js              # Database initialization
│   ├── middleware/
│   │   └── auth.js        # JWT authentication middleware
│   └── routes/
│       ├── auth.js        # Authentication endpoints
│       ├── posts.js       # Post CRUD operations
│       ├── comments.js    # Comment endpoints
│       └── search.js      # Search functionality
├── data/                  # NeDB database files (auto-created)
├── package.json           # Dependencies
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Narayanrai1/sharewebsite.git
   cd sharewebsite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   JWT_SECRET=your_jwt_secret_key_here
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   
   Navigate to `http://localhost:3000`

## 📖 API Documentation

### Authentication Routes

- `POST /api/auth/register` — Create a new account
- `POST /api/auth/login` — Login with email and password
- `GET /api/auth/me` — Get current user info
- `GET /api/auth/user/:username` — Get user profile
- `PUT /api/auth/profile` — Update profile (requires auth)

### Posts Routes

- `POST /api/posts` — Create a new post (requires auth)
- `GET /api/posts/feed` — Get paginated feed
- `GET /api/posts/:id` — Get specific post
- `GET /api/posts/user/:username` — Get user's posts
- `DELETE /api/posts/:id` — Delete post (requires auth)
- `POST /api/posts/:id/like` — Toggle like (requires auth)

### Comments Routes

- `GET /api/posts/:postId/comments` — Get post comments
- `POST /api/posts/:postId/comments` — Add comment (requires auth)

### Search Routes

- `GET /api/search?q=keyword&page=1` — Search posts

## 🎨 Design System

The application uses a premium design system with:

- **Color Palette**: Telegram-inspired blues (#2AABEE), emerald accents (#34D399), and dark backgrounds
- **Typography**: Inter and Outfit font families
- **Effects**: Glassmorphism, gradient overlays, and smooth animations
- **Responsive Grid**: Optimized for desktop, tablet, and mobile

## 🔐 Security Features

- **JWT Authentication** — Secure token-based authentication
- **Password Hashing** — Passwords are securely hashed before storage
- **Unique Constraints** — Email and username uniqueness enforced at database level
- **Authorization Checks** — Protected routes verify user identity

## 📊 Database Schema

### Users Collection
```javascript
{
  id,
  username (unique),
  email (unique),
  password_hash,
  display_name,
  bio,
  avatar_url,
  post_count,
  total_likes,
  created_at
}
```

### Posts Collection
```javascript
{
  id,
  user_id,
  title,
  description,
  content_text,
  image_url,
  like_count,
  comment_count,
  created_at
}
```

### Comments Collection
```javascript
{
  id,
  post_id,
  user_id,
  text,
  created_at
}
```

### Likes Collection
```javascript
{
  id,
  user_id,
  post_id,
  created_at
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the MIT License.

## 👤 Author

**Narayan Rai**
- GitHub: [@Narayanrai1](https://github.com/Narayanrai1)

## 🙏 Acknowledgments

- Inspired by modern social media platforms like Telegram
- Built with clean, maintainable code principles
- Designed with user experience in mind

---

**Happy Sharing!** 🎉
