import { io } from "socket.io-client";

export interface SiteReviewReply {
  id: string;
  reviewId: string;
  userName: string;
  userRole?: "admin" | "user";
  text: string;
  createdAt: string;
}

export interface SiteReview {
  id: string;
  rating: number;
  comment: string;
  userName: string;
  userRole?: "admin" | "user";
  createdAt: string;
  likes: string[];
  replies: SiteReviewReply[];
}

const socket = io();

let reviews: SiteReview[] = [];
let listeners: ((reviews: SiteReview[]) => void)[] = [];

socket.on("reviews:init", (initialReviews: SiteReview[]) => {
  reviews = initialReviews.map(r => ({
    ...r,
    likes: r.likes || [],
    replies: r.replies || [],
  }));
  notify();
});

// Server broadcast review baru ke semua client
socket.on("reviews:new", (newReview: SiteReview) => {
  // Kalau sudah ada (dari optimistic), replace. Kalau belum, tambahkan.
  const exists = reviews.some(r => r.id === newReview.id);
  if (exists) {
    reviews = reviews.map(r => r.id === newReview.id ? { ...newReview, likes: newReview.likes || [], replies: newReview.replies || [] } : r);
  } else {
    reviews = [{ ...newReview, likes: newReview.likes || [], replies: newReview.replies || [] }, ...reviews];
  }
  notify();
});

socket.on("reviews:liked", ({ reviewId, likes }: { reviewId: string; likes: string[] }) => {
  reviews = reviews.map(r => r.id === reviewId ? { ...r, likes } : r);
  notify();
});

socket.on("reviews:replied", ({ reviewId, reply }: { reviewId: string; reply: SiteReviewReply }) => {
  reviews = reviews.map(r =>
    r.id === reviewId ? { ...r, replies: [...(r.replies || []), reply] } : r
  );
  notify();
});

const notify = () => {
  listeners.forEach(l => l([...reviews]));
};

export const feedbackService = {
  getReviews: () => reviews,

  subscribe: (callback: (reviews: SiteReview[]) => void) => {
    listeners.push(callback);
    callback([...reviews]);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  },

  addReview: (review: Omit<SiteReview, 'id' | 'createdAt' | 'likes' | 'replies'>) => {
    // Optimistic update — langsung tampil tanpa tunggu server
    const tempId = `temp-${Date.now()}`;
    const optimistic: SiteReview = {
      ...review,
      id: tempId,
      createdAt: new Date().toISOString(),
      likes: [],
      replies: [],
    };
    reviews = [optimistic, ...reviews];
    notify();

    // Emit ke server (server akan broadcast reviews:new ke semua client)
    socket.emit("reviews:submit", review);
  },

  toggleLike: (reviewId: string, userName: string) => {
    socket.emit("reviews:like", { reviewId, userName });
    reviews = reviews.map(r => {
      if (r.id !== reviewId) return r;
      const liked = r.likes.includes(userName);
      return {
        ...r,
        likes: liked ? r.likes.filter(u => u !== userName) : [...r.likes, userName]
      };
    });
    notify();
  },

  addReply: (reviewId: string, reply: Omit<SiteReviewReply, 'id' | 'createdAt' | 'reviewId'>) => {
    socket.emit("reviews:reply", { reviewId, reply });
    const newReply: SiteReviewReply = {
      ...reply,
      id: `temp-${Date.now()}`,
      reviewId,
      createdAt: new Date().toISOString(),
    };
    reviews = reviews.map(r =>
      r.id === reviewId ? { ...r, replies: [...(r.replies || []), newReply] } : r
    );
    notify();
  },
};