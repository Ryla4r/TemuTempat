import { io } from "socket.io-client";

export interface SiteReview {
  id: string;
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
}

// Connect to the same host as the front-end
const socket = io();

let reviews: SiteReview[] = [];
let listeners: ((reviews: SiteReview[]) => void)[] = [];

socket.on("reviews:init", (initialReviews: SiteReview[]) => {
  reviews = initialReviews;
  notify();
});

socket.on("reviews:new", (newReview: SiteReview) => {
  reviews = [newReview, ...reviews];
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
  addReview: (review: Omit<SiteReview, 'id' | 'createdAt'>) => {
    socket.emit("reviews:submit", review);
  }
};
