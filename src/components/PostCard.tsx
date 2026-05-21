import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Send, User, Share2, MoreHorizontal, Play, Pause, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';

interface PostCardProps {
  post: any;
  onLikeChange?: () => void;
  onCommentChange?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onLikeChange, onCommentChange }) => {
  const { user } = useAuth();
  const [engagement, setEngagement] = useState<any>({ likes: [], comments: [] });
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const isVideo = post.media_url?.toLowerCase().match(/\.(mp4|webm|ogg)$/) || post.media_url?.includes("video");

  useEffect(() => {
    fetchEngagement();
    
    const likeHandler = (e: any) => {
      if (e.detail.table === "post_likes" && e.detail.new?.post_id === post.id) {
        fetchEngagement();
      }
    };
    const commentHandler = (e: any) => {
      if (e.detail.table === "post_comments" && e.detail.new?.post_id === post.id) {
        fetchEngagement();
      }
    };

    dataService.events.addEventListener("post_likes_change", likeHandler);
    dataService.events.addEventListener("post_comments_change", commentHandler);
    
    return () => {
      dataService.events.removeEventListener("post_likes_change", likeHandler);
      dataService.events.removeEventListener("post_comments_change", commentHandler);
    };
  }, [post.id]);

  useEffect(() => {
    if (user && engagement.likes) {
      setIsLiked(engagement.likes.some((l: any) => l.user_id === user.id));
    }
  }, [user, engagement.likes]);

  const fetchEngagement = async () => {
    const data = await dataService.getPostEngagement(post.id);
    setEngagement(data);
  };

  const handleLike = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    await dataService.togglePostLike(post.id, user.id);
    if (onLikeChange) onLikeChange();
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    if (!newComment.trim() || isPostingComment) return;

    setIsPostingComment(true);
    try {
      await dataService.addPostComment(post.id, user.id, user.name || user.email, newComment.trim());
      setNewComment("");
      if (onCommentChange) onCommentChange();
    } catch (err) {
      alert("Gagal kirim komentar");
    } finally {
      setIsPostingComment(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-secondary-brown/5 group relative"
    >
      {/* Media Content */}
      <div className="relative aspect-[4/5] bg-bg-cream overflow-hidden">
        {isVideo ? (
          <div className="w-full h-full relative cursor-pointer" onClick={() => setIsPlaying(!isPlaying)}>
            <video 
              src={post.media_url} 
              autoPlay={false}
              muted
              loop
              className="w-full h-full object-cover"
              controls={isPlaying}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl">
                   <Play size={32} className="text-secondary-brown translate-x-1" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <img 
            src={post.media_url} 
            alt={post.caption} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        )}

        {/* Overlay Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
               <User size={14} className="text-white" />
             </div>
             <span className="text-xs font-black text-white uppercase tracking-widest">{post.username || 'Traveler'}</span>
           </div>
           <p className="text-white/90 text-sm font-medium line-clamp-2 leading-relaxed italic">
             "{post.caption}"
           </p>
        </div>
      </div>

      {/* Interaction Bar */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-6">
              <button 
                onClick={handleLike}
                className={`flex items-center gap-2 group/btn border-none bg-transparent cursor-pointer transition-all ${isLiked ? 'text-primary-green' : 'text-secondary-brown/30'}`}
              >
                <div className={`p-2 rounded-full transition-all ${isLiked ? 'bg-primary-green/10' : 'group-hover/btn:bg-primary-green/10'}`}>
                  <Heart size={22} fill={isLiked ? "currentColor" : "none"} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-black tracking-widest">{engagement.likes.length}</span>
              </button>

              <button 
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-2 group/btn border-none bg-transparent cursor-pointer text-secondary-brown/30"
              >
                <div className="p-2 rounded-full group-hover/btn:bg-accent-gold/10 transition-all">
                  <MessageCircle size={22} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-black tracking-widest">{engagement.comments.length}</span>
              </button>
           </div>
           
           <button className="p-2 hover:bg-header-beige/50 rounded-full text-secondary-brown/20 border-none bg-transparent cursor-pointer">
             <Share2 size={20} />
           </button>
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="pt-4 border-t border-secondary-brown/5 space-y-4 overflow-hidden"
            >
              <div className="max-h-48 overflow-y-auto space-y-3 custom-scrollbar px-2">
                {engagement.comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-header-beige flex items-center justify-center shrink-0">
                      <User size={10} className="text-secondary-brown/40" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-secondary-brown/30 uppercase tracking-widest mb-0.5">{c.username}</p>
                      <p className="text-xs text-secondary-brown/70 leading-relaxed font-medium">{c.comment_text}</p>
                    </div>
                  </div>
                ))}
                {engagement.comments.length === 0 && (
                  <p className="text-[10px] text-center italic text-secondary-brown/20 py-4 font-black uppercase tracking-[0.2em]">Belum ada diskusi kolektif</p>
                )}
              </div>

              {user ? (
                <form onSubmit={handleComment} className="flex gap-2 bg-header-beige/30 p-2 rounded-2xl border border-secondary-brown/5">
                  <input 
                    type="text" 
                    placeholder="Tambah komentar..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs font-medium focus:outline-none px-3"
                  />
                  <button 
                    type="submit"
                    disabled={!newComment.trim() || isPostingComment}
                    className="w-10 h-10 rounded-full bg-primary-green text-white flex items-center justify-center shadow-lg hover:bg-secondary-brown disabled:bg-secondary-brown/20 border-none cursor-pointer flex-shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </form>
              ) : (
                <p className="text-[10px] text-center font-black text-primary-green uppercase tracking-widest bg-primary-green/5 py-3 rounded-xl">
                  Login untuk ikut berdiskusi
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Login Prompt Modal */}
      <AnimatePresence>
        {showLoginPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginPrompt(false)}
              className="absolute inset-0 bg-secondary-brown/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] p-12 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-primary-green/10 rounded-full flex items-center justify-center mx-auto mb-8">
                 <User size={32} className="text-primary-green" />
              </div>
              <h3 className="font-serif text-4xl italic text-secondary-brown mb-4 tracking-tighter">Gabung Kolektif</h3>
              <p className="text-secondary-brown/60 mb-10 text-sm leading-relaxed font-semibold">
                Silakan masuk atau daftar untuk menyukai dan berkomentar di petualangan kolektif ini.
              </p>
              <div className="space-y-4">
                 <button 
                   onClick={() => (window as any).location.href = '/login'}
                   className="w-full bg-primary-green text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-secondary-brown transition-all border-none cursor-pointer"
                 >
                   Ke Halaman Login
                 </button>
                 <button 
                   onClick={() => setShowLoginPrompt(false)}
                   className="w-full bg-transparent text-secondary-brown/40 py-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:text-secondary-brown transition-all border-none cursor-pointer"
                 >
                   Lewati Saja
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PostCard;
