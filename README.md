# NitrklShare

A social sharing platform built with Node.js, Express, PostgreSQL, and vanilla JavaScript. Users can publish posts, interact through likes and comments, view profiles, and search posts.

## Features

- Account registration and login
- JWT-based authentication
- Posts with text and media
- Likes and comments
- User profiles and post statistics
- Search by post title, description, or content
- Responsive web interface

## Technology

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js and Express
- **Database:** PostgreSQL, accessed through Sequelize
- **Authentication:** JSON Web Tokens
- **Uploads:** Local media and avatar upload directories

## Project layout

```text
sharewebsite/
├── public/                 # Frontend pages, styles, and scripts
├── server/
│   ├── index.js            # Express app and server startup
│   ├── db.js               # PostgreSQL connection and Sequelize models
│   ├── cache.js            # Cache helpers
│   ├── redis.js            # Redis connection
│   ├── middleware/
│   │   └── auth.js         # Authentication middleware
│   └── routes/
│       ├── auth.js         # Registration, login, and profile routes
│       ├── posts.js        # Posts, likes, and comments
│       └── search.js       # Post search
├── uploads/                # Uploaded files; created by the server
├── package.json
└── README.md
```

## Run locally

### Requirements

- Node.js and npm
- A PostgreSQL database
- Redis if you want to use the cache

### Setup

1. Install the project dependencies:

   ```bash
   npm install
   ```

2. Configure the server’s environment privately in a local `.env` file. Set the database connection, authentication secret, and any other settings required for your environment. Do not share the file or commit its contents.

3. Start the server:

   ```bash
   npm start
   ```

   For development with automatic restarts:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser, or use the port configured for your environment.

The server connects to PostgreSQL and synchronizes its Sequelize models at startup. Keep database credentials and authentication secrets out of source control and public messages. The `.env` file is excluded by `.gitignore`.

## API routes

### Authentication and profiles

- `POST /api/auth/register` — Create an account
- `POST /api/auth/login` — Log in
- `GET /api/auth/me` — Get the authenticated user
- `GET /api/auth/user/:username` — Get a user profile
- `PUT /api/auth/profile` — Update the authenticated user’s profile

### Posts, likes, and comments

- `POST /api/posts` — Create a post (authentication required)
- `GET /api/posts/feed` — Get the paginated feed
- `GET /api/posts/:id` — Get a post
- `GET /api/posts/user/:username` — Get a user’s posts
- `DELETE /api/posts/:id` — Delete the authenticated user’s post
- `POST /api/posts/:id/like` — Toggle a like (authentication required)
- `GET /api/posts/:id/comments` — Get a post’s comments
- `POST /api/posts/:id/comments` — Add a comment (authentication required)

### Search

- `GET /api/search?q=keyword&page=1` — Search posts by title, description, or content

## Database

The server defines Sequelize models for these PostgreSQL tables:

- **users** — Account details, password hash, profile information, and creation time
- **posts** — Author, content, media links, engagement counts, and creation time
- **likes** — User-to-post likes
- **comments** — Post comments and author references

The search route also uses Sequelize models, so search queries run against PostgreSQL.

## Uploaded files

The server creates upload directories for media and avatars when it starts. These uploaded files are runtime data; arrange persistent storage separately when deploying to an environment where the application filesystem is temporary.

## Security

- Passwords are hashed before storage.
- Protected routes require a valid authentication token.
- Database credentials and authentication secrets should remain private and must not be committed.
- Uploaded files and local environment configuration are excluded from Git.