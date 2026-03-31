/**
 * NitrklShare — Post Detail Page Logic
 * Full page view for a single post with comments
 */

(function () {
  // Auth check (optional — allow viewing posts without login but restrict actions)
  const currentUser = API.getUser();
  const token = API.getToken();

  // Get post ID from URL
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (!postId) {
    document.getElementById('post-loading').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
    return;
  }

  // --- Init Navbar ---
  initNavbar();
  loadPost();

  function initNavbar() {
    const avatarInitial = document.getElementById('nav-avatar-initial');
    const dropdownName = document.getElementById('dropdown-name');
    const dropdownUsername = document.getElementById('dropdown-username');
    const navAvatar = document.getElementById('nav-avatar');

    if (currentUser) {
      avatarInitial.textContent = getInitial(currentUser.display_name);
      dropdownName.textContent = currentUser.display_name;
      dropdownUsername.textContent = '@' + currentUser.username;

      if (currentUser.avatar_url) {
        navAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="avatar">`;
      }
    } else {
      avatarInitial.textContent = '?';
      dropdownName.textContent = 'Guest';
      dropdownUsername.textContent = 'Not signed in';
    }

    navAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('profile-dropdown').classList.toggle('active');
    });

    document.addEventListener('click', () => {
      document.getElementById('profile-dropdown').classList.remove('active');
    });

    document.getElementById('btn-my-profile').addEventListener('click', () => {
      if (currentUser) {
        window.location.href = `/profile.html?user=${currentUser.username}`;
      } else {
        window.location.href = '/';
      }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      API.clearAuth();
      window.location.href = '/';
    });

    // Search redirect to dashboard
    document.getElementById('search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        window.location.href = `/dashboard.html?search=${encodeURIComponent(e.target.value.trim())}`;
      }
    });
  }

  // --- Load Post ---
  async function loadPost() {
    const loading = document.getElementById('post-loading');
    const article = document.getElementById('post-article');
    const errorState = document.getElementById('error-state');

    try {
      const post = await API.getPost(postId);
      loading.classList.add('hidden');
      article.classList.remove('hidden');

      // Update page title
      document.title = `${post.title} — NitrklShare`;

      renderPost(post);
      loadComments();
    } catch (err) {
      loading.classList.add('hidden');
      errorState.classList.remove('hidden');
    }
  }

  function renderPost(post) {
    // --- Media (full width, no shrinking) ---
    const mediaEl = document.getElementById('post-media');
    if (post.content_type === 'image') {
      mediaEl.innerHTML = `<img src="${post.media_url}" alt="${escapeHtml(post.title)}" class="post-page-image">`;
    } else if (post.content_type === 'video') {
      mediaEl.innerHTML = `<video src="${post.media_url}" controls class="post-page-video"></video>`;
    } else if (post.content_type === 'audio') {
      mediaEl.innerHTML = `
        <div class="post-page-audio-container">
          <div class="audio-visual">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.5">
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
          </div>
          <audio src="${post.media_url}" controls class="post-page-audio"></audio>
        </div>`;
    } else if (post.content_type === 'pdf') {
      mediaEl.innerHTML = `
        <div class="post-page-pdf-container">
          ${post.thumbnail_url ? `<img src="${post.thumbnail_url}" alt="PDF Preview" class="post-page-pdf-preview">` : ''}
          <a href="${post.media_url}" target="_blank" class="btn btn-primary" style="margin-top:var(--space-md);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Open PDF
          </a>
        </div>`;
    } else {
      mediaEl.style.display = 'none';
    }

    // --- Title ---
    document.getElementById('post-title').textContent = post.title;

    // --- Meta (author + date) ---
    let authorAvatarHtml;
    if (post.author_avatar) {
      authorAvatarHtml = `<div class="mini-avatar"><img src="${post.author_avatar}" alt=""></div>`;
    } else {
      authorAvatarHtml = `<div class="mini-avatar">${getInitial(post.display_name)}</div>`;
    }
    document.getElementById('post-meta').innerHTML = `
      <div class="card-author">
        ${authorAvatarHtml}
        <a href="/profile.html?user=${post.username}" class="author-name">${escapeHtml(post.display_name)} · @${post.username}</a>
      </div>
      <span class="post-page-date">${timeAgo(post.created_at)}</span>
    `;

    // --- Description ---
    const descEl = document.getElementById('post-description');
    if (post.description) {
      descEl.textContent = post.description;
      descEl.style.display = '';
    } else {
      descEl.style.display = 'none';
    }

    // --- Text content ---
    const textEl = document.getElementById('post-text');
    if (post.content_text) {
      textEl.textContent = post.content_text;
      textEl.style.display = '';
    } else {
      textEl.style.display = 'none';
    }

    // --- Like button ---
    const likeBtn = document.getElementById('like-btn');
    document.getElementById('like-count').textContent = post.like_count;
    if (post.liked_by_user) {
      likeBtn.classList.add('liked');
      likeBtn.querySelector('svg').setAttribute('fill', 'currentColor');
    }

    document.getElementById('comment-count').textContent = post.comment_count;

    // --- Delete button ---
    const deleteBtn = document.getElementById('delete-btn');
    if (currentUser && post.user_id === currentUser.id) {
      deleteBtn.style.display = '';
    }

    // --- Event Listeners ---
    likeBtn.addEventListener('click', async () => {
      if (!token) {
        showToast('Please sign in to like posts', 'error');
        return;
      }
      try {
        const result = await API.toggleLike(postId);
        document.getElementById('like-count').textContent = result.like_count;
        if (result.liked) {
          likeBtn.classList.add('liked');
          likeBtn.querySelector('svg').setAttribute('fill', 'currentColor');
        } else {
          likeBtn.classList.remove('liked');
          likeBtn.querySelector('svg').setAttribute('fill', 'none');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this post?')) return;
      try {
        await API.deletePost(postId);
        showToast('Post deleted', 'success');
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 500);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --- Comments ---
  async function loadComments() {
    const list = document.getElementById('comment-list');
    list.innerHTML = '';

    try {
      const comments = await API.getComments(postId);
      if (comments.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No comments yet. Be the first!</p>';
        return;
      }

      comments.forEach(comment => {
        let avatarHtml;
        if (comment.author_avatar) {
          avatarHtml = `<div class="mini-avatar"><img src="${comment.author_avatar}" alt=""></div>`;
        } else {
          avatarHtml = `<div class="mini-avatar">${getInitial(comment.display_name)}</div>`;
        }

        const item = document.createElement('div');
        item.className = 'comment-item';
        item.innerHTML = `
          ${avatarHtml}
          <div class="comment-body">
            <span class="comment-author">${escapeHtml(comment.display_name)}</span>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            <div class="comment-time">${timeAgo(comment.created_at)}</div>
          </div>`;
        list.appendChild(item);
      });
    } catch (err) {
      // Silently fail
    }
  }

  // Submit comment
  document.getElementById('submit-comment').addEventListener('click', submitComment);
  document.getElementById('comment-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitComment();
  });

  async function submitComment() {
    if (!token) {
      showToast('Please sign in to comment', 'error');
      return;
    }

    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;

    try {
      await API.addComment(postId, text);
      input.value = '';

      const countEl = document.getElementById('comment-count');
      countEl.textContent = parseInt(countEl.textContent) + 1;

      loadComments();
      showToast('Comment added', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

})();
