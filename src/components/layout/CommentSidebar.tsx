import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Star, Heart, MessageCircle, Send, ChevronDown,
  ShieldCheck, CornerDownRight
} from "lucide-react";
import { feedbackService, SiteReview } from "../../services/feedbackService";
import { useAuth } from "../../context/AuthContext";

interface CommentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const interactive = !!onChange;

  return (
    <div
      className="flex gap-1"
      onMouseLeave={() => interactive && setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map(s => (
        <span
          key={s}
          onMouseEnter={() => interactive && setHovered(s)}
          onClick={() => interactive && onChange!(s)}
          className={interactive ? "cursor-pointer select-none" : "select-none pointer-events-none"}
        >
          <Star
            size={interactive ? 20 : 14}
            className={
              s <= (interactive ? hovered || value : value)
                ? "fill-secondary-brown text-secondary-brown transition-all"
                : "text-secondary-brown/20 transition-all"
            }
          />
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ review, currentUser }: { review: SiteReview; currentUser: any }) {
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser?.role === "admin" || currentUser?.email === "admin@temutempat.com";
  const hasLiked = currentUser && review.likes.includes(currentUser.name || currentUser.email);

  const handleLike = () => {
    if (!currentUser) return;
    feedbackService.toggleLike(review.id, currentUser.name || currentUser.email);
  };

  const handleReply = () => {
    if (!replyText.trim() || !currentUser) return;
    feedbackService.addReply(review.id, {
      userName: currentUser.name || currentUser.email,
      userRole: isAdmin ? "admin" : "user",
      text: replyText.trim(),
    });
    setReplyText("");
    setShowReply(false);
    setShowReplies(true);
  };

  return (
    <div className="bg-white rounded-[1.5rem] border border-secondary-brown/5 p-5 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-secondary-brown/10 flex items-center justify-center font-serif text-secondary-brown font-bold text-sm shrink-0">
            {(review.userName || "E").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-secondary-brown uppercase tracking-wide">
                {review.userName || "Explorer"}
              </span>
              {review.userRole === "admin" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-secondary-brown text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                  <ShieldCheck size={8} /> Admin
                </span>
              )}
            </div>
            <p className="text-[9px] text-secondary-brown/30 font-medium">{timeAgo(review.createdAt)}</p>
          </div>
        </div>
        <StarRating value={review.rating} />
      </div>

      {/* Comment */}
      <p className="text-sm text-secondary-brown/70 font-serif italic leading-relaxed pl-12">
        "{review.comment}"
      </p>

      {/* Actions */}
      <div className="flex items-center gap-4 pl-12 pt-1">
        <button
          onClick={handleLike}
          disabled={!currentUser}
          className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-none bg-transparent ${
            hasLiked ? "text-red-400 cursor-pointer" : "text-secondary-brown/30 hover:text-red-400 cursor-pointer"
          } ${!currentUser ? "opacity-40 cursor-default" : ""}`}
        >
          <Heart size={13} className={hasLiked ? "fill-red-400" : ""} />
          {review.likes.length > 0 && <span>{review.likes.length}</span>}
        </button>

        {currentUser && (
          <button
            onClick={() => {
              setShowReply(v => !v);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-secondary-brown/30 hover:text-secondary-brown transition-all border-none bg-transparent cursor-pointer"
          >
            <MessageCircle size={13} />
            Balas
          </button>
        )}

        {review.replies.length > 0 && (
          <button
            onClick={() => setShowReplies(v => !v)}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-accent-gold/70 hover:text-accent-gold transition-all border-none bg-transparent cursor-pointer ml-auto"
          >
            {review.replies.length} Balasan
            <ChevronDown size={11} className={`transition-transform ${showReplies ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Reply Input */}
      <AnimatePresence>
        {showReply && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-12 overflow-hidden"
          >
            <div className="flex gap-2 bg-bg-cream/60 rounded-xl p-2 border border-secondary-brown/5">
              <input
                ref={inputRef}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReply()}
                placeholder="Tulis balasan..."
                className="flex-1 bg-transparent border-none outline-none text-xs font-serif italic text-secondary-brown placeholder:text-secondary-brown/30 px-2"
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="w-7 h-7 rounded-lg bg-secondary-brown text-white flex items-center justify-center border-none cursor-pointer disabled:opacity-30 shrink-0"
              >
                <Send size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replies List */}
      <AnimatePresence>
        {showReplies && review.replies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-12 space-y-2 overflow-hidden"
          >
            {review.replies.map(reply => (
              <div key={reply.id} className="flex gap-2 items-start bg-bg-cream/40 rounded-xl p-3 border border-secondary-brown/5">
                <CornerDownRight size={11} className="text-secondary-brown/20 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[10px] font-black text-secondary-brown uppercase tracking-wide">
                      {reply.userName}
                    </span>
                    {reply.userRole === "admin" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-secondary-brown text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                        <ShieldCheck size={8} /> Admin
                      </span>
                    )}
                    <span className="text-[9px] text-secondary-brown/25 ml-auto">{timeAgo(reply.createdAt)}</span>
                  </div>
                  <p className="text-xs text-secondary-brown/60 font-serif italic">{reply.text}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CommentSidebar({ isOpen, onClose }: CommentSidebarProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isAdmin = user?.role === "admin" || user?.email === "admin@temutempat.com";

  useEffect(() => {
    const unsub = feedbackService.subscribe(setReviews);
    return unsub;
  }, []);

  const handleSubmit = () => {
    if (!newComment.trim() || !user || isSubmitting || isAdmin) return;
    setIsSubmitting(true);
    feedbackService.addReview({
      rating: newRating,
      comment: newComment.trim(),
      userName: user.name || user.email,
      userRole: "user",
    });
    setNewComment("");
    setNewRating(5);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setIsSubmitting(false);
    }, 2500);
  };

  // Rata-rata dari data nyata saja
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-secondary-brown/20 backdrop-blur-sm z-[900]"
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isOpen ? 0 : "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-bg-cream z-[950] shadow-2xl flex flex-col border-l border-secondary-brown/10"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-secondary-brown/10 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-2xl italic text-secondary-brown">Ulasan Platform</h2>
              <p className="text-[9px] font-black uppercase tracking-widest text-secondary-brown/30 mt-0.5">
                TemuTempat · {reviews.length} ulasan
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-secondary-brown/5 flex items-center justify-center border-none cursor-pointer hover:bg-secondary-brown/10 transition-all"
            >
              <X size={16} className="text-secondary-brown" />
            </button>
          </div>

          {/* Average — hanya muncul kalau ada review */}
          {reviews.length > 0 && (
            <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-secondary-brown/5">
              <span className="font-serif text-3xl italic text-secondary-brown">{avgRating.toFixed(1)}</span>
              <div>
                <StarRating value={Math.round(avgRating)} />
                <p className="text-[9px] text-secondary-brown/30 font-bold uppercase tracking-widest mt-1">
                  Rating Keseluruhan
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 bg-secondary-brown/5 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle size={28} className="text-secondary-brown/20" />
              </div>
              <p className="font-serif italic text-secondary-brown/40 text-sm">
                Belum ada ulasan. Jadilah yang pertama!
              </p>
            </div>
          ) : (
            reviews.map(review => (
              <ReviewCard key={review.id} review={review} currentUser={user} />
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-secondary-brown/10 shrink-0 bg-bg-cream">
          {!user ? (
            <div className="text-center py-3 bg-white rounded-2xl border border-secondary-brown/5 px-4">
              <p className="text-xs font-serif italic text-secondary-brown/50">
                <a href="/login" className="text-secondary-brown font-bold underline">Masuk</a>{" "}
                untuk memberikan ulasan & like
              </p>
            </div>
          ) : isAdmin ? (
            <div className="text-center py-3 bg-secondary-brown/5 rounded-2xl border border-secondary-brown/10 px-4">
              <div className="flex items-center justify-center gap-2 text-secondary-brown/50">
                <ShieldCheck size={14} />
                <p className="text-xs font-serif italic">
                  Admin dapat memberikan like & membalas ulasan pengguna.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* User info + bintang interaktif */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-secondary-brown/10 flex items-center justify-center font-serif text-secondary-brown text-sm font-bold">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-black text-secondary-brown uppercase tracking-wide">
                    {user.name || user.email}
                  </span>
                </div>
                <StarRating value={newRating} onChange={setNewRating} />
              </div>

              {/* Textarea + send */}
              <div className="flex gap-2 bg-white rounded-2xl p-2 border border-secondary-brown/10">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Tulis ulasanmu tentang TemuTempat..."
                  rows={2}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-serif italic text-secondary-brown placeholder:text-secondary-brown/25 px-2 pt-1 resize-none"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || isSubmitting}
                  className="w-9 h-9 rounded-xl bg-secondary-brown text-white flex items-center justify-center border-none cursor-pointer disabled:opacity-30 hover:bg-black transition-all self-end shrink-0"
                >
                  {submitted ? <Star size={14} className="fill-white" /> : <Send size={14} />}
                </button>
              </div>

              {submitted && (
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest text-center">
                  ✓ Ulasan berhasil dikirim!
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}