/**
 * NitrklShare — API Client
 * Centralized API wrapper with JWT token management
 */

const API = {
  BASE: '',

  getToken() {
    return localStorage.getItem('nitrklshare_token');
  },

  setToken(token) {
    localStorage.setItem('nitrklshare_token', token);
  },

  getUser() {
    const raw = localStorage.getItem('nitrklshare_user');
    return raw ? JSON.parse(raw) : null;
  },

  setUser(user) {
    localStorage.setItem('nitrklshare_user', JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem('nitrklshare_token');
    localStorage.removeItem('nitrklshare_user');
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  async request(method, path, body, isFormData = false) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const options = { method, headers };
    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    try {
      const res = await fetch(`${this.BASE}${path}`, options);
      const data = await res.json();

      if (res.status === 401) {
        this.clearAuth();
        window.location.href = '/';
        return null;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth
  async login(email, password) {
    const data = await this.request('POST', '/api/auth/login', { email, password });
    if (data) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async register(username, email, password, display_name) {
    const data = await this.request('POST', '/api/auth/register', { username, email, password, display_name });
    if (data) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async getMe() {
    return this.request('GET', '/api/auth/me');
  },

  async getUserByUsername(username) {
    return this.request('GET', `/api/auth/user/${username}`);
  },

  async updateProfile(formData) {
    return this.request('PUT', '/api/auth/profile', formData, true);
  },

  // Posts
  async createPost(formData) {
    return this.request('POST', '/api/posts', formData, true);
  },

  async getFeed(page = 1) {
    return this.request('GET', `/api/posts/feed?page=${page}`);
  },

  async getPost(id) {
    return this.request('GET', `/api/posts/${id}`);
  },

  async getUserPosts(username, page = 1) {
    return this.request('GET', `/api/posts/user/${username}?page=${page}`);
  },

  async deletePost(id) {
    return this.request('DELETE', `/api/posts/${id}`);
  },

  async toggleLike(id) {
    return this.request('POST', `/api/posts/${id}/like`);
  },

  async getComments(postId) {
    return this.request('GET', `/api/posts/${postId}/comments`);
  },

  async addComment(postId, text) {
    return this.request('POST', `/api/posts/${postId}/comments`, { text });
  },

  // Search
  async search(query, page = 1) {
    return this.request('GET', `/api/search?q=${encodeURIComponent(query)}&page=${page}`);
  }
};

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format relative time
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  // Handle both ISO strings with and without 'Z'
  let date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    date = new Date(dateStr + 'Z');
  }
  if (isNaN(date.getTime())) return '';
  const diff = Math.floor((now - date) / 1000);

  if (diff < 0) return 'just now';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}


// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get initial from name
function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}
