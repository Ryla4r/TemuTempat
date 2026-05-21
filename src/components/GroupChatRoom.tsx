import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, Users, History, MessageSquare, Zap, ArrowLeft, MoreVertical, Shield } from 'lucide-react';
import { CommunityGroup, User, GroupMessage } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

interface GroupChatRoomProps {
  community: CommunityGroup;
  onClose: () => void;
  onExitModal: () => void;
}

export default function GroupChatRoom({ community, onClose, onExitModal }: GroupChatRoomProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial load
    dataService.getGroupMessages(community.id).then(setMessages);

    // Subscribe
    const messageSub = dataService.subscribeToGroupMessages(community.id, (newMessages) => {
      setMessages(newMessages);
    });

    return () => {
      messageSub();
    };
  }, [community.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await dataService.sendGroupMessage(community.id, user.id, newMessage.trim());
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-header-beige/20 w-full max-w-4xl h-[90vh] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col items-stretch border border-secondary-brown/10"
    >
      {/* Header */}
      <div className="bg-white border-b border-secondary-brown/10 p-6 sm:p-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-header-beige/50 rounded-2xl flex items-center justify-center text-secondary-brown/40 hover:text-secondary-brown hover:bg-header-beige transition-all border-none cursor-pointer"
          >
            <ArrowLeft size={24} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={community.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${community.name}`} 
                className="w-14 h-14 rounded-2xl object-cover shadow-lg" 
                alt={community.name} 
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-green rounded-full ring-4 ring-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif text-secondary-brown tracking-tighter leading-none mb-1">{community.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-primary-green uppercase tracking-widest">Virtual Chat Room</span>
                <span className="w-1 h-1 bg-secondary-brown/20 rounded-full" />
                <span className="text-[9px] font-bold text-secondary-brown/40 uppercase tracking-widest">{community.memberCount} Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={onExitModal}
            className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/20 transition-all border-none cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 bg-white/40 backdrop-blur-sm custom-scrollbar"
      >
        <div className="max-w-md mx-auto text-center space-y-6 pb-12 border-b border-secondary-brown/5">
          <div className="w-16 h-16 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto">
            <Shield size={32} className="text-accent-gold" />
          </div>
          <div className="space-y-2">
            <h4 className="font-serif text-3xl italic text-secondary-brown">Arsip Keamanan Kolektif</h4>
            <p className="text-xs font-medium text-secondary-brown/40 leading-relaxed italic">
              "Setiap percakapan di sini dienkripsi secara kolektif untuk menjaga kerahasiaan hidden gem kita bersama."
            </p>
          </div>
        </div>

        {messages.map((msg, idx) => {
          const isOwn = msg.userId === user?.id;
          return (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, x: isOwn ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-start gap-6 ${isOwn ? 'flex-row-reverse' : ''}`}
            >
              <img 
                src={msg.userAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.userName}`} 
                className="w-10 h-10 rounded-xl shadow-md shrink-0 border-2 border-white" 
                alt="avatar" 
              />
              <div className={`space-y-3 max-w-[80%] sm:max-w-[70%] ${isOwn ? 'items-end' : ''}`}>
                <div className={`flex items-center gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/60">@{msg.userName}</span>
                  <span className="text-[9px] font-bold text-secondary-brown/20 uppercase tracking-widest">
                    {new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`p-6 rounded-[2rem] text-sm leading-relaxed ${
                  isOwn 
                    ? 'bg-secondary-brown text-white rounded-tr-none' 
                    : 'bg-white text-secondary-brown shadow-xl border border-secondary-brown/5 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-20 h-20 bg-secondary-brown/5 rounded-full flex items-center justify-center">
               <Zap size={40} className="text-accent-gold/20" />
            </div>
            <p className="font-serif text-3xl italic text-secondary-brown/20">Sunyi... Jadilah yang pertama memberikan temuan.</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white p-8 sm:p-12 border-t border-secondary-brown/10 shrink-0">
        <form onSubmit={handleSend} className="relative group">
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isSending}
            placeholder="Tulis temuan atau ajak diskusi kolektif..."
            className="w-full bg-header-beige/20 border-none pl-8 pr-32 py-6 rounded-3xl font-serif text-2xl focus:outline-none ring-2 ring-secondary-brown/5 focus:ring-accent-gold/30 transition-all shadow-inner placeholder:text-secondary-brown/20"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={`absolute right-4 top-1/2 -translate-y-1/2 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 border-none cursor-pointer ${
              !newMessage.trim() || isSending 
                ? 'bg-secondary-brown/5 text-secondary-brown/10' 
                : 'bg-primary-green text-white hover:bg-secondary-brown shadow-xl hover:scale-105'
            }`}
          >
            {isSending ? '...' : 'KIRIM'} <Send size={16} />
          </button>
        </form>
        <p className="mt-4 text-center text-[9px] font-bold text-secondary-brown/30 uppercase tracking-[0.4em]">
          DIPANTAU OLEH ARSIPARIS PUSAT
        </p>
      </div>
    </motion.div>
  );
}
