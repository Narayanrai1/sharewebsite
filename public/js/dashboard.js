/**
 * NitrklShare — Dashboard Logic
 * Feed, search, create post, post detail, likes, comments
 */

(function () {
  // Auth guard
  if (!API.isLoggedIn()) {
    window.location.href = '/';
    return;
  }

  const currentUser = API.getUser();
  const socket = API.connectSocket();
  let currentPage = 1;
  let isSearchMode = false;
  let searchQuery = '';
  let selectedFile = null;
  let selectedThumbFile = null;
  let pdfFirstPageBlob = null;
  let currentContentType = 'text';
  let currentDetailPostId = null;

  socket.on('connect', () => {
    if (currentDetailPostId) socket.emit('post:join', currentDetailPostId);
  });
  socket.on('post:comment:new', (event) => {
    document.querySelectorAll('.post-card').forEach((card) => {
      if (card.dataset.postId === event.postId) {
        const count = card.querySelector('.comment-count');
        if (count && event.commentCount !== undefined) count.textContent = event.commentCount;
      }
    });

    if (currentDetailPostId === event.postId) {
      if (event.commentCount !== undefined) {
        document.getElementById('detail-comment-count').textContent = event.commentCount;
      }
      appendComment(event.comment);
    }
  });
  socket.on('post:like-count', (event) => {
    document.querySelectorAll('.post-card').forEach((card) => {
      if (card.dataset.postId === event.postId) {
        const count = card.querySelector('.like-count');
        if (count) count.textContent = event.likeCount;
      }
    });

    if (currentDetailPostId === event.postId) {
      document.getElementById('detail-like-count').textContent = event.likeCount;
    }
  });
  socket.on('notification:new', (notification) => {
    showToast(notification.message || 'You have a new notification', 'info');
  });

  // --- Initialize ---
  initNavbar();
  loadFeed();

  // --- Navbar ---
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

    // Dropdown toggle
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
  }

  // --- Feed ---
  async function loadFeed(page = 1) {
    const feedGrid = document.getElementById('feed-grid');
    const loading = document.getElementById('feed-loading');
    const emptyState = document.getElementById('empty-state');
    const loadMoreContainer = document.getElementById('load-more-container');

    if (page === 1) {
      feedGrid.innerHTML = '';
      loading.classList.remove('hidden');
    }

    try {
      const data = await API.getFeed(page);
      loading.classList.add('hidden');

      if (data.posts.length === 0 && page === 1) {
        emptyState.classList.remove('hidden');
        loadMoreContainer.classList.add('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      data.posts.forEach((post, i) => {
        const card = createPostCard(post, i);
        feedGrid.appendChild(card);
      });

      currentPage = page;
      if (page < data.total_pages) {
        loadMoreContainer.classList.remove('hidden');
      } else {
        loadMoreContainer.classList.add('hidden');
      }
    } catch (err) {
      loading.classList.add('hidden');
      showToast(err.message, 'error');
    }
  }

  // Load more button
  document.getElementById('load-more-btn').addEventListener('click', () => {
    if (isSearchMode) {
      performSearch(searchQuery, currentPage + 1);
    } else {
      loadFeed(currentPage + 1);
    }
  });

  // --- Search ---
  const searchInput = document.getElementById('search-input');
  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (!query) {
      exitSearchMode();
      return;
    }

    searchTimeout = setTimeout(() => {
      performSearch(query, 1);
    }, 400);
  });

  async function performSearch(query, page = 1) {
    isSearchMode = true;
    searchQuery = query;

    const feedGrid = document.getElementById('feed-grid');
    const feedHeader = document.getElementById('feed-header');
    const searchHeader = document.getElementById('search-results-header');
    const loading = document.getElementById('feed-loading');
    const emptyState = document.getElementById('empty-state');
    const loadMoreContainer = document.getElementById('load-more-container');

    feedHeader.classList.add('hidden');
    searchHeader.classList.remove('hidden');
    document.getElementById('search-query-display').textContent = query;

    if (page === 1) {
      feedGrid.innerHTML = '';
      loading.classList.remove('hidden');
    }

    try {
      const data = await API.search(query, page);
      loading.classList.add('hidden');

      document.getElementById('search-result-count').textContent = `${data.total} result${data.total !== 1 ? 's' : ''}`;

      if (data.posts.length === 0 && page === 1) {
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h3').textContent = 'No results found';
        emptyState.querySelector('p').textContent = 'Try different keywords or check spelling.';
        loadMoreContainer.classList.add('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      data.posts.forEach((post, i) => {
        const card = createPostCard(post, i);
        feedGrid.appendChild(card);
      });

      currentPage = page;
      if (page < data.total_pages) {
        loadMoreContainer.classList.remove('hidden');
      } else {
        loadMoreContainer.classList.add('hidden');
      }
    } catch (err) {
      loading.classList.add('hidden');
      showToast(err.message, 'error');
    }
  }

  document.getElementById('clear-search').addEventListener('click', () => {
    searchInput.value = '';
    exitSearchMode();
  });

  function exitSearchMode() {
    isSearchMode = false;
    searchQuery = '';
    document.getElementById('feed-header').classList.remove('hidden');
    document.getElementById('search-results-header').classList.add('hidden');
    const emptyState = document.getElementById('empty-state');
    emptyState.querySelector('h3').textContent = 'No posts yet';
    emptyState.querySelector('p').textContent = 'Be the first to share something! Click the + button to create a post.';
    emptyState.classList.add('hidden');
    loadFeed();
  }

  // --- Create Post Card ---
  function createPostCard(post, index) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;
    card.style.animationDelay = `${index * 0.05}s`;

    // Thumbnail
    let thumbnailHtml = '';
    const badgeClass = `badge-${post.content_type}`;

    if (post.content_type === 'image') {
      const imgSrc = post.thumbnail_url || post.media_url;
      thumbnailHtml = `
        <div class="card-thumbnail">
          <img src="${imgSrc}" alt="${escapeHtml(post.title)}" loading="lazy">
          <span class="content-badge ${badgeClass}">Image</span>
        </div>`;
    } else if (post.content_type === 'video') {
      if (post.thumbnail_url) {
        thumbnailHtml = `
          <div class="card-thumbnail">
            <img src="${post.thumbnail_url}" alt="${escapeHtml(post.title)}" loading="lazy">
            <div class="play-overlay" style="opacity:1;background:rgba(0,0,0,0.25);"><div class="play-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1E2C3A"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div></div>
            <span class="content-badge ${badgeClass}">Video</span>
          </div>`;
      } else {
        thumbnailHtml = `
          <div class="card-thumbnail video-preview">
            <video src="${post.media_url}" preload="metadata" muted></video>
            <div class="play-overlay"><div class="play-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1E2C3A"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div></div>
            <span class="content-badge ${badgeClass}">Video</span>
          </div>`;
      }
    } else if (post.content_type === 'audio') {
      if (post.thumbnail_url) {
        thumbnailHtml = `
          <div class="card-thumbnail">
            <img src="${post.thumbnail_url}" alt="${escapeHtml(post.title)}" loading="lazy">
            <span class="content-badge ${badgeClass}">Audio</span>
          </div>`;
      } else {
        thumbnailHtml = `
          <div class="card-thumbnail audio-preview">
            <div class="audio-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <span class="content-badge ${badgeClass}">Audio</span>
          </div>`;
      }
    } else if (post.content_type === 'pdf') {
      if (post.thumbnail_url) {
        thumbnailHtml = `
          <div class="card-thumbnail">
            <img src="${post.thumbnail_url}" alt="${escapeHtml(post.title)}" loading="lazy">
            <span class="content-badge ${badgeClass}">PDF</span>
          </div>`;
      } else {
        thumbnailHtml = `
          <div class="card-thumbnail pdf-preview">
            <div class="pdf-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>PDF</span>
            </div>
            <span class="content-badge ${badgeClass}">PDF</span>
          </div>`;
      }
    } else {
      const preview = post.content_text ? escapeHtml(post.content_text.substring(0, 200)) : '';
      thumbnailHtml = `
        <div class="card-thumbnail text-preview">
          <div class="text-content">"${preview}"</div>
          <span class="content-badge ${badgeClass}">Text</span>
        </div>`;
    }

    // Author avatar
    let authorAvatarHtml;
    if (post.author_avatar) {
      authorAvatarHtml = `<div class="mini-avatar"><img src="${post.author_avatar}" alt=""></div>`;
    } else {
      authorAvatarHtml = `<div class="mini-avatar">${getInitial(post.display_name)}</div>`;
    }

    card.innerHTML = `
      ${thumbnailHtml}
      <div class="card-body">
        <div class="card-title">${escapeHtml(post.title)}</div>
        ${post.description ? `<div class="card-desc">${escapeHtml(post.description)}</div>` : ''}
        <div class="card-footer">
          <div class="card-author">
            ${authorAvatarHtml}
            <span class="author-name">${escapeHtml(post.display_name)}</span>
          </div>
          <div class="card-stats">
            <div class="stat-item ${post.liked_by_user ? 'liked' : ''}">
              <svg viewBox="0 0 24 24" fill="${post.liked_by_user ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span class="like-count">${post.like_count}</span>
            </div>
            <div class="stat-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span class="comment-count">${post.comment_count}</span>
            </div>
          </div>
        </div>
      </div>`;

    // Navigate to post page — Ctrl+click or middle-click opens in new tab
    card.addEventListener('click', (e) => {
      const url = `/post.html?id=${post.id}`;
      if (e.ctrlKey || e.metaKey || e.button === 1) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    });
    // Support middle-click
    card.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        window.open(`/post.html?id=${post.id}`, '_blank');
      }
    });
    return card;
  }

  // --- Create Post Modal ---
  const createModal = document.getElementById('create-modal');

  document.getElementById('fab-create').addEventListener('click', () => {
    createModal.classList.add('active');
  });

  document.getElementById('close-create-modal').addEventListener('click', closeCreateModal);
  document.getElementById('cancel-create').addEventListener('click', closeCreateModal);

  createModal.addEventListener('click', (e) => {
    if (e.target === createModal) closeCreateModal();
  });

  function closeCreateModal() {
    createModal.classList.remove('active');
    resetCreateForm();
  }

  function resetCreateForm() {
    document.getElementById('post-title').value = '';
    document.getElementById('post-description').value = '';
    document.getElementById('post-text').value = '';
    selectedFile = null;
    selectedThumbFile = null;
    pdfFirstPageBlob = null;
    document.getElementById('file-input').value = '';
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('file-upload-area').style.display = '';
    document.getElementById('pdf-page-preview').classList.add('hidden');
    document.getElementById('optional-thumbnail-group').classList.add('hidden');
    document.getElementById('thumb-preview').classList.add('hidden');
    document.getElementById('thumb-upload-area').style.display = '';
    document.getElementById('thumb-file-input').value = '';
    selectContentType('text');
  }

  // Content type selection
  document.querySelectorAll('.type-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectContentType(btn.dataset.type);
    });
  });

  function selectContentType(type) {
    currentContentType = type;
    document.querySelectorAll('.type-option').forEach(b => b.classList.remove('active'));
    document.querySelector(`.type-option[data-type="${type}"]`).classList.add('active');

    const textGroup = document.getElementById('text-content-group');
    const mediaGroup = document.getElementById('media-upload-group');
    const uploadHint = document.getElementById('upload-hint');
    const optThumbGroup = document.getElementById('optional-thumbnail-group');
    const pdfPreview = document.getElementById('pdf-page-preview');

    // Reset optional thumb when switching types
    optThumbGroup.classList.add('hidden');
    pdfPreview.classList.add('hidden');

    if (type === 'text') {
      textGroup.classList.remove('hidden');
      mediaGroup.classList.add('hidden');
    } else {
      textGroup.classList.add('hidden');
      mediaGroup.classList.remove('hidden');

      const fileInput = document.getElementById('file-input');
      if (type === 'image') {
        fileInput.accept = 'image/*';
        uploadHint.textContent = 'Supports JPG, PNG, GIF, WebP up to 50MB';
      } else if (type === 'video') {
        fileInput.accept = 'video/*';
        uploadHint.textContent = 'Supports MP4, WebM, MOV up to 50MB';
        // Show optional thumbnail for video
        optThumbGroup.classList.remove('hidden');
      } else if (type === 'audio') {
        fileInput.accept = 'audio/*';
        uploadHint.textContent = 'Supports MP3, WAV, OGG, M4A up to 50MB';
        optThumbGroup.classList.remove('hidden');
      } else if (type === 'pdf') {
        fileInput.accept = '.pdf';
        uploadHint.textContent = 'Supports PDF files up to 50MB';
        optThumbGroup.classList.remove('hidden');
      }
    }
  }

  // File upload area
  const fileUploadArea = document.getElementById('file-upload-area');
  const fileInput = document.getElementById('file-input');

  fileUploadArea.addEventListener('click', () => fileInput.click());

  fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.classList.add('drag-over');
  });

  fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.classList.remove('drag-over');
  });

  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileSelect(e.target.files[0]);
    }
  });

  function handleFileSelect(file) {
    selectedFile = file;
    const preview = document.getElementById('file-preview');
    const previewThumb = document.getElementById('preview-thumb');
    const previewName = document.getElementById('preview-name');
    const previewSize = document.getElementById('preview-size');

    previewName.textContent = file.name;
    previewSize.textContent = formatFileSize(file.size);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => { previewThumb.src = e.target.result; };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      previewThumb.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%23A855F7" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>');
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      previewThumb.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%23EF4444" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>');
      // Render PDF first page as preview
      renderPdfFirstPage(file);
    } else {
      previewThumb.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%23F59E0B" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>');
    }

    preview.classList.remove('hidden');
    fileUploadArea.style.display = 'none';
  }

  // Render PDF first page using PDF.js
  async function renderPdfFirstPage(file) {
    if (!window.pdfjsLib) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);

      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = document.getElementById('pdf-canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Show the preview
      document.getElementById('pdf-page-preview').classList.remove('hidden');

      // Convert canvas to blob for auto-thumbnail (used if user doesn't provide custom one)
      canvas.toBlob((blob) => {
        pdfFirstPageBlob = blob;
      }, 'image/png');
    } catch (err) {
      console.error('PDF preview failed:', err);
    }
  }

  document.getElementById('remove-file').addEventListener('click', () => {
    selectedFile = null;
    pdfFirstPageBlob = null;
    fileInput.value = '';
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('pdf-page-preview').classList.add('hidden');
    fileUploadArea.style.display = '';
  });

  // --- Optional Thumbnail Upload ---
  const thumbUploadArea = document.getElementById('thumb-upload-area');
  const thumbFileInput = document.getElementById('thumb-file-input');

  thumbUploadArea.addEventListener('click', () => thumbFileInput.click());

  thumbFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleThumbSelect(e.target.files[0]);
    }
  });

  function handleThumbSelect(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Thumbnail must be an image', 'error');
      return;
    }
    selectedThumbFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('thumb-preview-img').src = e.target.result;
    };
    reader.readAsDataURL(file);
    document.getElementById('thumb-preview-name').textContent = file.name;
    document.getElementById('thumb-preview-size').textContent = formatFileSize(file.size);
    document.getElementById('thumb-preview').classList.remove('hidden');
    thumbUploadArea.style.display = 'none';
  }

  document.getElementById('remove-thumb').addEventListener('click', () => {
    selectedThumbFile = null;
    thumbFileInput.value = '';
    document.getElementById('thumb-preview').classList.add('hidden');
    thumbUploadArea.style.display = '';
  });

  // Submit post
  document.getElementById('submit-post').addEventListener('click', async () => {
    const title = document.getElementById('post-title').value.trim();
    const description = document.getElementById('post-description').value.trim();
    const contentText = document.getElementById('post-text').value.trim();
    const btn = document.getElementById('submit-post');

    if (!title) {
      showToast('Title is required', 'error');
      return;
    }

    if (currentContentType === 'text' && !contentText) {
      showToast('Text content is required', 'error');
      return;
    }

    if (['image', 'video', 'audio', 'pdf'].includes(currentContentType) && !selectedFile) {
      showToast('Please upload a file', 'error');
      return;
    }

    btn.classList.add('loading');

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('content_type', currentContentType);
      formData.append('content_text', contentText);
      if (selectedFile) formData.append('media', selectedFile);

      // Custom thumbnail takes priority
      if (selectedThumbFile) {
        formData.append('thumbnail', selectedThumbFile);
      } else if (currentContentType === 'pdf' && pdfFirstPageBlob) {
        // Auto-use PDF first page as thumbnail if no custom one provided
        formData.append('thumbnail', pdfFirstPageBlob, 'pdf_thumb.png');
      }

      await API.createPost(formData);
      showToast('Post published! 🎉', 'success');
      closeCreateModal();

      // Reload feed
      if (isSearchMode) {
        performSearch(searchQuery, 1);
      } else {
        loadFeed();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.classList.remove('loading');
    }
  });

  // --- Post Detail Modal ---
  const detailModal = document.getElementById('post-detail-modal');

  async function openPostDetail(postId) {
    currentDetailPostId = postId;
    socket.emit('post:join', postId);
    detailModal.classList.add('active');

    try {
      const post = await API.getPost(postId);
      renderPostDetail(post);
      loadComments(postId);
    } catch (err) {
      socket.emit('post:leave', postId);
      showToast(err.message, 'error');
      detailModal.classList.remove('active');
    }
  }

  function renderPostDetail(post) {
    document.getElementById('detail-title').textContent = post.title;

    // Media
    const mediaEl = document.getElementById('detail-media');
    if (post.content_type === 'image') {
      mediaEl.innerHTML = `<img src="${post.media_url}" alt="${escapeHtml(post.title)}">`;
      mediaEl.style.display = '';
    } else if (post.content_type === 'video') {
      mediaEl.innerHTML = `<video src="${post.media_url}" controls style="width:100%;max-height:400px"></video>`;
      mediaEl.style.display = '';
    } else if (post.content_type === 'audio') {
      mediaEl.innerHTML = `<audio src="${post.media_url}" controls style="width:90%;margin:32px auto"></audio>`;
      mediaEl.style.display = '';
    } else if (post.content_type === 'pdf') {
      mediaEl.innerHTML = `
        <div style="text-align:center;padding:var(--space-lg);">
          ${post.thumbnail_url ? `<img src="${post.thumbnail_url}" alt="PDF Preview" style="max-height:300px;margin:0 auto var(--space-md);border-radius:var(--radius-md);">` : ''}
          <a href="${post.media_url}" target="_blank" class="btn btn-primary" style="display:inline-flex;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Open PDF
          </a>
        </div>`;
      mediaEl.style.display = '';
    } else {
      mediaEl.innerHTML = '';
      mediaEl.style.display = 'none';
    }

    // Meta
    let authorAvatarHtml;
    if (post.author_avatar) {
      authorAvatarHtml = `<div class="mini-avatar"><img src="${post.author_avatar}" alt=""></div>`;
    } else {
      authorAvatarHtml = `<div class="mini-avatar">${getInitial(post.display_name)}</div>`;
    }
    document.getElementById('detail-meta').innerHTML = `
      <div class="card-author">
        ${authorAvatarHtml}
        <span class="author-name" style="cursor:pointer" onclick="window.location.href='/profile.html?user=${post.username}'">${escapeHtml(post.display_name)} · @${post.username}</span>
      </div>
      <span style="color:var(--text-muted);font-size:0.8rem">${timeAgo(post.created_at)}</span>
    `;

    // Description
    const descEl = document.getElementById('detail-description');
    if (post.description) {
      descEl.textContent = post.description;
      descEl.style.display = '';
    } else {
      descEl.style.display = 'none';
    }

    // Text content
    const textEl = document.getElementById('detail-text');
    if (post.content_text) {
      textEl.textContent = post.content_text;
      textEl.style.display = '';
    } else {
      textEl.style.display = 'none';
    }

    // Like button
    const likeBtn = document.getElementById('detail-like-btn');
    document.getElementById('detail-like-count').textContent = post.like_count;
    if (post.liked_by_user) {
      likeBtn.classList.add('liked');
      likeBtn.querySelector('svg').setAttribute('fill', 'currentColor');
    } else {
      likeBtn.classList.remove('liked');
      likeBtn.querySelector('svg').setAttribute('fill', 'none');
    }

    document.getElementById('detail-comment-count').textContent = post.comment_count;

    // Delete button (only for own posts)
    const deleteBtn = document.getElementById('detail-delete-btn');
    if (currentUser && post.user_id === currentUser.id) {
      deleteBtn.style.display = '';
    } else {
      deleteBtn.style.display = 'none';
    }
  }

  // Close detail modal
  document.getElementById('close-detail-modal').addEventListener('click', () => {
    if (currentDetailPostId) socket.emit('post:leave', currentDetailPostId);
    detailModal.classList.remove('active');
    currentDetailPostId = null;
  });
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) {
      if (currentDetailPostId) socket.emit('post:leave', currentDetailPostId);
      detailModal.classList.remove('active');
      currentDetailPostId = null;
    }
  });

  // Like button
  document.getElementById('detail-like-btn').addEventListener('click', async () => {
    if (!currentDetailPostId) return;
    try {
      const result = await API.toggleLike(currentDetailPostId);
      document.getElementById('detail-like-count').textContent = result.like_count;
      const likeBtn = document.getElementById('detail-like-btn');
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

  // Delete button
  document.getElementById('detail-delete-btn').addEventListener('click', async () => {
    if (!currentDetailPostId) return;
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      await API.deletePost(currentDetailPostId);
      socket.emit('post:leave', currentDetailPostId);
      showToast('Post deleted', 'success');
      detailModal.classList.remove('active');
      currentDetailPostId = null;
      loadFeed();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // --- Comments ---
  async function loadComments(postId) {
    const list = document.getElementById('comment-list');
    list.innerHTML = '';

    try {
      const comments = await API.getComments(postId);
      if (comments.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No comments yet. Be the first!</p>';
        return;
      }

      comments.forEach(comment => appendComment(comment, list));
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }

  function appendComment(comment, list = document.getElementById('comment-list')) {
    if (!comment || !list) return;

    const commentId = String(comment.id || '');
    if (commentId && Array.from(list.querySelectorAll('.comment-item'))
      .some(item => item.dataset.commentId === commentId)) {
      return;
    }

    const emptyMessage = list.querySelector('p');
    if (emptyMessage) emptyMessage.remove();

    const avatarHtml = comment.author_avatar
      ? `<div class="mini-avatar"><img src="${comment.author_avatar}" alt=""></div>`
      : `<div class="mini-avatar">${getInitial(comment.display_name)}</div>`;

    const item = document.createElement('div');
    item.className = 'comment-item';
    item.dataset.commentId = commentId;
    item.innerHTML = `
      ${avatarHtml}
      <div class="comment-body">
        <span class="comment-author">${escapeHtml(comment.display_name)}</span>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
        <div class="comment-time">${timeAgo(comment.created_at)}</div>
      </div>`;
    list.appendChild(item);
  }

  // Submit comment
  document.getElementById('submit-comment').addEventListener('click', submitComment);
  document.getElementById('comment-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitComment();
  });

  async function submitComment() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text || !currentDetailPostId) return;

    try {
      const comment = await API.addComment(currentDetailPostId, text);
      input.value = '';
      appendComment(comment);

      try {
        const updatedPost = await API.getPost(currentDetailPostId);
        document.getElementById('detail-comment-count').textContent = updatedPost.comment_count;
      } catch (err) {
        console.error('Failed to refresh comment count:', err);
      }

      showToast('Comment added', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      createModal.classList.remove('active');
      if (currentDetailPostId) socket.emit('post:leave', currentDetailPostId);
      detailModal.classList.remove('active');
      currentDetailPostId = null;
    }
  });

})();
