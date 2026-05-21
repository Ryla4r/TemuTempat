import React, { useState } from "react";
import { 
  UserCircle, 
  Save, 
  Sparkles,
  Zap,
  Edit3,
  Mail,
  Shield,
  Clock
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { dataService } from "../../services/dataService";
import { motion, AnimatePresence } from "motion/react";

export default function AdminProfileTab() {
  const { user } = useAuth();
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdateBio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    try {
      await dataService.updateUser(user.id, { bio });
      setMessage("Biodata berhasil diperbarui ke arsip.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Gagal update bio:", err);
      setMessage("Terjadi gangguan saat menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-12 pb-12">
      <div className="bg-bg-cream rounded-[4rem] border border-bg-deep-brown/5 shadow-2xl overflow-hidden">
        {/* Header Visual */}
        <div className="h-60 bg-gradient-to-br from-primary-green via-bg-deep-brown to-bg-deep-brown relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-accent-gold/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-12">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img src={user?.avatar} className="w-24 h-24 rounded-[2rem] border-4 border-white shadow-2xl" alt="admin" />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary-green rounded-xl flex items-center justify-center text-bg-deep-brown shadow-xl border-4 border-white">
                  <Shield size={14} />
                </div>
              </div>
              <div className="space-y-1 text-white">
                <h1 className="text-4xl font-serif tracking-tighter leading-none italic">{user?.name}</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Master Administrator</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Details Sidebar */}
          <div className="space-y-10 lg:border-r lg:border-bg-deep-brown/5 lg:pr-12">
            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-bg-deep-brown/30">Detail Akun</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 bg-bg-deep-brown/5 rounded-xl flex items-center justify-center text-bg-deep-brown/30 group-hover:bg-primary-green/10 group-hover:text-primary-green transition-all">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bg-deep-brown/20 leading-none mb-1">Email Resmi</p>
                    <p className="text-sm font-bold text-bg-deep-brown truncate">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 bg-bg-deep-brown/5 rounded-xl flex items-center justify-center text-bg-deep-brown/30 group-hover:bg-accent-gold/10 group-hover:text-accent-gold transition-all">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bg-deep-brown/20 leading-none mb-1">Terdaftar Sejak</p>
                    <p className="text-sm font-bold text-bg-deep-brown">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Januari 2024'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-bg-deep-brown/5 rounded-3xl border border-bg-deep-brown/5">
              <div className="flex items-center gap-3 text-secondary-brown mb-4">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Status Keamanan</span>
              </div>
              <div className="flex items-center gap-2 text-primary-green text-sm font-bold italic">
                <Zap size={14} className="fill-primary-green" />
                Dihubungkan ke Supabase Cloud
              </div>
            </div>
          </div>

          {/* Edit Bio Form */}
          <div className="lg:col-span-2 space-y-10">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-bg-deep-brown/30">Personalisasi</h3>
                <span className="text-[9px] font-bold text-primary-green uppercase bg-primary-green/10 px-3 py-1 rounded-full italic">Mode Pengeditan</span>
               </div>
               <h2 className="text-5xl font-serif text-bg-deep-brown tracking-tighter leading-none italic">Edit Biodata <br /> <span className="opacity-40">Administrator.</span></h2>
            </div>
            
            <form onSubmit={handleUpdateBio} className="space-y-8">
              <div className="relative group">
                <div className="absolute top-6 left-6 text-bg-deep-brown/20 group-focus-within:text-primary-green transition-colors">
                  <Edit3 size={24} />
                </div>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ceritakan visi Anda sebagai administrator platform kolektif ini..."
                  className="w-full bg-white border border-bg-deep-brown/5 pl-16 pr-8 pt-8 pb-8 rounded-[2.5rem] font-serif text-3xl tracking-tighter focus:outline-none ring-2 ring-bg-deep-brown/5 focus:ring-primary-green/20 min-h-[200px] resize-none shadow-sm transition-all"
                />
              </div>

              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <AnimatePresence>
                    {message && (
                      <motion.p 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="text-[10px] font-black uppercase tracking-widest text-primary-green bg-primary-green/10 px-6 py-3 rounded-full italic"
                      >
                        {message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-12 py-5 bg-bg-deep-brown text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-primary-green hover:shadow-2xl hover:shadow-primary-green/20 hover:scale-105 transition-all border-none cursor-pointer"
                >
                  {isSaving ? "MENYIMPAN..." : "SIMPAN PERUBAHAN"} <Save size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
