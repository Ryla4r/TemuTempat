import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ArrowLeft, Users, Zap, Shield, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { dataService } from '../../services/dataService';

export default function GroupChatRoom() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;

    const fetchCommunityAndMessages = async () => {
      try {
        // Fetch community info
        const { data: comm, error: commErr } = await supabase
          .from('communities')
          .select('*')
          .eq('id', id)
          .single();
        
        if (commErr) throw commErr;
        setCommunity(comm);

        // Fetch messages
        const { data: msgs, error: msgsErr } = await supabase
          .from('messages')
          .select('*, users(name, avatar)')
          .eq('community_id', id)
          .order('created_at', { ascending: true });
        
        if (msgsErr) throw msgsErr;
        
        setMessages(msgs.map((m: any) => ({
          ...m,
          userName: m.users?.name || 'Anonim',
          userAvatar: m.users?.avatar
        })));
      } catch (err: any) {
        console.error("Gagal ambil data chat:", err);
        alert("Gagal memuat ruang obrolan: " + err.message);
        navigate('/app/community');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommunityAndMessages();

    // Supabase Realtime Subscription
    // Use the exact filter requested by the user
    const channel = supabase
      .channel(`community-chat-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `community_id=eq.${id}`
        },
        async (payload) => {
          console.log('Pesan baru diterima via realtime:', payload);
          
          // Fetch the user info for the new message
          const { data: userData } = await supabase
            .from('users')
            .select('name, avatar')
            .eq('id', payload.new.user_id)
            .single();

          const mappedMessage: any = {
            ...payload.new,
            userName: userData?.name || 'Anonim',
            userAvatar: userData?.avatar
          };

          setMessages(prev => {
            // Check if message already exists
            const exists = prev.some((m: any) => m.id === mappedMessage.id);
            if (exists) return prev;
            return [...prev, mappedMessage];
          });
        }
      )
      .subscribe();

    return () => {
      console.log('Unsubscribing from realtime channel...');
      supabase.removeChannel(channel);
    };
  }, [id, navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || isSending || !id) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          community_id: id,
          user_id: user.id,
          content: newMessage.trim()
        }])
        .select()
        .single();
      
      if (error) {
        alert("Gagal mengirim pesan: " + error.message);
        throw error;
      }
      
      // We don't necessarily need to add it to state here because 
      // the realtime subscription will pick it up, but for instant UI:
      // However, usually it's better to wait for realtime to avoid double message logic complexity 
      // if not carefully handled.
      
      setNewMessage("");
    } catch (err) {
      console.error("Gagal kirim pesan:", err);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-header-beige/20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-primary-green animate-spin" />
        <p className="font-serif text-2xl italic text-secondary-brown">Membuka Gerbang Kolektif...</p>
      </div>
    );
  }

  if (!community) return null;

  return (
    <div className="min-h-screen bg-header-beige/20 flex flex-col h-screen overflow-hidden">
      {/* WhatsApp-like Header */}
      <header className="bg-white border-b border-secondary-brown/10 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/community')}
            className="p-2 hover:bg-header-beige/50 rounded-full text-secondary-brown transition-colors border-none cursor-pointer"
          >
            <ArrowLeft size={24} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={community.image_url || `https://api.dicebear.com/7.x/initials/svg?seed=${community.name}`} 
                className="w-10 h-10 rounded-full object-cover shadow-sm border border-secondary-brown/5" 
                alt={community.name} 
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary-green rounded-full border-2 border-white" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-serif font-bold text-secondary-brown tracking-tight leading-tight">{community.name}</h2>
              <p className="text-[10px] font-black text-primary-green uppercase tracking-widest opacity-60">Online • Kolektif Chat</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden sm:flex items-center gap-1.5 bg-header-beige/50 px-3 py-1.5 rounded-full">
             <Users size={14} className="text-secondary-brown/40" />
             <span className="text-[10px] font-bold text-secondary-brown/60 uppercase tracking-widest">{community.member_count} Anggota</span>
           </div>
           <button className="p-2 hover:bg-header-beige/50 rounded-full text-secondary-brown/40 border-none cursor-pointer">
              <Users size={20} />
           </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat opacity-90 custom-scrollbar"
      >
        <div className="sticky top-0 z-10 flex justify-center mb-8">
           <span className="bg-white/80 backdrop-blur-md px-4 py-1 rounded-lg text-[9px] font-black text-secondary-brown/40 uppercase tracking-[0.2em] shadow-sm border border-secondary-brown/5">
             Chat Aman & Terenkripsi Kolektif
           </span>
        </div>

        {messages.map((msg, idx) => {
          const isOwn = msg.user_id === user?.id;
          return (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] space-y-1`}>
                {!isOwn && (
                  <span className="text-[10px] font-black text-primary-green uppercase tracking-widest ml-3 mb-1">
                    {msg.userName}
                  </span>
                )}
                <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  isOwn 
                    ? 'bg-primary-green text-white rounded-tr-none' 
                    : 'bg-white text-secondary-brown rounded-tl-none border border-secondary-brown/5'
                }`}>
                  {msg.content}
                  <div className={`text-[8px] mt-1 flex justify-end opacity-60 font-bold ${isOwn ? 'text-white' : 'text-secondary-brown/40'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-20 h-20 bg-white shadow-xl rounded-full flex items-center justify-center">
               <Zap size={32} className="text-accent-gold" />
            </div>
            <div className="space-y-2">
              <h4 className="font-serif text-3xl italic text-secondary-brown opacity-40">Belum ada percakapan.</h4>
              <p className="text-xs font-medium text-secondary-brown/20 italic">Jadilah yang pertama mengawali diskusi di {community.name}.</p>
            </div>
          </div>
        )}
      </div>

      {/* Message Input Container */}
      <footer className="bg-bg-cream/30 backdrop-blur-xl border-t border-secondary-brown/10 p-4 sm:p-6 shrink-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-4">
          <button 
            type="button"
            className="p-3 bg-white text-secondary-brown/40 hover:text-primary-green hover:bg-white rounded-full shadow-sm transition-all border-none cursor-pointer flex-shrink-0"
          >
            <ImageIcon size={20} />
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isSending}
              placeholder="Tulis pesan kolektif..."
              className="w-full bg-white border border-secondary-brown/10 px-6 py-4 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-primary-green/20 transition-all shadow-sm placeholder:text-secondary-brown/20"
            />
          </div>

          <button 
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg border-none cursor-pointer flex-shrink-0 ${
              !newMessage.trim() || isSending 
                ? 'bg-secondary-brown/10 text-secondary-brown/20' 
                : 'bg-primary-green text-white hover:bg-secondary-brown hover:scale-105 active:scale-95'
            }`}
          >
            {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} className="ml-1" />}
          </button>
        </form>
      </footer>
    </div>
  );
}
