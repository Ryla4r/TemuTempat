import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, MapPin, MessageSquare, Plus, ArrowRight, ShieldCheck } from 'lucide-react';
import { CommunityGroup, User, GroupExploration } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import GroupChatRoom from './GroupChatRoom';

interface CommunityDetailModalProps {
  community: CommunityGroup;
  onClose: () => void;
}

export default function CommunityDetailModal({ community, onClose }: CommunityDetailModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'explorations'>('members');
  const [members, setMembers] = useState<any[]>([]);
  const [explorations, setExplorations] = useState<GroupExploration[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [memberList, explorationList] = await Promise.all([
          dataService.getGroupMembers(community.id),
          dataService.getGroupExplorations(community.id)
        ]);
        setMembers(memberList);
        setExplorations(explorationList);
        
        if (user) {
          setIsJoined(memberList.some((m: any) => m.id === user.id));
        }
      } catch (err) {
        console.error("Failed to load community details:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to member changes
    const memberSub = dataService.subscribeToGroupMembers(community.id, (newList) => {
      setMembers(newList);
      if (user) {
        setIsJoined(newList.some((m: any) => m.id === user.id));
      }
    });

    return () => {
      memberSub();
    };
  }, [community.id, user]);

  const handleJoin = async () => {
    if (!user) return;
    try {
      await dataService.joinGroup(community.id, user.id);
      setIsJoined(true);
      setShowChat(true);
    } catch (err) {
      console.error("Failed to join group:", err);
    }
  };

  if (showChat && user?.role !== 'admin') {
    return <GroupChatRoom community={community} onClose={() => setShowChat(false)} onExitModal={onClose} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-10 bg-secondary-brown/40 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="relative h-64 sm:h-80 shrink-0">
          <img 
            src={community.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${community.name}`} 
            className="w-full h-full object-cover" 
            alt={community.name} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-black transition-all border-none cursor-pointer"
          >
            <X size={24} />
          </button>
          
          <div className="absolute bottom-8 left-8 right-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-4xl sm:text-6xl font-serif text-white tracking-tighter leading-none">{community.name}</h2>
                <p className="text-white/60 font-medium italic text-lg">{community.description}</p>
              </div>
              
              {user?.role !== 'admin' && (
                <div className="flex gap-4">
                  {isJoined ? (
                    <button 
                      onClick={() => setShowChat(true)}
                      className="bg-accent-gold text-secondary-brown px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all shadow-xl flex items-center gap-3 border-none cursor-pointer"
                    >
                      MASUK CHAT <MessageSquare size={18} />
                    </button>
                  ) : (
                    <button 
                      onClick={handleJoin}
                      className="bg-primary-green text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-secondary-brown transition-all shadow-xl flex items-center gap-3 border-none cursor-pointer"
                    >
                      GABUNG SEKARANG <Plus size={18} />
                    </button>
                  )}
                </div>
              )}
              
              {user?.role === 'admin' && (
                <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 flex items-center gap-3 text-white overflow-hidden">
                   <ShieldCheck size={18} className="text-accent-gold" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Admin Monitoring Mode</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-secondary-brown/10 px-8">
          <button 
            onClick={() => setActiveTab('members')}
            className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative bg-transparent border-none cursor-pointer flex items-center gap-3 ${
              activeTab === 'members' ? 'text-primary-green' : 'text-secondary-brown/30'
            }`}
          >
            <Users size={16} /> Anggota ({members.length})
            {activeTab === 'members' && <motion.div layoutId="modalTab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-green" />}
          </button>
          <button 
            onClick={() => setActiveTab('explorations')}
            className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative bg-transparent border-none cursor-pointer flex items-center gap-3 ${
              activeTab === 'explorations' ? 'text-primary-green' : 'text-secondary-brown/30'
            }`}
          >
            <MapPin size={16} /> Explorasi ({explorations.length})
            {activeTab === 'explorations' && <motion.div layoutId="modalTab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-green" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-primary-green border-t-transparent animate-spin rounded-full" />
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40">Menyinkronkan Data...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'members' ? (
                <motion.div 
                  key="members"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
                >
                  {members.map((member, idx) => (
                    <motion.div 
                      key={member.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-4 p-4 rounded-3xl bg-header-beige/30 border border-secondary-brown/5 group hover:bg-white hover:shadow-xl transition-all"
                    >
                      <div className="relative">
                        <img 
                          src={member.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`} 
                          className="w-12 h-12 rounded-full border-2 border-white shadow-md grayscale group-hover:grayscale-0 transition-all duration-500" 
                          alt={member.name} 
                        />
                        {member.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-green rounded-full ring-2 ring-white animate-pulse" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-serif text-xl text-secondary-brown leading-tight truncate">{member.name}</p>
                        <p className="text-[9px] font-bold text-secondary-brown/40 uppercase tracking-widest">
                          {member.isOnline ? 'Online Sekarang' : 'Bergabung Seketika'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {members.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <Users size={48} className="mx-auto text-secondary-brown/10" />
                      <p className="font-serif text-2xl italic text-secondary-brown/40">Belum ada anggota yang bergabung secara fisik.</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="explorations"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {explorations.map((exp, idx) => (
                    <motion.div 
                      key={exp.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex flex-col sm:flex-row gap-8 p-6 rounded-[2.5rem] bg-header-beige/30 border border-secondary-brown/5 group hover:bg-white hover:shadow-2xl transition-all"
                    >
                      <div className="w-full sm:w-48 h-32 rounded-3xl overflow-hidden shrink-0 shadow-lg">
                        <img 
                          src={exp.placeImage || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400'} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          alt={exp.placeName} 
                        />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-serif text-3xl text-secondary-brown group-hover:text-primary-green transition-colors">{exp.placeName}</h4>
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/30 bg-white/50 px-3 py-1 rounded-full">
                            {new Date(exp.exploredAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-secondary-brown/60 text-sm italic line-clamp-2">"{exp.notes || 'Dijelajahi bersama dalam misi pencarian ketenangan.'}"</p>
                        <div className="flex items-center gap-3 text-primary-green opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                           <MapPin size={14} />
                           <span className="text-[10px] font-black uppercase tracking-widest">Lihat Detail Artefak</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {explorations.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                      <MapPin size={48} className="mx-auto text-secondary-brown/10" />
                      <p className="font-serif text-2xl italic text-secondary-brown/40">Sejarah penjelajahan masih menunggu untuk ditulis.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
