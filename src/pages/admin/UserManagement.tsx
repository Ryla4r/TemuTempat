import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  Search, 
  Trash2, 
  Edit3,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Loader2,
  Clock,
  Circle,
  Mail,
  ShieldCheck,
  Zap,
  ArrowUpRight
} from "lucide-react";
import { dataService } from "../../services/dataService";
import { motion, AnimatePresence } from "motion/react";

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Semua");

  useEffect(() => {
    const unsub = dataService.subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.name?.toLowerCase().includes(search.toLowerCase()) || 
                             u.email?.toLowerCase().includes(search.toLowerCase()));
      const matchesFilter = activeFilter === "Semua" || u.role?.toLowerCase() === activeFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [users, search, activeFilter]);

  // Recently Logged-in Users (top 5 based on last seen)
  const recentLogins = useMemo(() => {
    return [...users]
      .filter(u => u.lastSeenAt || u.isOnline)
      .sort((a, b) => {
        const dateA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
        const dateB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [users]);

  const deleteUser = async (id: string) => {
    if (window.confirm("Hapus user ini selamanya dari Supabase?")) {
      try {
        await dataService.deleteUser(id);
      } catch (err) {
        alert("Gagal menghapus user.");
      }
    }
  };

  return (
    <div className="space-y-12">
      {/* Top Stats & Recent Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Total users box */}
          <div className="bg-bg-cream p-8 rounded-[3rem] border border-bg-deep-brown/5 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-primary-green/10 group-hover:text-primary-green/20 transition-colors">
               <Users size={80} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/30 mb-2">Total Penjelajah</p>
            <h3 className="text-5xl font-black text-bg-deep-brown tracking-tighter">{users.length}</h3>
            <div className="mt-6 flex items-center gap-2 text-primary-green text-[10px] font-black uppercase tracking-widest italic">
               <ArrowUpRight size={14} /> +12% Bulan ini
            </div>
          </div>

          <div className="bg-bg-cream p-8 rounded-[3rem] border border-bg-deep-brown/5 shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/30 mb-2">Kurator Aktif</p>
            <h3 className="text-5xl font-black text-bg-deep-brown tracking-tighter">{users.filter(u => u.role === "admin").length}</h3>
            <div className="mt-6 flex items-center gap-2 text-accent-gold text-[10px] font-black uppercase tracking-widest italic">
               <ShieldCheck size={14} /> Verifikasi Admin
            </div>
          </div>

          <div className="bg-accent-gold p-8 rounded-[3rem] shadow-2xl shadow-accent-gold/20 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/40 mb-2">Status Server</p>
              <h3 className="text-3xl font-black text-bg-deep-brown tracking-tighter italic leading-none">SUPABASE<br/>REALTIME</h3>
            </div>
            <div className="flex items-center gap-2 text-bg-deep-brown text-[10px] font-black uppercase tracking-widest">
               <Zap size={14} className="fill-bg-deep-brown" /> 0.2ms Latency
            </div>
          </div>
        </div>

        {/* Recently Logged-in Users */}
        <div className="bg-bg-cream p-8 rounded-[3rem] border border-bg-deep-brown/5 shadow-xl space-y-6">
           <div className="flex items-center justify-between pl-2">
             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/30">Login Terakhir</h4>
             <div className="flex items-center gap-1.5">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-green opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-green"></span>
               </span>
               <span className="text-[8px] font-black uppercase tracking-widest text-primary-green">Live Monitoring</span>
             </div>
           </div>

           <div className="space-y-4">
             {recentLogins.length === 0 ? (
               <p className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-bg-deep-brown/20 italic">Belum ada aktivitas login.</p>
             ) : recentLogins.map((u) => (
               <div key={u.id} className="flex items-center gap-4 group">
                 <div className="relative">
                   <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-10 h-10 rounded-xl object-cover grayscale transition-all group-hover:grayscale-0 shadow-sm" alt="user" />
                   {u.isOnline && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary-green rounded-full border-2 border-bg-cream"></div>}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-bg-deep-brown truncate leading-tight">{u.name}</p>
                    <p className="text-[9px] font-bold text-bg-deep-brown/30 uppercase tracking-tighter italic">
                      {u.isOnline ? "Sedang Online" : u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : "Terkunci"}
                    </p>
                 </div>
                 <div className="w-1.5 h-1.5 rounded-full bg-bg-deep-brown/10 group-hover:bg-primary-green transition-colors"></div>
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Control Bar */}
        <div className="bg-bg-cream p-6 rounded-[2.5rem] border border-bg-deep-brown/5 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-bg-deep-brown/40" size={20} />
            <input 
              type="text" 
              placeholder="Cari kurator berdasarkan nama atau email resmi..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-16 pr-6 py-4 bg-bg-deep-brown/5 rounded-2xl outline-none focus:ring-2 focus:ring-primary-green/20 border-0 transition-all font-bold text-bg-deep-brown"
            />
          </div>
          
          <div className="flex bg-bg-deep-brown/5 p-1 rounded-2xl shrink-0">
            {["Semua", "Admin", "User"].map(filter => (
              <button 
                key={filter} 
                onClick={() => setActiveFilter(filter)}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-none cursor-pointer ${activeFilter === filter ? "bg-white text-bg-deep-brown shadow-xl" : "text-bg-deep-brown/30 bg-transparent"}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* User Table */}
        <div className="bg-bg-cream rounded-[3rem] border border-bg-deep-brown/5 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-bg-deep-brown/5 border-b border-bg-deep-brown/5">
                  <th className="px-10 py-8 text-[10px] font-black text-bg-deep-brown/40 uppercase tracking-[0.3em]">PENJELAJAH</th>
                  <th className="px-10 py-8 text-[10px] font-black text-bg-deep-brown/40 uppercase tracking-[0.3em]">OTORITAS</th>
                  <th className="px-10 py-8 text-[10px] font-black text-bg-deep-brown/40 uppercase tracking-[0.3em]">KONTAK</th>
                  <th className="px-10 py-8 text-[10px] font-black text-bg-deep-brown/40 uppercase tracking-[0.3em] text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-deep-brown/5">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-8 py-24 text-center">
                      <Loader2 size={32} className="animate-spin inline text-primary-green" />
                      <p className="mt-4 text-[10px] font-black text-bg-deep-brown/40 uppercase tracking-[0.4em] italic">Sinkronisasi Basis Data...</p>
                    </td>
                  </tr>
                )}
                <AnimatePresence>
                  {!loading && Array.isArray(filteredUsers) && filteredUsers.map((user) => (
                    <motion.tr 
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-bg-deep-brown/[0.02] transition-colors group"
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-6">
                           <div className="relative">
                            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-14 h-14 rounded-[1.5rem] object-cover grayscale group-hover:grayscale-0 transition-all shadow-xl" alt="avatar" />
                            {user.isOnline && <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-green border-4 border-white rounded-full"></div>}
                           </div>
                          <div>
                            <p className="font-black text-lg text-bg-deep-brown tracking-tighter leading-none mb-1">{user.name}</p>
                            <p className="text-[10px] text-bg-deep-brown/30 font-black uppercase tracking-widest italic flex items-center gap-2">
                               <Circle size={8} className={`${user.isOnline ? "fill-primary-green text-primary-green" : "fill-bg-deep-brown/20 text-bg-deep-brown/20"}`} />
                               {user.isOnline ? "Aktif Sekarang" : "Terakhir Aktif 2j lalu"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] italic ${user.role === "admin" ? "bg-accent-gold/10 text-accent-gold border border-accent-gold/10" : "bg-primary-green/10 text-primary-green border border-primary-green/10"}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-bg-deep-brown/50">
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2 text-xs font-bold font-serif italic text-bg-deep-brown/60">
                             <Mail size={12} className="text-primary-green" /> {user.email}
                           </div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-bg-deep-brown/20">Auth Via Google UI</p>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:translate-x-4 lg:group-hover:translate-x-0">
                          <button className="p-3 text-bg-deep-brown/20 hover:text-primary-green hover:bg-primary-green/5 rounded-2xl transition-all bg-transparent border-none cursor-pointer">
                            <Edit3 size={20} />
                          </button>
                          <button 
                            onClick={() => deleteUser(user.id)}
                            className="p-3 text-bg-deep-brown/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all bg-transparent border-none cursor-pointer"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-32 text-center grayscale opacity-20">
                       <Users size={64} className="mx-auto mb-6" />
                       <p className="font-black uppercase tracking-[0.5em] text-xs">Pencarian Nihil</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-10 bg-bg-deep-brown/5 flex items-center justify-between border-t border-bg-deep-brown/5">
            <div className="flex items-center gap-4">
               <div className="w-1.5 h-6 bg-primary-green rounded-full"></div>
               <p className="text-[10px] font-black text-bg-deep-brown/30 uppercase tracking-[0.3em] italic">Menampilkan {filteredUsers.length} Penjelajah Kolektif</p>
            </div>
            <div className="flex gap-3">
              <button className="w-12 h-12 rounded-2xl bg-white border border-bg-deep-brown/10 flex items-center justify-center text-bg-deep-brown/20 hover:text-primary-green hover:border-primary-green/20 transition-all shadow-sm cursor-pointer">
                <ChevronLeft size={20} />
              </button>
              <button className="w-12 h-12 rounded-2xl bg-primary-green text-bg-deep-brown flex items-center justify-center font-black shadow-2xl shadow-primary-green/20 border-none cursor-pointer ring-4 ring-primary-green/10">1</button>
              <button className="w-12 h-12 rounded-2xl bg-white border border-bg-deep-brown/10 flex items-center justify-center text-bg-deep-brown/20 hover:text-primary-green hover:border-primary-green/20 transition-all shadow-sm cursor-pointer">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
