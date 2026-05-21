export type Role = "admin" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  bio?: string;
  phone?: string;
  lastSeenAt?: string;
  isOnline?: boolean;
  createdAt?: string;
}

export interface Place {
  id: string;
  name: string;
  description: string;
  category: string[]; // e.g. ["aesthetic", "cheap", "quiet"]
  address: string;
  imageUrl: string;
  rating: number;
  latitude: number;
  longitude: number;
  priceLevel: number; // 1-4
  addedBy: string;
  isFeatured?: boolean;
  isVerified?: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  placeId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  likes: number;
  replies: Reply[];
  mediaUrl?: string;
  hashtags?: string[];
  createdAt: string;
}

export interface Reply {
  id: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "trending" | "nearby" | "new";
  placeId?: string;
  createdAt: string;
  read: boolean;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  memberCount: number;
  createdBy?: string;
  createdAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  joinedAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
}

export interface GroupExploration {
  id: string;
  groupId: string;
  placeId: string;
  placeName?: string;
  placeImage?: string;
  notes?: string;
  exploredAt: string;
}

export interface TrendingHashtag {
  id: string;
  name: string;
  updatesCount: number;
}
