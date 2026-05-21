import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  MapPin, 
  ShieldCheck,
  Zap,
  ArrowUpRight,
  TrendingDown,
  Star,
  Activity,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dataService } from "../../services/dataService";
import { Review, Place } from "../../types";

export default function AdminOverview() {
  const [users, setUsers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch and subscriptions
    const unsubUsers = dataService.subscribeToUsers(setUsers);
    const unsubPlaces = dataService.subscribeToPlaces(setPlaces);
    const unsubReviews = dataService.subscribeToReviews((data) => {
      setReviews(data);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubPlaces();
      unsubReviews();
    };
  }, []);

  const stats = useMemo(() => {
    // Basic stats calculation
    const activeToday = users.filter(u => {
      if (u.isOnline) return true;
      if (!u.lastSeenAt) return false;
      const today = new Date().setHours(0, 0, 0, 0);
      return new Date(u.lastSeenAt).getTime() >= today;
    }).length;

    const topPlaces = [...places]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3);

    return {
      totalUsers: users.length,
      activeToday,
      totalReviews: reviews.length,
      totalPlaces: places.length,
      topPlaces
    };
  }, [users, reviews, places]);

  const recentActivities = useMemo(() => {
    const combined = [
      ...users.map(u => ({ 
        id: `user-${u.id}-${u.lastSeenAt}`, 
        type: 'user', 
        title: u.name, 
        subtitle: 'Baru bergabung atau aktif', 
        time: u.lastSeenAt || u.createdAt,
        icon: Users,
        color: 'text-primary-green',
        bg: 'bg-primary-green/10'
      })),
      ...reviews.map(r => ({ 
        id: `rev-${r.id}`, 
        type: 'review', 
        title: r.userName, 
        subtitle: `Memberi ulasan: "${r.comment.slice(0, 30)}..."`, 
        time: r.createdAt,
        icon: MessageSquare,
        color: 'text-accent-gold',
        bg: 'bg-accent-gold/10'
      })),
      ...places.map(p => ({ 
        id: `place-${p.id}`, 
        type: 'place', 
        title: p.name, 
        subtitle: 'Destinasi baru ditambahkan', 
        time: p.createdAt,
        icon: MapPin,
        color: 'text-secondary-brown',
        bg: 'bg-secondary-brown/10'
      }))
    ];

    return combined
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);
  }, [users, reviews, places]);

  return (
    <div className="space-y-10 pb-12">
      {/* Real-time Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: "Total Penjelajah", value: stats.totalUsers, icon: Users, color: "text-primary-green", trend: "+12%", isUp: true },
          { label: "Ulasan Kolektif", value: stats.totalReviews, icon: MessageSquare, color: "text-accent-gold", trend: "+5%", isUp: true },
          { label: "Destinasi Terarsip", value: stats.totalPlaces, icon: MapPin, color: "text-secondary-brown", trend: "+2", isUp: true },
          { label: "Aktif Hari Ini", value: stats.activeToday, icon: Activity, color: "text-blue-500", trend: "+18%", isUp: true },
        ].map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-bg-cream p-8 rounded-[2.5rem] border border-bg-deep-brown/5 shadow-xl group hover:bg-bg-deep-brown hover:text-white transition-all duration-500"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${s.color} bg-current/10 group-hover:bg-white/10 group-hover:text-white transition-colors`}>
                <s.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full ${s.isUp ? 'text-primary-green bg-primary-green/10' : 'text-red-500 bg-red-500/10'}`}>
                {s.isUp ? <ArrowUpRight size={10} /> : <TrendingDown size={10} />}
                {s.trend}
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-bg-deep-brown/30 group-hover:text-white/40 mb-1">{s.label}</p>
            <h3 className="text-4xl font-black tracking-tighter leading-none">
              {loading ? "..." : s.value.toLocaleString()}
            </h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Recent Activity List - REAL TIME */}
        <div className="xl:col-span-2 space-y-6">
           <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-accent-gold rounded-full" />
               <h3 className="text-xl font-serif text-bg-cream tracking-tighter italic uppercase">Aktivitas Langsung</h3>
             </div>
             <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-green/10 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-green opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-green"></span>
                </span>
                <span className="text-[8px] font-black uppercase tracking-widest text-primary-green">Live Monitoring</span>
             </div>
           </div>

           <div className="bg-bg-cream rounded-[3rem] p-8 border border-bg-deep-brown/5 shadow-xl space-y-2">
             <AnimatePresence initial={false}>
               {recentActivities.map((act) => (
                 <motion.div 
                   key={act.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="flex items-center gap-6 p-4 rounded-2xl hover:bg-bg-deep-brown/[0.02] transition-colors group"
                 >
                   <div className={`w-12 h-12 rounded-xl ${act.bg} ${act.color} flex items-center justify-center shrink-0`}>
                     <act.icon size={20} />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-black text-bg-deep-brown truncate leading-tight">{act.title}</p>
                     <p className="text-[10px] font-bold text-bg-deep-brown/30 uppercase tracking-tight italic">{act.subtitle}</p>
                   </div>
                   <div className="text-right shrink-0">
                     <p className="text-[9px] font-black text-bg-deep-brown/20 uppercase tracking-widest">
                       {new Date(act.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                     </p>
                     <p className="text-[8px] font-bold text-primary-green/40 uppercase tracking-tighter">Verified Action</p>
                   </div>
                   <ChevronRight size={16} className="text-bg-deep-brown/10 group-hover:text-bg-deep-brown/30 transition-colors" />
                 </motion.div>
               ))}
             </AnimatePresence>
             {recentActivities.length === 0 && (
               <div className="py-20 text-center opacity-20 italic font-serif">
                 Menunggu aktivitas pertama...
               </div>
             )}
           </div>
        </div>

        {/* System & Top Rated Right Sidebar */}
        <div className="space-y-8">
           <div className="bg-bg-deep-brown p-8 rounded-[3rem] border border-white/5 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Zap size={20} className="text-accent-gold" />
                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Infrastruktur</h4>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-white/40 uppercase tracking-widest">Database</span>
                    <span className="text-primary-green uppercase tracking-widest italic">Supabase Connected</span>
                 </div>
                 <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-primary-green/40 animate-pulse"></div>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-white/40 uppercase tracking-widest">Realtime Engine</span>
                    <span className="text-accent-gold uppercase tracking-widest italic">Socket.io Active</span>
                 </div>
                 <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="w-4/5 h-full bg-accent-gold/40 animate-pulse"></div>
                 </div>
              </div>
           </div>

           <div className="bg-bg-cream p-8 rounded-[3rem] border border-bg-deep-brown/5 shadow-xl space-y-8">
              <div className="flex items-center gap-3">
                <Star size={20} className="text-accent-gold fill-accent-gold" />
                <h4 className="text-[10px] font-black text-bg-deep-brown/30 uppercase tracking-[0.3em]">Destinasi Terunggul</h4>
              </div>
              <div className="space-y-6">
                 {stats.topPlaces.map((p, idx) => (
                   <div key={p.id} className="flex gap-4 group cursor-pointer">
                      <div className="relative shrink-0">
                        <img src={p.imageUrl} className="w-16 h-16 rounded-2xl object-cover grayscale group-hover:grayscale-0 transition-all shadow-lg" alt="place" />
                        <div className="absolute -top-2 -left-2 w-6 h-6 bg-accent-gold text-bg-deep-brown rounded-lg flex items-center justify-center text-[10px] font-black">
                          {idx + 1}
                        </div>
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <p className="text-xs font-black text-bg-deep-brown truncate italic leading-none mb-1 group-hover:text-primary-green transition-colors">{p.name}</p>
                        <div className="flex items-center gap-1">
                          <Star size={10} className="text-accent-gold fill-accent-gold" />
                          <span className="text-[10px] font-black text-bg-deep-brown/40">{p.rating.toFixed(1)}</span>
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
