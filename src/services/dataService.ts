import { Place, Review } from "../types";
import { io } from "socket.io-client";
import { getUnsplashImage } from "./unsplashService";

// Connect to the local server
const socket = io();

async function robustFetch(url: string, options?: RequestInit, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      
      // Stop immediately for quota or missing errors, even if they are HTML
      if (res.status === 429 || res.status === 404) {
        return res;
      }

      // Check if response is HTML when we expect JSON
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        const text = await res.text();
        // If it's a rate limit message in HTML form, treat as 429
        if (text.toLowerCase().includes("rate exceeded") || text.toLowerCase().includes("too many requests")) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded upstream" }), { 
            status: 429, 
            headers: { "Content-Type": "application/json" } 
          });
        }
        console.error(`Endpoint ${url} returned HTML instead of JSON. First 100 chars: ${text.slice(0, 100)}`);
        throw new Error(`Expected JSON but received HTML from ${url}. Check server route registration.`);
      }

      if (!res.ok) {
        try {
          const clone = res.clone();
          const text = await clone.text();
          console.warn(`Fetch ${url} returned ${res.status}: ${text.slice(0, 100)}`);
        } catch (e) {
          console.warn(`Fetch ${url} returned ${res.status}`);
        }
      }
      return res;
    } catch (err) {
      if (i === retries) {
        console.error(`Robust fetch failed for ${url} after ${retries + 1} attempts:`, err);
        throw err;
      }
      const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
      console.warn(`Fetch ${url} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("UNREACHABLE");
}

export const dataService = {
  events: new EventTarget(),
  _places: [] as Place[],
  _users: [] as any[],
  _reviews: [] as Review[],
  _hashtags: [] as any[],
  _groups: [] as any[],
  _posts: [] as any[],
  _ratings: [] as any[],
  _isInitialized: false,

  init() {
    if (this._isInitialized) return;
    this._isInitialized = true;
    
    socket.on("change", (payload) => {
      const { table, eventType, new: newData, old } = payload;
      
      if (table === "places") {
        const mapped = newData ? this.mapPlace(newData) : null;
        if (eventType === "INSERT" && mapped) this._places = [mapped, ...this._places];
        if (eventType === "UPDATE" && mapped) this._places = this._places.map(p => p.id === mapped.id ? mapped : p);
        if (eventType === "DELETE") this._places = this._places.filter(p => p.id !== old.id);
      } else if (table === "users") {
        if (eventType === "INSERT") this._users = [newData, ...this._users];
        if (eventType === "UPDATE") this._users = this._users.map(u => u.id === newData.id ? newData : u);
        if (eventType === "DELETE") this._users = this._users.filter(u => u.id !== old.id);
      } else if (table === "reviews") {
        const mapped = newData ? this.mapReview(newData) : null;
        if (eventType === "INSERT" && mapped) this._reviews = [mapped, ...this._reviews];
        if (eventType === "UPDATE" && mapped) this._reviews = this._reviews.map(r => r.id === mapped.id ? mapped : r);
        if (eventType === "DELETE") this._reviews = this._reviews.filter(r => r.id !== old.id);
      } else if (table === "communities") {
        const mapped = newData ? this.mapGroup(newData) : null;
        if (eventType === "INSERT" && mapped) this._groups = [mapped, ...this._groups];
        if (eventType === "UPDATE" && mapped) this._groups = this._groups.map(g => g.id === mapped.id ? mapped : g);
        if (eventType === "DELETE") this._groups = this._groups.filter(g => g.id !== old.id);
      } else if (table === "messages") {
        // We'll handle messages specifically in the chat room component mainly, 
        // but can keep global sync if needed
        this.events.dispatchEvent(new CustomEvent("messages_change", { detail: payload }));
      } else if (table === "user_posts") {
        if (eventType === "INSERT") this._posts = [newData, ...this._posts];
        if (eventType === "DELETE") this._posts = this._posts.filter((p: any) => p.id !== old.id);
      } else if (table === "post_likes" || table === "post_comments") {
        this.events.dispatchEvent(new CustomEvent(`${table}_change`, { detail: payload }));
      } else if (table === "trending_hashtags") {
        const mapped = newData ? this.mapHashtag(newData) : null;
        if (eventType === "INSERT" && mapped) this._hashtags = [mapped, ...this._hashtags];
        if (eventType === "UPDATE" && mapped) this._hashtags = this._hashtags.map(h => h.id === mapped.id ? mapped : h);
        if (eventType === "DELETE") this._hashtags = this._hashtags.filter(h => h.id !== old.id);
      }

      this.events.dispatchEvent(new CustomEvent("change", { detail: payload }));
    });
  },

  // API Calls for Social Feed
  async getPosts() {
    try {
      const res = await robustFetch("/api/posts");
      if (!res.ok) return [];
      this._posts = await res.json();
      return this._posts;
    } catch (err) {
      console.error("getPosts failed:", err);
      return [];
    }
  },

  async addPost(post: { user_id: string; username: string; media_url: string; caption: string }) {
    const res = await robustFetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post)
    });
    return await res.json();
  },

  async getPostEngagement(postId: string) {
    try {
      const res = await robustFetch(`/api/posts/${postId}/engagement`);
      if (!res.ok) return { likes: 0, comments: [] };
      return await res.json();
    } catch (err) {
      return { likes: 0, comments: [] };
    }
  },

  async togglePostLike(postId: string, userId: string) {
    const res = await robustFetch(`/api/posts/${postId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    return await res.json();
  },

  async addPostComment(postId: string, userId: string, username: string, commentText: string) {
    const res = await robustFetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username, commentText })
    });
    return await res.json();
  },

  // Website Rating Calls
  async getWebsiteRatings() {
    try {
      const res = await robustFetch("/api/website-ratings");
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      return [];
    }
  },

  async addWebsiteRating(rating: { user_id: string; rating: number; review_text: string }) {
    const res = await robustFetch("/api/website-ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rating)
    });
    return await res.json();
  },

  async getAverageWebsiteRating() {
    try {
      const res = await robustFetch("/api/website-ratings/average");
      if (!res.ok) return 0;
      const data = await res.json();
      return data.average || 0;
    } catch (err) {
      return 0;
    }
  },

  // Map backend data to frontend types
  mapPlace(p: any): Place {
    const safeP = p || {};
    return {
      id: safeP.id || '',
      name: safeP.name || '',
      description: safeP.description || '',
      address: safeP.address || '',
      imageUrl: safeP.imageUrl || safeP.image_url || safeP.image || '',
      rating: safeP.rating || 0,
      latitude: safeP.latitude || 0,
      longitude: safeP.longitude || 0,
      priceLevel: safeP.priceLevel || safeP.price_level || 1,
      addedBy: safeP.addedBy || safeP.added_by || '',
      isFeatured: safeP.isFeatured || safeP.is_featured || false,
      isVerified: safeP.isVerified || safeP.is_verified || false,
      ...safeP,
      category: Array.isArray(safeP.category) ? safeP.category : (typeof safeP.category === 'string' ? JSON.parse(safeP.category || "[]") : []),
      createdAt: safeP.createdAt || safeP.created_at || new Date().toISOString()
    };
  },

  mapReview(r: any): Review {
    const safeR = r || {};
    return {
      id: safeR.id || '',
      placeId: safeR.placeId || safeR.place_id || '',
      userId: safeR.userId || safeR.user_id || '',
      userName: safeR.userName || safeR.user_name || 'Unknown User',
      userAvatar: safeR.userAvatar || safeR.user_avatar || '',
      rating: safeR.rating || 0,
      comment: safeR.comment || '',
      likes: safeR.likes || 0,
      ...safeR,
      replies: Array.isArray(safeR.replies) ? safeR.replies : JSON.parse(safeR.replies || "[]"),
      createdAt: safeR.createdAt || safeR.created_at || new Date().toISOString()
    };
  },

  mapGroup(g: any): any {
    const safeG = g || {};
    return {
      id: safeG.id || '',
      name: safeG.name || '',
      description: safeG.description || '',
      imageUrl: safeG.imageUrl || safeG.image_url || '',
      memberCount: safeG.memberCount || safeG.member_count || 0,
      createdBy: safeG.createdBy || safeG.created_by || '',
      createdAt: safeG.createdAt || safeG.created_at || new Date().toISOString()
    };
  },

  mapHashtag(h: any): any {
    const safeH = h || {};
    return {
      id: safeH.id || '',
      name: safeH.name || '',
      updatesCount: safeH.updatesCount || safeH.updates_count || 0
    };
  },

  // API Calls
  _placesPromise: null as Promise<Place[]> | null,
  async getPlaces() {
    if (this._placesPromise) return this._placesPromise;
    this._placesPromise = (async () => {
      try {
        const res = await robustFetch("/api/places");
        if (!res.ok) return this._places;
        const data = await res.json();
        if (!Array.isArray(data)) {
          console.error("Expected array from /api/places, got:", data);
          return this._places;
        }
        this._places = data.map((p: any) => this.mapPlace(p));
        return this._places;
      } catch (e) {
        console.error("getPlaces failed:", e);
        return this._places;
      } finally {
        this._placesPromise = null;
      }
    })();
    return this._placesPromise;
  },

  async getPlaceById(id: string) {
    try {
      const res = await robustFetch(`/api/places/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      return this.mapPlace(data);
    } catch (e) {
      console.error(`getPlaceById(${id}) failed:`, e);
      return null;
    }
  },

  async addPlace(place: Omit<Place, "id" | "createdAt" | "rating">) {
    let finalImageUrl = place.imageUrl || '';
    
    // Check if the image is empty or a generic mock/default placeholder link, and fetch from Unsplash
    if (
      !finalImageUrl || 
      finalImageUrl.includes("images.unsplash.com/photo-1517248135467") ||
      finalImageUrl.includes("images.unsplash.com/photo-1542314831") ||
      finalImageUrl.includes("images.unsplash.com/photo-1554118811") ||
      finalImageUrl.includes("unsplash.com/photo-1501339847") ||
      finalImageUrl.includes("unsplash.com/photo-1507842217") ||
      finalImageUrl.includes("unsplash.com/photo-1507525428") ||
      finalImageUrl.includes("images.unsplash.com/photo-1555396273") ||
      finalImageUrl.includes("images.unsplash.com/photo-15821423069") ||
      finalImageUrl.includes("api.dicebear.com")
    ) {
      try {
        const cat = Array.isArray(place.category) ? place.category[0] : (place.category || "General");
        const unsplashUrl = await getUnsplashImage(place.name, cat);
        if (unsplashUrl) {
          finalImageUrl = unsplashUrl;
        }
      } catch (e) {
        console.warn("Unsplash dynamic fetch in dataService failed, using default fallback.", e);
      }
    }

    const placeWithUnsplash = { ...place, imageUrl: finalImageUrl };

    const res = await robustFetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(placeWithUnsplash)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("API Error adding place:", data);
      throw new Error(data.hint || data.error || "Gagal menyimpan tempat ke arsip.");
    }
    return this.mapPlace(data);
  },

  async updatePlace(id: string, updates: Partial<Place>) {
    const res = await robustFetch(`/api/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    return this.mapPlace(data);
  },

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) return data.url;
      console.warn("Server upload failed, using local fallback", data);
    } catch (err) {
      console.error("Upload error:", err);
    }

    // Ultimate fallback for UX continuity
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Gagal memproses file."));
      reader.readAsDataURL(file);
    });
  },

  _reviewsPromise: null as Promise<Review[]> | null,
  async getReviews(placeId?: string) {
    if (!placeId && this._reviewsPromise) return this._reviewsPromise;
    
    const fetchFn = async () => {
      try {
        const url = placeId ? `/api/reviews?placeId=${placeId}` : "/api/reviews";
        const res = await robustFetch(url);
        if (!res.ok) return this._reviews;
        const data = await res.json();
        if (!Array.isArray(data)) {
          console.error("Expected array from /api/reviews, got:", data);
          return this._reviews;
        }
        const mapped = data.map((r: any) => this.mapReview(r));
        if (!placeId) this._reviews = mapped;
        return mapped;
      } catch (e) {
        console.error("getReviews failed:", e);
        return this._reviews;
      } finally {
        if (!placeId) this._reviewsPromise = null;
      }
    };

    if (placeId) return fetchFn();
    this._reviewsPromise = fetchFn();
    return this._reviewsPromise;
  },

  async addReview(review: Omit<Review, "id" | "createdAt" | "likes" | "replies">) {
    const res = await robustFetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("API Error adding review:", data);
      throw new Error(data.error || "Gagal menyimpan ulasan.");
    }
    return this.mapReview(data);
  },

  async getBookmarks(userId: string) {
    try {
      const res = await robustFetch(`/api/bookmarks/${userId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(`getBookmarks(${userId}) failed:`, e);
      return [];
    }
  },

  async toggleBookmark(userId: string, placeId: string) {
    const current = await this.getBookmarks(userId);
    const isBookmarked = current.includes(placeId);
    
    if (isBookmarked) {
      await robustFetch("/api/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, placeId })
      });
    } else {
      await robustFetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, placeId })
      });
    }
    
    const updated = await this.getBookmarks(userId);
    this.events.dispatchEvent(new CustomEvent("change", { 
      detail: { table: "bookmarks", eventType: "UPDATE", new: updated } 
    }));
    return updated;
  },

  async getTrendingHashtags() {
    try {
      const res = await robustFetch("/api/hashtags");
      if (!res.ok) return this._hashtags;
      const data = await res.json();
      this._hashtags = Array.isArray(data) ? data.map(h => this.mapHashtag(h)) : this._hashtags;
      return this._hashtags;
    } catch (e) {
      console.error("getTrendingHashtags failed:", e);
      return this._hashtags;
    }
  },

  async addTrendingHashtag(tag: { name: string; updatesCount: number }) {
    const res = await robustFetch("/api/hashtags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tag)
    });
    return this.mapHashtag(await res.json());
  },

  async updateTrendingHashtag(id: string, updates: any) {
    const res = await robustFetch(`/api/hashtags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    return this.mapHashtag(await res.json());
  },

  async deleteTrendingHashtag(id: string) {
    await robustFetch(`/api/hashtags/${id}`, { method: "DELETE" });
  },

  async getGroups() {
    try {
      const res = await robustFetch("/api/groups");
      if (!res.ok) return this._groups;
      const data = await res.json();
      this._groups = Array.isArray(data) ? data.map(g => this.mapGroup(g)) : this._groups;
      return this._groups;
    } catch (e) {
      console.error("getGroups failed:", e);
      return this._groups;
    }
  },

  async addGroup(group: any) {
    const res = await robustFetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(group)
    });
    return this.mapGroup(await res.json());
  },

  async updateGroup(id: string, updates: any) {
    const res = await robustFetch(`/api/groups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    return this.mapGroup(await res.json());
  },

  async deleteGroup(id: string) {
    await robustFetch(`/api/groups/${id}`, { method: "DELETE" });
  },

  async getGroupMembers(groupId: string) {
    try {
      const res = await robustFetch(`/api/groups/${groupId}/members`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error(`getGroupMembers(${groupId}) failed:`, e);
      return [];
    }
  },

  async joinGroup(groupId: string, userId: string) {
    const res = await robustFetch(`/api/groups/${groupId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    return await res.json();
  },

  async getGroupMessages(groupId: string) {
    try {
      const res = await robustFetch(`/api/groups/${groupId}/messages`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error(`getGroupMessages(${groupId}) failed:`, e);
      return [];
    }
  },

  async sendGroupMessage(groupId: string, userId: string, content: string) {
    const res = await robustFetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, content })
    });
    return await res.json();
  },

  async getGroupExplorations(groupId: string) {
    try {
      const res = await robustFetch(`/api/groups/${groupId}/explorations`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error(`getGroupExplorations(${groupId}) failed:`, e);
      return [];
    }
  },

  // Administrative Cleanup
  async deletePlace(id: string) {
    await robustFetch(`/api/places/${id}`, { method: "DELETE" });
  },

  async deleteReview(id: string) {
    await robustFetch(`/api/reviews/${id}`, { method: "DELETE" });
  },

  async getUserStats(userId: string) {
    try {
      const res = await robustFetch(`/api/users/${userId}/stats`);
      if (!res.ok) return { exploredCount: 0, savedCount: 0, reviewCount: 0 };
      return await res.json();
    } catch (e) {
      console.error(`getUserStats(${userId}) failed:`, e);
      return { exploredCount: 0, savedCount: 0, reviewCount: 0 };
    }
  },

  async trackPlaceView(userId: string, placeId: string) {
    try {
      await robustFetch(`/api/users/${userId}/track-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId })
      });
    } catch (e) {
      console.error(`trackPlaceView(${userId}, ${placeId}) failed:`, e);
    }
  },
  
  async updateReview(id: string, updates: Partial<Review>) {
    const res = await robustFetch(`/api/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    return this.mapReview(await res.json());
  },

  async deleteUser(id: string) {
    await robustFetch("/api/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
  },

  async updateUser(id: string, updates: any) {
    const res = await robustFetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    return await res.json();
  },

  async getAdminStats() {
    try {
      const res = await robustFetch("/api/admin/stats");
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
       console.error("getAdminStats failed:", e);
       return null;
    }
  },

  async seedDatabase() {
    const res = await robustFetch("/api/admin/seed", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal melakukan seeding.");
    return data;
  },

  async togglePlaceFeatured(id: string, isFeatured: boolean) {
    await robustFetch("/api/admin/feature-place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isFeatured })
    });
  },

  async togglePlaceVerified(id: string, isVerified: boolean) {
    await robustFetch("/api/admin/verify-place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isVerified })
    });
  },

  // User Monitoring
  async getUsers() {
    try {
      const res = await robustFetch("/api/users");
      if (!res.ok) return this._users;
      const data = await res.json();
      this._users = Array.isArray(data) ? data : this._users;
      return this._users;
    } catch (e) {
      console.error("getUsers failed:", e);
      return this._users;
    }
  },

  async login(email: string) {
    const res = await robustFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.hint || data.error || "Gagal masuk.");
    }
    return data;
  },

  setOnline(userId: string) {
    socket.emit("user_online", userId);
  },

  // Subscriptions (using Socket.io events)
  subscribePlaces(callback: (payload: any) => void) {
    const handler = (e: any) => {
      if (e.detail.table === "places") callback(e.detail);
    };
    this.events.addEventListener("change", handler);
    return { unsubscribe: () => this.events.removeEventListener("change", handler) };
  },

  subscribeUsers(callback: (payload: any) => void) {
    const handler = (e: any) => {
      if (e.detail.table === "users") callback(e.detail);
    };
    this.events.addEventListener("change", handler);
    return { unsubscribe: () => this.events.removeEventListener("change", handler) };
  },

  subscribeReviews(placeId: string | undefined, callback: (payload: any) => void) {
    const handler = (e: any) => {
      if (e.detail.table === "reviews") {
        if (!placeId || e.detail.new.placeId === placeId) {
          callback(e.detail);
        }
      }
    };
    this.events.addEventListener("change", handler);
    return { unsubscribe: () => this.events.removeEventListener("change", handler) };
  },

  subscribeToPlaces(callback: (places: Place[]) => void) {
    this.getPlaces().then(callback);
    const handler = (e: any) => {
      if (e.detail.table === "places") {
        callback([...this._places]);
      }
    };
    this.events.addEventListener("change", handler);
    return () => this.events.removeEventListener("change", handler);
  },

  subscribeToUsers(callback: (users: any[]) => void) {
    this.getUsers().then(callback);
    const handler = (e: any) => {
      if (e.detail.table === "users") {
        callback([...this._users]);
      }
    };
    this.events.addEventListener("change", handler);
    return () => this.events.removeEventListener("change", handler);
  },

  subscribeToGroups(callback: (groups: any[]) => void) {
    this.getGroups().then(callback);
    const handler = (e: any) => {
      if (e.detail.table === "communities") {
        callback([...this._groups]);
      }
    };
    this.events.addEventListener("change", handler);
    return () => this.events.removeEventListener("change", handler);
  },

  subscribeToReviews(callback: (reviews: Review[]) => void) {
    this.getReviews().then(callback);
    const handler = (e: any) => {
      if (e.detail.table === "reviews") {
        callback([...this._reviews]);
      }
    };
    this.events.addEventListener("change", handler);
    return () => this.events.removeEventListener("change", handler);
  },

  subscribeToGroupMessages(groupId: string, callback: (messages: any[]) => void) {
    this.getGroupMessages(groupId).then(callback);
    const handler = (e: any) => {
      if (e.detail.table === "messages" && e.detail.new.communityId === groupId) {
        this.getGroupMessages(groupId).then(callback);
      }
    };
    this.events.addEventListener("change", handler);
    return () => this.events.removeEventListener("change", handler);
  },

  subscribeToGroupMembers(groupId: string, callback: (members: any[]) => void) {
    this.getGroupMembers(groupId).then(callback);
    const handler = (e: any) => {
      if (e.detail.table === "group_members" && e.detail.new.groupId === groupId) {
        this.getGroupMembers(groupId).then(callback);
      }
    };
    this.events.addEventListener("change", handler);
    return () => this.events.removeEventListener("change", handler);
  },

  subscribeTrendingHashtags(callback: (payload: any) => void) {
    const handler = (e: any) => {
      if (e.detail.table === "trending_hashtags") callback(e.detail);
    };
    this.events.addEventListener("change", handler);
    return { unsubscribe: () => this.events.removeEventListener("change", handler) };
  }
};

// Auto-init
dataService.init();
