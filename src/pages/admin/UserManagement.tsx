import { useEffect, useState, useMemo } from "react";
import {
  Users, Search, Trash2, Loader2, Circle,
  Mail, RefreshCw, AlertCircle, Shield, UserCheck
} from "lucide-react";
import { dataService } from "../../services/dataService";
import { motion, AnimatePresence } from "motion/react";

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Data user tidak valid dari server.");
      setUsers(data);
    } catch (err: any) {
      console.error("fetchUsers error:", err);
      setError(err.message || "Gagal mengambil data user dari Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const unsub = dataService.subscribeToUsers((data) => {
      if (data.length > 0) setUsers(data);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        activeFilter === "Semua" ||
        u.role?.toLowerCase() === activeFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [users, search, activeFilter]);

  const deleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Hapus akun "${name}" secara permanen?`)) return;
    setDeletingId(id);
    try {
      await dataService.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch {
      alert("Gagal menghapus akun. Coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const adminCount = users.filter(u => u.role === "admin").length;
  const userCount = users.filter(u => u.role !== "admin").length;

  return (
    <div className="space-y-6 w-full">

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden bg-[#2c1f14] rounded-3xl p-6 shadow-xl"
        >
          <div className="absolute -right-4 -top-4 opacity-10">
            <Users size={96} className="text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-1">Total Akun</p>
          <p className="text-5xl font-black text-white tracking-tighter">{users.length}</p>
          <p className="text-[9px] text-white/30 uppercase tracking-widest mt-3 font-bold">Terdaftar</p>
        </motion.div>

        {/* Admin */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#f5ede4] rounded-3xl p-6 shadow border border-[#e8d5c4] flex flex-col justify-between"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-[#8b5e3c]" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b5e3c]/60">Admin</p>
          </div>
          <p className="text-5xl font-black text-[#2c1f14] tracking-tighter">{adminCount}</p>
          <p className="text-[9px] text-[#8b5e3c]/40 uppercase tracking-widest mt-3 font-bold">Akun Terverifikasi</p>
        </motion.div>

        {/* User */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#f5ede4] rounded-3xl p-6 shadow border border-[#e8d5c4] flex flex-col justify-between"
        >
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={16} className="text-[#4a9268]" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#4a9268]/60">Pengguna</p>
          </div>
          <p className="text-5xl font-black text-[#2c1f14] tracking-tighter">{userCount}</p>
          <p className="text-[9px] text-[#4a9268]/50 uppercase tracking-widest mt-3 font-bold">Akun Aktif</p>
        </motion.div>
      </div>

      {/* ── ERROR ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-4 bg-red-50 border border-red-200 p-5 rounded-2xl text-red-600"
          >
            <AlertCircle size={18} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-black text-xs uppercase tracking-widest">Gagal memuat data</p>
              <p className="text-xs italic mt-0.5 text-red-400 truncate">{error}</p>
            </div>
            <button
              onClick={fetchUsers}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none cursor-pointer hover:bg-red-600 transition-all shrink-0"
            >
              <RefreshCw size={11} /> Coba Lagi
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEARCH + FILTER ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2c1f14]/30" size={15} />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#f5ede4] border border-[#e8d5c4] rounded-2xl outline-none text-sm font-semibold text-[#2c1f14] placeholder:text-[#2c1f14]/30 focus:border-[#8b5e3c]/40 transition-colors"
          />
        </div>

        {/* Filter pills */}
        <div className="flex bg-[#f5ede4] border border-[#e8d5c4] p-1 rounded-2xl gap-1 shrink-0">
          {["Semua", "Admin", "User"].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer ${
                activeFilter === f
                  ? "bg-[#2c1f14] text-white shadow"
                  : "text-[#2c1f14]/40 bg-transparent hover:text-[#2c1f14]/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchUsers}
          className="w-11 h-11 bg-[#f5ede4] border border-[#e8d5c4] text-[#8b5e3c] rounded-2xl flex items-center justify-center border-solid cursor-pointer hover:bg-[#8b5e3c] hover:text-white transition-all shrink-0"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── TABLE / LIST ── */}
      <div className="bg-[#f5ede4] border border-[#e8d5c4] rounded-3xl overflow-hidden shadow">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-[#8b5e3c]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#2c1f14]/30">
              Memuat data akun...
            </p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-30">
            <Users size={36} className="text-[#2c1f14]" />
            <p className="font-black text-xs uppercase tracking-widest text-[#2c1f14]">
              {search ? "Tidak ada yang cocok" : "Belum ada akun terdaftar"}
            </p>
          </div>
        )}

        {/* Desktop Table */}
        {!loading && filteredUsers.length > 0 && (
          <>
            {/* Table header — hidden on mobile */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_2fr_auto] px-6 py-3 border-b border-[#e8d5c4] bg-[#ede4d9]">
              {["Akun", "Role", "Email", ""].map((h, i) => (
                <p key={i} className={`text-[9px] font-black uppercase tracking-[0.2em] text-[#2c1f14]/40 ${i === 3 ? "text-right" : ""}`}>{h}</p>
              ))}
            </div>

            {/* Rows */}
            <AnimatePresence>
              {filteredUsers.map((u, idx) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group border-b border-[#e8d5c4] last:border-b-0 hover:bg-[#ede4d9]/60 transition-colors"
                >
                  {/* Mobile card layout */}
                  <div className="flex sm:hidden items-center gap-4 px-5 py-4">
                    <img
                      src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email)}&background=8b5e3c&color=fff&bold=true`}
                      className="w-12 h-12 rounded-2xl object-cover shadow flex-shrink-0"
                      alt={u.name}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-[#2c1f14] truncate">{u.name || "—"}</p>
                      <p className="text-xs text-[#2c1f14]/40 truncate italic mt-0.5">{u.email}</p>
                      <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        u.role === "admin"
                          ? "bg-[#8b5e3c]/15 text-[#8b5e3c]"
                          : "bg-[#4a9268]/15 text-[#4a9268]"
                      }`}>
                        {u.role || "user"}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteUser(u.id, u.name)}
                      disabled={deletingId === u.id}
                      className="p-2.5 text-[#2c1f14]/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all bg-transparent border-none cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      {deletingId === u.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Trash2 size={15} />}
                    </button>
                  </div>

                  {/* Desktop row layout */}
                  <div className="hidden sm:grid grid-cols-[2fr_1fr_2fr_auto] items-center px-6 py-4 gap-4">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email)}&background=8b5e3c&color=fff&bold=true`}
                        className="w-10 h-10 rounded-2xl object-cover shadow flex-shrink-0"
                        alt={u.name}
                      />
                      <div className="min-w-0">
                        <p className="font-black text-sm text-[#2c1f14] truncate">{u.name || "—"}</p>
                        <p className="text-[9px] text-[#2c1f14]/30 uppercase tracking-widest font-bold flex items-center gap-1 mt-0.5">
                          <Circle size={5} className="fill-[#2c1f14]/20 text-[#2c1f14]/20" />
                          Offline
                        </p>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                        u.role === "admin"
                          ? "bg-[#8b5e3c]/15 text-[#8b5e3c]"
                          : "bg-[#4a9268]/15 text-[#4a9268]"
                      }`}>
                        {u.role || "user"}
                      </span>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail size={11} className="text-[#8b5e3c] shrink-0" />
                      <p className="text-xs text-[#2c1f14]/50 italic truncate">{u.email}</p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteUser(u.id, u.name)}
                      disabled={deletingId === u.id}
                      className="p-2.5 text-[#2c1f14]/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    >
                      {deletingId === u.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Trash2 size={15} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}

        {/* Footer */}
        {!loading && (
          <div className="px-6 py-4 bg-[#ede4d9]/50 border-t border-[#e8d5c4] flex items-center justify-between flex-wrap gap-2">
            <p className="text-[9px] font-black text-[#2c1f14]/30 uppercase tracking-widest">
              {filteredUsers.length} dari {users.length} akun
            </p>
            <p className="text-[9px] text-[#2c1f14]/20 italic">Sumber: Supabase</p>
          </div>
        )}
      </div>
    </div>
  );
}