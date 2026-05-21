import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Map as MapIcon, 
  Search, 
  Edit3, 
  Trash2, 
  Plus, 
  X, 
  Loader2, 
  CheckCircle2,
  MapPin,
  Image as ImageIcon,
  Save,
  Navigation,
  Compass
} from "lucide-react";
import { dataService } from "../../services/dataService";
import MapComponent from "../../components/MapComponent";
import { motion, AnimatePresence } from "motion/react";
import { Place } from "../../types";

export default function PlaceManagementTab() {
  const [search, setSearch] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Place>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("list");

  useEffect(() => {
    setLoading(true);
    const unsubPlaces = dataService.subscribeToPlaces((data) => {
      setPlaces(Array.isArray(data) ? data : []);
      setLoading(false);
    });
    const unsubUsers = dataService.subscribeToUsers(setUsers);
    
    return () => {
      unsubPlaces();
      unsubUsers();
    };
  }, []);

  const filteredPlaces = useMemo(() => {
    return places.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.category.some(cat => cat.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [places, search]);

  const handleEditClick = (place: Place) => {
    setEditForm({ ...place });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    setIsSaving(true);
    try {
      await dataService.updatePlace(editForm.id, editForm);
      setIsEditing(false);
    } catch (err) {
      console.error("Update failed:", err);
      alert("Gagal update tempat.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Hapus tempat ini secara permanen dari database?")) {
      try {
        await dataService.deletePlace(id);
        if (selectedPlaceId === id) setSelectedPlaceId(null);
        if (isEditing && editForm.id === id) setIsEditing(false);
      } catch (err) {
        alert("Gagal menghapus tempat.");
      }
    }
  };

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? u.name : "System / AI";
  };

  // Map center logic
  const mapCenter = useMemo(() => {
    if (selectedPlaceId) {
      const p = places.find(p => p.id === selectedPlaceId);
      if (p) return [p.latitude, p.longitude] as [number, number];
    }
    if (filteredPlaces.length > 0) {
      return [filteredPlaces[0].latitude, filteredPlaces[0].longitude] as [number, number];
    }
    return [-6.2088, 106.8456] as [number, number];
  }, [selectedPlaceId, places, filteredPlaces]);

  return (
    <div className="flex flex-col gap-8 h-[80vh] relative">
      {/* Search & Toggle Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-bg-deep-brown/20" size={20} />
          <input 
            type="text" 
            placeholder="Cari katalog arsip tempat..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-bg-cream border border-bg-deep-brown/5 rounded-[2.5rem] outline-none focus:ring-4 focus:ring-primary-green/5 transition-all font-bold text-bg-deep-brown shadow-xl"
          />
        </div>

        <div className="flex items-center bg-bg-cream p-1.5 rounded-full border border-bg-deep-brown/5 shadow-xl self-end md:self-auto">
           <button 
             onClick={() => setViewMode("list")}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "list" ? "bg-bg-deep-brown text-white" : "text-bg-deep-brown/40 hover:text-bg-deep-brown"}`}
           >
             Catalog View
           </button>
           <button 
             onClick={() => setViewMode("map")}
             className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "map" ? "bg-bg-deep-brown text-white" : "text-bg-deep-brown/40 hover:text-bg-deep-brown"}`}
           >
             Map View
           </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-8 overflow-hidden min-h-0 relative">
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {viewMode === "map" ? (
              <motion.div 
                key="map"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full rounded-[3rem] overflow-hidden border border-bg-deep-brown/5 shadow-2xl relative bg-bg-deep-brown"
              >
                <MapComponent 
                  places={filteredPlaces} 
                  center={mapCenter} 
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={(id) => {
                    setSelectedPlaceId(id);
                    const p = places.find(x => x.id === id);
                    if (p) handleEditClick(p);
                  }}
                />
                <div className="absolute top-8 left-8 bg-bg-deep-brown/80 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl pointer-events-none">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green flex items-center gap-2">
                    <CheckCircle2 size={12} /> Live Admin Map
                  </p>
                  <p className="text-xs font-bold text-white/60 italic mt-1 font-serif">Klik pin lokasi untuk audit data.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full bg-bg-cream rounded-[3rem] border border-bg-deep-brown/5 shadow-xl flex flex-col overflow-hidden"
              >
                <div className="overflow-x-auto p-4 custom-scrollbar">
                  <table className="w-full text-left border-separate border-spacing-y-4 px-4">
                    <thead>
                      <tr className="text-[10px] font-black text-bg-deep-brown/20 uppercase tracking-[0.3em]">
                        <th className="px-6 py-2">Destinasi</th>
                        <th className="px-6 py-2">Kategori</th>
                        <th className="px-6 py-2">Penemu</th>
                        <th className="px-6 py-2">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-bg-deep-brown font-bold">
                      {filteredPlaces.map((p) => (
                        <tr key={p.id} className="group hover:scale-[1.01] transition-transform">
                          <td className="px-4 py-3 bg-white first:rounded-l-[2rem] border-y border-l border-bg-deep-brown/5">
                            <div className="flex items-center gap-4">
                              <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-xl object-cover grayscale group-hover:grayscale-0 transition-all shadow-md" />
                              <div className="min-w-0">
                                <p className="text-sm truncate max-w-[200px]">{p.name}</p>
                                <p className="text-[9px] text-bg-deep-brown/30 truncate max-w-[200px] italic font-serif">
                                  {p.address}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 bg-white border-y border-bg-deep-brown/5">
                            <div className="flex flex-wrap gap-1">
                              {p.category.slice(0, 2).map((cat, idx) => (
                                <span key={idx} className="text-[9px] px-2 py-0.5 bg-bg-deep-brown/5 rounded-full uppercase tracking-tighter">
                                  {cat}
                                </span>
                              ))}
                              {p.category.length > 2 && (
                                <span className="text-[8px] opacity-30">+{p.category.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 bg-white border-y border-bg-deep-brown/5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary-green/10 flex items-center justify-center text-[9px] font-black text-primary-green">
                                {getUserName(p.addedBy).charAt(0)}
                              </div>
                              <span className="text-[10px] tracking-tight">{getUserName(p.addedBy)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 bg-white last:rounded-r-[2rem] border-y border-r border-bg-deep-brown/5">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleEditClick(p)}
                                className="p-2.5 bg-bg-deep-brown/5 text-bg-deep-brown hover:bg-bg-deep-brown hover:text-white rounded-xl transition-all border-none cursor-pointer"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDelete(p.id)}
                                className="p-2.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border-none cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {loading && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                      <Loader2 className="animate-spin mb-4" size={32} />
                      <p className="font-serif italic">Mengsinkronisasi arsip arsitektur...</p>
                    </div>
                  )}
                  {!loading && filteredPlaces.length === 0 && (
                    <div className="text-center py-20 opacity-20 italic font-serif">
                       Tidak ada destinasi ditemukan dalam arsip ini.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Edit Modal / Slide Panel */}
        <AnimatePresence>
          {isEditing && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="absolute lg:relative inset-y-0 right-0 w-full lg:w-[450px] bg-bg-cream/95 backdrop-blur-3xl z-[100] lg:z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.4)] flex flex-col pt-2 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
            >
              <div className="flex items-center justify-between p-8 border-b border-bg-deep-brown/5">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-green rounded-xl flex items-center justify-center text-bg-deep-brown shadow-lg">
                       <Edit3 size={18} />
                    </div>
                    <h3 className="text-xl font-serif text-bg-deep-brown tracking-tighter italic">Edit Arsip Destinasi</h3>
                 </div>
                 <button 
                  onClick={() => setIsEditing(false)}
                  className="p-3 bg-bg-deep-brown/5 text-bg-deep-brown hover:bg-bg-deep-brown hover:text-white rounded-xl transition-all border-none cursor-pointer"
                 >
                   <X size={20} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="space-y-4">
                  <div className="relative h-48 rounded-[2.5rem] overflow-hidden group shadow-inner bg-bg-deep-brown/10">
                    <img src={editForm.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="preview" />
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/40 ml-4">Nama Destinasi</label>
                    <input 
                      type="text"
                      value={editForm.name || ""}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="w-full px-8 py-5 rounded-2xl bg-white border-2 border-bg-deep-brown/5 focus:border-primary-green/30 outline-none font-bold text-bg-deep-brown transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/40 ml-4">Kategori (Pisahkan Koma)</label>
                    <input 
                      type="text"
                      value={editForm.category?.join(", ") || ""}
                      onChange={(e) => setEditForm({...editForm, category: e.target.value.split(",").map(c => c.trim())})}
                      className="w-full px-8 py-5 rounded-2xl bg-white border-2 border-bg-deep-brown/5 focus:border-primary-green/30 outline-none font-bold text-bg-deep-brown transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-bg-deep-brown/40 ml-4">Alamat Lengkap</label>
                    <textarea 
                      value={editForm.address || ""}
                      onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                      className="w-full px-8 py-5 rounded-2xl bg-white border-2 border-bg-deep-brown/5 focus:border-primary-green/30 outline-none font-medium text-bg-deep-brown transition-all min-h-[80px] resize-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-bg-deep-brown/5">
                        <input 
                          type="checkbox" 
                          checked={editForm.isVerified || false}
                          onChange={(e) => setEditForm({...editForm, isVerified: e.target.checked})}
                          className="w-5 h-5 accent-primary-green"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-bg-deep-brown/60">Verified</span>
                     </div>
                     <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-bg-deep-brown/5">
                        <input 
                          type="checkbox" 
                          checked={editForm.isFeatured || false}
                          onChange={(e) => setEditForm({...editForm, isFeatured: e.target.checked})}
                          className="w-5 h-5 accent-accent-gold"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-bg-deep-brown/60">Featured</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                     <button 
                       type="button"
                       onClick={() => editForm.id && handleDelete(editForm.id)}
                       className="flex items-center justify-center gap-3 py-5 rounded-3xl bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border-none cursor-pointer"
                     >
                       <Trash2 size={16} /> Hapus
                     </button>
                     <button 
                       type="submit"
                       disabled={isSaving}
                       className="flex items-center justify-center gap-3 py-5 rounded-3xl bg-bg-deep-brown text-white font-black text-[10px] uppercase tracking-widest hover:bg-primary-green transition-all shadow-xl shadow-bg-deep-brown/10 border-none cursor-pointer disabled:opacity-50"
                     >
                       {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} 
                       Simpan Arsip
                     </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

