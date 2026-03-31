/**
 * NitrklShare — Profile Page Logic
 * Load user profile, user's posts, edit profile
 */

(function () {
  // Auth guard
  if (!API.isLoggedIn()) {
    window.location.href = '/';
    return;
  }

  const currentUser = API.getUser();
  const urlParams = new URLSearchParams(window.location.search);
  const profileUsername = urlParams.get('user') || currentUser.username;
  const isOwnProfile = profileUsername === currentUser.username;

  // Init navbar
  initNavbar();
  loadProfile();

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
    }

    navAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('profile-dropdown').classList.toggle('active');
    });

    document.addEventListener('click', () => {
      document.getElementById('profile-dropdown').classList.remove('active');
    });

    document.getElementById('btn-my-profile').addEventListener('click', () => {
      window.location.href = `/profile.html?user=${currentUser.username}`;
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      API.clearAuth();
      window.location.href = '/';
    });

    // Search redirect
    document.getElementById('search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        window.location.href = `/dashboard.html`;
      }
    });
  }

  async function loadProfile() {
    try {
      const user = await API.getUserByUsername(profileUsername);
      renderProfile(user);
      loadUserPosts();
    } catch (err) {
      showToast('Could not load profile', 'error');
    }
  }

  function renderProfile(user) {
    document.title = `${user.display_name} — NitrklShare`;
    document.getElementById('profile-display-name').textContent = user.display_name;
    document.getElementById('profile-username').textContent = '@' + user.username;
    document.getElementById('profile-bio').textContent = user.bio || 'No bio yet.';
    document.getElementById('profile-posts-count').textContent = user.post_count;
    document.getElementById('profile-likes-count').textContent = user.total_likes;
    document.getElementById('posts-section-title').textContent = `${user.display_name}'s Posts`;

    const avatarEl = document.getElementById('profile-large-avatar');
    if (user.avatar_url) {
      avatarEl.innerHTML = `<img src="${user.avatar_url}" alt="avatar">`;
    } else {
      document.getElementById('profile-avatar-initial').textContent = getInitial(user.display_name);
    }

    // Edit button (only for own profile)
    const editArea = document.getElementById('edit-profile-area');
    if (isOwnProfile) {
      editArea.innerHTML = `<button class="btn btn-secondary" id="btn-edit-profile">Edit Profile</button>`;
      document.getElementById('btn-edit-profile').addEventListener('click', () => {
        showEditForm(user);
      });
    }
  }

  function showEditForm(user) {
    const container = document.getElementById('edit-profile-form-container');
    container.classList.remove('hidden');
    document.getElementById('edit-display-name').value = user.display_name;
    document.getElementById('edit-bio').value = user.bio || '';
  }

  document.getElementById('cancel-edit-profile').addEventListener('click', () => {
    document.getElementById('edit-profile-form-container').classList.add('hidden');
  });

  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    const displayName = document.getElementById('edit-display-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const avatarFile = document.getElementById('edit-avatar').files[0];

    if (displayName) formData.append('display_name', displayName);
    formData.append('bio', bio);
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
      const updated = await API.updateProfile(formData);
      // Update stored user
      const stored = API.getUser();
      stored.display_name = updated.display_name;
      stored.bio = updated.bio;
      stored.avatar_url = updated.avatar_url;
      API.setUser(stored);

      showToast('Profile updated! ✨', 'success');
      document.getElementById('edit-profile-form-container').classList.add('hidden');

      // Re-render
      loadProfile();
      initNavbar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  async function loadUserPosts() {
    const grid = document.getElementById('profile-posts-grid');
    const empty = document.getElementById('profile-empty');
    grid.innerHTML = '';

    try {
      const data = await API.getUserPosts(profileUsername);
      if (data.posts.length === 0) {
        empty.classList.remove('hidden');
        return;
      }

      empty.classList.add('hidden');
      data.posts.forEach((post, i) => {
        const card = createProfilePostCard(post, i);
        grid.appendChild(card);
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function createProfilePostCard(post, index) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const badgeClass = `badge-${post.content_type}`;
    let thumbnailHtml = '';

    if (post.content_type === 'image') {
      const imgSrc = post.thumbnail_url || post.media_url;
      thumbnailHtml = `<div class="card-thumbnail"><img src="${imgSrc}" alt="${escapeHtml(post.title)}" loading="lazy"><span class="content-badge ${badgeClass}">Image</span></div>`;
    } else if (post.content_type === 'video') {
      thumbnailHtml = `<div class="card-thumbnail video-preview"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg><span class="content-badge ${badgeClass}">Video</span></div>`;
    } else if (post.content_type === 'audio') {
      thumbnailHtml = `<div class="card-thumbnail audio-preview"><div class="audio-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div><span class="content-badge ${badgeClass}">Audio</span></div>`;
    } else {
      const preview = post.content_text ? escapeHtml(post.content_text.substring(0, 200)) : '';
      thumbnailHtml = `<div class="card-thumbnail text-preview"><div class="text-content">"${preview}"</div><span class="content-badge ${badgeClass}">Text</span></div>`;
    }

    card.innerHTML = `
      ${thumbnailHtml}
      <div class="card-body">
        <div class="card-title">${escapeHtml(post.title)}</div>
        ${post.description ? `<div class="card-desc">${escapeHtml(post.description)}</div>` : ''}
        <div class="card-footer">
          <span style="font-size:0.75rem;color:var(--text-muted)">${timeAgo(post.created_at)}</span>
          <div class="card-stats">
            <div class="stat-item ${post.liked_by_user ? 'liked' : ''}">
              <svg viewBox="0 0 24 24" fill="${post.liked_by_user ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              ${post.like_count}
            </div>
            <div class="stat-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              ${post.comment_count}
            </div>
          </div>
        </div>
      </div>`;

    // Click to go to dashboard (we could open modal but simpler to redirect)
    card.addEventListener('click', () => {
      window.location.href = `/dashboard.html`;
    });

    return card;
  }
})();
