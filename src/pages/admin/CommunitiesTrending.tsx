import React, { useState, useEffect } from "react";
import { 
  Users2, 
  TrendingUp, 
  Plus, 
  Trash2, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Zap,
  MoreVertical,
  Edit3
} from "lucide-react";
import { dataService } from "../../services/dataService";
import { motion, AnimatePresence } from "motion/react";
import { CommunityGroup, TrendingHashtag } from "../../types";

export default function CommunitiesTrending() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gData, hData] = await Promise.all([
          dataService.getGroups(),
          dataService.getTrendingHashtags()
        ]);
        setGroups(gData);
        setHashtags(hData);
      } catch (err) {
        console.error("Gagal ambil data komunitas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscriptions
    const groupUnsub = dataService.subscribeToGroups(setGroups);
    const hashtagUnsub = dataService.subscribeTrendingHashtags((payload) => {
      dataService.getTrendingHashtags().then(setHashtags);
    });

    return () => {
      groupUnsub();
      hashtagUnsub.unsubscribe();
    };
  }, []);

  const deleteGroup = async (id: string) => {
    if (window.confirm("Hapus grup komunitas ini?")) {
      try {
        await dataService.deleteGroup(id);
      } catch (err) {
        alert("Gagal menghapus grup.");
      }
    }
  };

  const deleteHashtag = async (id: string) => {
    if (window.confirm("Hapus hashtag ini dari trending?")) {
      try {
        await dataService.deleteTrendingHashtag(id);
      } catch (err) {
        alert("Gagal menghapus hashtag.");
      }
    }
  };

  return (
    <div className="space-y-12 pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Community Groups Section */}
        <div className="xl:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-green/10 rounded-xl flex items-center justify-center text-primary-green">
                <Users2 size={20} />
              </div>
              <h2 className="text-2xl font-serif text-bg-cream tracking-tighter italic uppercase">Grup Komunitas</h2>
            </div>
            <button className="bg-bg-cream/5 text-bg-cream/60 hover:text-white hover:bg-white/10 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center gap-2">
              <Plus size={16} /> Grup Baru
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {loading ? (
              [1, 2, 4].map(i => (
                <div key={i} className="bg-bg-cream/5 aspect-video rounded-[2.5rem] animate-pulse" />
              ))
            ) : groups.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-bg-cream/5 rounded-[3rem] border border-white/5">
                <Users2 size={48} className="mx-auto text-bg-cream/10 mb-4" />
                <p className="text-bg-cream/30 font-black uppercase tracking-[0.2em] italic">Belum ada grup yang terdaftar.</p>
              </div>
            ) : groups.map((group) => (
              <motion.div
                key={group.id}
                layout
                className="bg-bg-cream rounded-[3rem] overflow-hidden group border border-bg-deep-brown/5 shadow-xl"
              >
                <div className="h-40 relative overflow-hidden">
                  <img 
                    src={group.imageUrl || `https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&h=600&fit=crop`} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" 
                    alt={group.name} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-deep-brown/80 to-transparent"></div>
                  <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                    <div className="min-w-0">
                      <h3 className="text-2xl font-serif text-white tracking-tighter italic">{group.name}</h3>
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{group.memberCount} Anggota PK</p>
                    </div>
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  <p className="text-sm text-bg-deep-brown/60 italic leading-relaxed line-clamp-2">"{group.description || "Komunitas penjelajah yang berfokus pada estetika urban dan ketenangan kolektif."}"</p>
                  <div className="flex items-center justify-between pt-4 border-t border-bg-deep-brown/5">
                    <div className="flex items-center gap-2">
                       <MessageSquare size={14} className="text-primary-green" />
                       <span className="text-[10px] font-black text-bg-deep-brown/40 uppercase tracking-widest">Diskusi Aktif</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-3 text-bg-deep-brown/20 hover:text-bg-deep-brown transition-colors bg-transparent border-none cursor-pointer"><ExternalLink size={18} /></button>
                      <button 
                        onClick={() => deleteGroup(group.id)}
                        className="p-3 text-bg-deep-brown/20 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Trending Hashtags Section */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-accent-gold/10 rounded-xl flex items-center justify-center text-accent-gold">
                <TrendingUp size={20} />
              </div>
              <h2 className="text-2xl font-serif text-bg-cream tracking-tighter italic uppercase">Trending</h2>
            </div>
            <button className="text-accent-gold/60 hover:text-accent-gold transition-colors text-[10px] font-black uppercase tracking-widest bg-transparent border-none cursor-pointer">Segarkan</button>
          </div>

          <div className="bg-bg-cream rounded-[3rem] border border-bg-deep-brown/5 shadow-xl overflow-hidden divide-y divide-bg-deep-brown/5">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="p-8 h-20 animate-pulse bg-bg-deep-brown/5" />
              ))
            ) : hashtags.length === 0 ? (
              <div className="p-20 text-center grayscale opacity-20">
                <TrendingUp size={48} className="mx-auto" />
              </div>
            ) : hashtags.map((h, idx) => (
              <div key={h.id} className="p-8 flex items-center justify-between hover:bg-bg-deep-brown/5 transition-all group">
                <div className="flex items-center gap-6">
                  <div className="text-2xl font-serif text-bg-deep-brown/10">{String(idx + 1).padStart(2, '0')}</div>
                  <div>
                    <h4 className="text-xl font-serif text-bg-deep-brown tracking-tighter italic">{h.name}</h4>
                    <p className="text-[10px] font-black text-bg-deep-brown/40 uppercase tracking-[0.2em]">{h.updatesCount} Interaksi</p>
                  </div>
                </div>
                <div className="flex gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all">
                  <button className="p-2 text-bg-deep-brown/20 hover:text-primary-green transition-colors bg-transparent border-none cursor-pointer"><Edit3 size={18} /></button>
                  <button 
                    onClick={() => deleteHashtag(h.id)}
                    className="p-2 text-bg-deep-brown/20 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* AI Insight Box */}
          <div className="bg-accent-gold p-8 rounded-[2.5rem] text-bg-deep-brown space-y-4 shadow-2xl shadow-accent-gold/20">
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">AI Trend Analysis</span>
            </div>
            <p className="text-[11px] font-black uppercase leading-relaxed tracking-tighter opacity-80 italic">
               "Minat pada kategori 'Quiet Luxury' dan 'Industrial Oasis' meningkat 24% di area Jawa Barat sejak awal bulan."
            </p>
            <div className="pt-2 flex justify-between items-center">
              <div className="w-12 h-1 bg-bg-deep-brown/20 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-bg-deep-brown animate-pulse"></div>
              </div>
              <Zap size={14} className="animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
