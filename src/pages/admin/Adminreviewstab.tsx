import React, { useState, useEffect } from "react";
import { Star, Heart, MessageCircle, ShieldCheck, CornerDownRight, Trash2, ChevronDown } from "lucide-react";
import { feedbackService, SiteReview } from "../../services/feedbackService";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={12} className={s <= value ? "fill-secondary-brown text-secondary-brown" : "text-bg-deep-brown/15"} />
      ))}
    </div>
  );
}

export default function AdminReviewsTab() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const [showReplyInput, setShowReplyInput] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = feedbackService.subscribe(setReviews);
    return unsub;
  }, []);

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const handleLike = (reviewId: string) => {
    if (!user) return;
    feedbackService.toggleLike(reviewId, user.name || user.email);
  };

  const handleReply = (reviewId: string) => {
    const text = replyTexts[reviewId]?.trim();
    if (!text || !user) return;
    feedbackService.addReply(reviewId, {
      userName: user.name || user.email,
      userRole: "admin",
      text,
    });
    setReplyTexts(prev => ({ ...prev, [reviewId]: "" }));
    setShowReplyInput(prev => ({ ...prev, [reviewId]: false }));
    setShowReplies(prev => ({ ...prev, [reviewId]: true }));
  };

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-bg-cream p-8 rounded-[3rem] border border-bg-deep-brown/5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/30 mb-2">Total Ulasan</p>
          <h3 className="text-5xl font-black text-bg-deep-brown tracking-tighter">{reviews.length}</h3>
        </div>
        <div className="bg-bg-cream p-8 rounded-[3rem] border border-bg-deep-brown/5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/30 mb-2">Rata-rata Rating</p>
          <div className="flex items-end gap-3">
            <h3 className="text-5xl font-black text-bg-deep-brown tracking-tighter">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</h3>
            {avgRating > 0 && <div className="mb-2"><StarDisplay value={Math.round(avgRating)} /></div>}
          </div>
        </div>
        <div className="bg-secondary-brown p-8 rounded-[3rem] shadow-xl flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-cream/40 mb-2">Admin</p>
          <p className="text-bg-cream font-serif italic text-lg leading-tight">
            Like & balas ulasan untuk meningkatkan kepercayaan pengguna.
          </p>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="bg-bg-cream rounded-[3rem] border border-bg-deep-brown/5 shadow-xl py-20 text-center opacity-30">
          <Star size={40} className="mx-auto mb-4" />
          <p className="font-black uppercase tracking-widest text-sm">Belum ada ulasan platform.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review, idx) => {
            const hasLiked = user && review.likes.includes(user.name || user.email);
            return (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-bg-cream rounded-[2.5rem] border border-bg-deep-brown/5 shadow-sm p-6 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-bg-deep-brown/5 flex items-center justify-center font-serif text-bg-deep-brown font-bold shrink-0">
                      {(review.userName || "E").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-bg-deep-brown uppercase tracking-wide">
                          {review.userName || "Explorer"}
                        </span>
                        {review.userRole === "admin" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-secondary-brown text-white rounded-full text-[7px] font-black uppercase tracking-widest">
                            <ShieldCheck size={7} /> Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-bg-deep-brown/30">{timeAgo(review.createdAt)}</p>
                    </div>
                  </div>
                  <StarDisplay value={review.rating} />
                </div>

                {/* Comment */}
                <p className="text-sm font-serif italic text-bg-deep-brown/70 leading-relaxed pl-13">
                  "{review.comment}"
                </p>

                {/* Actions */}
                <div className="flex items-center gap-4 pl-1">
                  {/* Like */}
                  <button
                    onClick={() => handleLike(review.id)}
                    className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-none bg-transparent cursor-pointer ${
                      hasLiked ? "text-red-400" : "text-bg-deep-brown/30 hover:text-red-400"
                    }`}
                  >
                    <Heart size={13} className={hasLiked ? "fill-red-400" : ""} />
                    {review.likes.length > 0 && review.likes.length}
                  </button>

                  {/* Reply toggle */}
                  <button
                    onClick={() => setShowReplyInput(prev => ({ ...prev, [review.id]: !prev[review.id] }))}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-bg-deep-brown/30 hover:text-secondary-brown transition-all border-none bg-transparent cursor-pointer"
                  >
                    <MessageCircle size={13} /> Balas
                  </button>

                  {/* Show replies */}
                  {review.replies.length > 0 && (
                    <button
                      onClick={() => setShowReplies(prev => ({ ...prev, [review.id]: !prev[review.id] }))}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-secondary-brown/60 hover:text-secondary-brown transition-all border-none bg-transparent cursor-pointer ml-auto"
                    >
                      {review.replies.length} Balasan
                      <ChevronDown size={11} className={`transition-transform ${showReplies[review.id] ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>

                {/* Reply Input */}
                <AnimatePresence>
                  {showReplyInput[review.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 bg-bg-deep-brown/5 rounded-2xl p-3 border border-bg-deep-brown/5">
                        <div className="w-6 h-6 rounded-lg bg-secondary-brown flex items-center justify-center shrink-0 mt-1">
                          <ShieldCheck size={10} className="text-white" />
                        </div>
                        <input
                          value={replyTexts[review.id] || ""}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [review.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && handleReply(review.id)}
                          placeholder="Balas sebagai Admin..."
                          className="flex-1 bg-transparent border-none outline-none text-xs font-serif italic text-bg-deep-brown placeholder:text-bg-deep-brown/25 px-2"
                        />
                        <button
                          onClick={() => handleReply(review.id)}
                          disabled={!replyTexts[review.id]?.trim()}
                          className="px-4 py-1.5 rounded-xl bg-secondary-brown text-white text-[9px] font-black uppercase tracking-widest border-none cursor-pointer disabled:opacity-30 hover:bg-black transition-all shrink-0"
                        >
                          Kirim
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Replies */}
                <AnimatePresence>
                  {showReplies[review.id] && review.replies.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {review.replies.map(reply => (
                        <div key={reply.id} className="flex gap-2 items-start bg-bg-deep-brown/5 rounded-2xl p-3 border border-bg-deep-brown/5">
                          <CornerDownRight size={10} className="text-bg-deep-brown/20 mt-1 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-[10px] font-black text-bg-deep-brown uppercase tracking-wide">{reply.userName}</span>
                              {reply.userRole === "admin" && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-secondary-brown text-white rounded-full text-[7px] font-black uppercase tracking-widest">
                                  <ShieldCheck size={7} /> Admin
                                </span>
                              )}
                              <span className="text-[8px] text-bg-deep-brown/25 ml-auto">{timeAgo(reply.createdAt)}</span>
                            </div>
                            <p className="text-xs text-bg-deep-brown/60 font-serif italic">{reply.text}</p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}