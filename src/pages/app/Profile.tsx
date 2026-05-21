import React, { useState, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import Cropper, { Point, Area } from "react-easy-crop";
import { 
  User as UserIcon, 
  Mail, 
  MapPin, 
  Calendar, 
  Settings, 
  Star, 
  ArrowRight,
  Edit,
  Camera,
  History,
  MessageSquare,
  Bookmark,
  Phone,
  Upload,
  X,
  Check,
  Loader2
} from "lucide-react";
import { dataService } from "../../services/dataService";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { Place, Review } from "../../types";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab ] = useState("Tersimpan");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  
  const [userPlaces, setUserPlaces] = useState<Place[]>([]);
  const [savedPlacesList, setSavedPlacesList] = useState<Place[]>([]);
  const [userReviewsCount, setUserReviewsCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [exploredCount, setExploredCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  // ... (crop state)
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [editForm, setEditForm] = useState({
    name: user?.name || "",
    bio: user?.bio || "",
    avatar: user?.avatar || "",
    email: user?.email || "",
    phone: user?.phone || ""
  });

  if (!user) return null;

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL("image/jpeg");
  };

  const handleApplyCrop = async () => {
    if (tempImage && croppedAreaPixels) {
      const croppedImage = await getCroppedImg(tempImage, croppedAreaPixels);
      if (croppedImage) {
        setEditForm({ ...editForm, avatar: croppedImage });
      }
    }
    setIsCropModalOpen(false);
    setTempImage(null);
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      ...user,
      name: editForm.name,
      bio: editForm.bio,
      avatar: editForm.avatar,
      email: editForm.email,
      phone: editForm.phone
    });
    setIsEditModalOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result as string);
        setIsCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchUserStats = useCallback(async (isInitial = false) => {
    if (!user) return;
    try {
      if (isInitial) setLoadingStats(true);
      
      // 1. Fetch exact counts from server for the dashboard cards
      const statsData = await dataService.getUserStats(user.id);
      
      // 2. Fetch specific lists for the tabs (Saved/Contributions)
      const [allPlaces, allReviews, bookmarks] = await Promise.all([
        dataService.getPlaces(),
        dataService.getReviews(),
        dataService.getBookmarks(user.id)
      ]);
      
      const myPlaces = allPlaces.filter((p: Place) => p.addedBy === user.id);
      const myReviews = allReviews.filter((r: Review) => r.userId === user.id);
      const myBookmarks = allPlaces.filter((p: Place) => bookmarks.includes(p.id));
      
      setUserPlaces(myPlaces);
      setSavedPlacesList(myBookmarks);
      
      // Use the dynamic counts from the server for the cards
      setUserReviewsCount(statsData.reviewCount || 0);
      setSavedCount(statsData.savedCount || 0);
      
      // TEMPAT DITEMUKAN: Bind to unique places count (DB + Local fallback)
      const historyKey = `recent_places_${user.id}`;
      const savedHistory = localStorage.getItem(historyKey);
      const localHistoryLength = savedHistory ? JSON.parse(savedHistory).length : 0;
      
      setExploredCount(Math.max(statsData.exploredCount || 0, localHistoryLength));

      // Derive history items
      const reviewHistory = myReviews.map(r => {
        const place = allPlaces.find(p => p.id === r.placeId);
        return {
          name: place?.name || "Tempat tidak diketahui",
          date: new Date(r.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(r.createdAt).getTime(),
          action: "Menambahkan Review",
          type: "review"
        };
      });

      const bookmarkHistory = myBookmarks.map(p => ({
        name: p.name,
        date: "Baru saja disimpan", 
        timestamp: 0, 
        action: "Menyimpan",
        type: "save"
      }));

      const combined = [...reviewHistory, ...bookmarkHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHistoryItems(combined);
    } catch (err) {
      console.error("Gagal ambil stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchUserStats(true);

    // Subscribe to realtime updates for stats
    const placeSub = dataService.subscribePlaces(() => fetchUserStats());
    const reviewSub = dataService.subscribeReviews(undefined, () => fetchUserStats());
    
    // Custom subscription for bookmarks and views
    const genericHandler = (e: any) => {
      const table = e.detail?.table;
      if (table === 'bookmarks' || table === 'user_views' || table === 'reviews' || e.type === 'history_updated') {
         fetchUserStats();
      }
    };
    dataService.events.addEventListener('change', genericHandler);
    window.addEventListener('history_updated', genericHandler);

    return () => {
      placeSub.unsubscribe();
      reviewSub.unsubscribe();
      dataService.events.removeEventListener('change', genericHandler);
      window.removeEventListener('history_updated', genericHandler);
    };
  }, [fetchUserStats]);

  // Derive real-time data for tabs
  const savedPlaces = savedPlacesList;
  const contributionPlaces = userPlaces;

  const stats = [
    { label: "Ulasan Kolektif", value: userReviewsCount, icon: Star, color: "text-accent-gold", bg: "bg-accent-gold/10" },
    { label: "Tempat Ditemukan", value: exploredCount, icon: MapPin, color: "text-secondary-brown", bg: "bg-secondary-brown/5" },
    { label: "Koleksi Tersimpan", value: savedCount, icon: Bookmark, color: "text-secondary-brown", bg: "bg-secondary-brown/5" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-24 px-4">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-64 md:h-80 bg-gradient-to-br from-[#E8D5C4] via-[#F5EFE6] to-white rounded-[3rem] md:rounded-[5rem] shadow-2xl relative overflow-hidden border border-secondary-brown/5">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]"></div>
          <div className="absolute top-6 right-6 md:top-10 md:right-10">
            <button className="bg-white/80 backdrop-blur-xl p-3 md:p-4 rounded-2xl md:rounded-3xl text-secondary-brown hover:bg-white transition-all border border-secondary-brown/10 shadow-xl cursor-pointer">
              <Settings size={22} />
            </button>
          </div>
          <div className="absolute -bottom-20 -right-20 w-[30rem] md:w-[40rem] h-[30rem] md:h-[40rem] bg-accent-gold/20 rounded-full blur-[100px] md:blur-[140px]"></div>
        </div>
        
        <div className="px-8 md:px-16 -mt-32 md:-mt-48 relative z-10 flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12 text-center md:text-left">
          <div className="relative group flex-shrink-0">
            <div className="p-2 bg-white rounded-[3rem] md:rounded-[4rem] shadow-2xl border border-secondary-brown/5">
              <img 
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
                className="w-40 h-40 md:w-56 md:h-56 rounded-[2.5rem] md:rounded-[3.5rem] object-cover" 
                alt="avatar" 
              />
            </div>
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="absolute bottom-3 right-3 p-3 bg-secondary-brown text-white rounded-xl shadow-xl hover:scale-110 transition-all border-[4px] border-white cursor-pointer"
            >
              <Camera size={20} />
            </button>
          </div>
          
          <div className="flex-1 pb-8 md:pb-16 space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <h1 className="text-5xl md:text-7xl font-serif text-secondary-brown tracking-tighter italic">{user.name}</h1>
              <span className="px-5 py-1.5 bg-secondary-brown text-white text-[9px] font-black uppercase rounded-full tracking-[0.4em] shadow-lg">
                {user.role}
              </span>
            </div>
            <p className="text-xl md:text-2xl text-secondary-brown/60 font-medium max-w-2xl italic leading-relaxed px-4 md:px-0">
              "{user.bio || "Penjelajah TemuTempat yang belum menulis bio. Mari kurasi dunia."}"
            </p>
          </div>

          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="mb-8 md:mb-16 bg-white text-secondary-brown border-2 border-secondary-brown/10 px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-secondary-brown hover:text-white transition-all shadow-xl hover:-translate-y-1 cursor-pointer"
          >
            <Edit size={18} /> Edit Profil
          </button>
        </div>

        <div className="flex flex-wrap justify-center md:justify-start gap-8 px-8 md:px-20 pt-6">
           <div className="flex items-center gap-3 text-secondary-brown/60 text-[10px] font-black uppercase tracking-[0.25em]">
             <div className="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
               <Mail size={16} className="text-accent-gold" />
             </div>
             {user.email}
           </div>
           {user.phone && (
             <div className="flex items-center gap-3 text-secondary-brown/60 text-[10px] font-black uppercase tracking-[0.25em]">
               <div className="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                 <Phone size={16} className="text-accent-gold" />
               </div>
               {user.phone}
             </div>
           )}
           <div className="flex items-center gap-3 text-secondary-brown/60 text-[10px] font-black uppercase tracking-[0.25em]">
             <div className="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
               <Calendar size={16} className="text-accent-gold" />
             </div>
             MEMBER SEJAK {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }).toUpperCase() : "..."}
           </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-secondary-brown/60 backdrop-blur-md"
            ></motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] z-[1001]"
            >
              <div className="p-8 pb-4 border-b border-secondary-brown/5 flex justify-between items-center bg-white sticky top-0 z-10">
                <h2 className="text-2xl font-serif text-secondary-brown italic tracking-tight">Kustomisasi Profil</h2>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-secondary-brown/5 flex items-center justify-center hover:bg-secondary-brown/10 transition-all border-none cursor-pointer"
                >
                  <X size={20} className="text-secondary-brown" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 py-4 space-y-6 scrollbar-hide">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  {/* Upload Avatar */}
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-bg-cream shadow-lg">
                        <img src={editForm.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} className="w-full h-full object-cover" alt="preview" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 w-10 h-10 bg-accent-gold text-secondary-brown rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all border-none cursor-pointer"
                      >
                        <Upload size={16} />
                      </button>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-secondary-brown/40">Ketuk ikon untuk ganti foto</p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/40 ml-3">Nama</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-bg-cream border border-secondary-brown/10 rounded-2xl px-6 py-3 text-secondary-brown font-serif italic text-lg focus:outline-none focus:border-accent-gold transition-all"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/40 ml-3">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-bg-cream border border-secondary-brown/10 rounded-2xl px-6 py-3 text-secondary-brown font-medium text-sm focus:outline-none focus:border-accent-gold transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/40 ml-3">Nomor Telepon</label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-bg-cream border border-secondary-brown/10 rounded-2xl px-6 py-3 text-secondary-brown font-medium text-sm focus:outline-none focus:border-accent-gold transition-all"
                        placeholder="08..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/40 ml-3">Bio</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="w-full bg-bg-cream border border-secondary-brown/10 rounded-2xl px-6 py-3 text-secondary-brown font-medium text-sm min-h-[80px] focus:outline-none focus:border-accent-gold transition-all resize-none"
                    />
                  </div>

                  <div className="pt-2 flex gap-3 sticky bottom-0 bg-white py-4 border-t border-secondary-brown/5">
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 bg-secondary-brown/5 text-secondary-brown px-8 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-secondary-brown/10 transition-all border-none cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-secondary-brown text-white px-8 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-black transition-all shadow-xl border-none cursor-pointer"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {isCropModalOpen && tempImage && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            ></motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md h-[500px] rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-secondary-brown/5 flex justify-between items-center">
                <h2 className="text-xl font-serif text-secondary-brown italic">Sesuaikan Foto</h2>
                <button onClick={() => setIsCropModalOpen(false)} className="text-secondary-brown/40 hover:text-secondary-brown border-none bg-transparent cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 relative bg-black">
                <Cropper
                  image={tempImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape="round"
                  showGrid={false}
                />
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-[9px] font-black uppercase text-secondary-brown/40">Zoom</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-accent-gold"
                  />
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsCropModalOpen(false)}
                    className="flex-1 bg-secondary-brown/5 text-secondary-brown px-8 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest border-none cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleApplyCrop}
                    className="flex-1 bg-secondary-brown text-white px-8 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-black transition-all shadow-xl border-none cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Gunakan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats - Realtime data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {stats.map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-10 rounded-[3rem] border border-secondary-brown/5 shadow-xl text-center group hover:bg-secondary-brown hover:text-white transition-all duration-500 overflow-hidden relative"
          >
            {loadingStats && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center">
                <Loader2 size={32} className="text-secondary-brown/20 animate-spin" />
              </div>
            )}
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-brown/5 group-hover:bg-white/10 rounded-full -mr-16 -mt-16 transition-all duration-500"></div>
            <div className={`w-20 h-20 ${s.bg} rounded-3xl flex items-center justify-center mx-auto mb-8 ${s.color} group-hover:bg-white/20 group-hover:text-white transition-all duration-500 relative z-10`}>
              <s.icon size={40} />
            </div>
            <p className="text-7xl font-serif mb-2 italic tracking-tighter relative z-10">
              {loadingStats ? "..." : s.value}
            </p>
            <p className="text-[12px] font-black uppercase tracking-[0.5em] opacity-40 group-hover:opacity-60 relative z-10">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs Section */}
      <div className="space-y-12">
        <div className="flex border-b-2 border-secondary-brown/5 px-4 overflow-x-auto no-scrollbar">
          {[
            { name: "Tersimpan", icon: Bookmark },
            { name: "Kontribusi", icon: MessageSquare },
            { name: "Riwayat", icon: History }
          ].map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`px-12 py-8 text-sm font-bold uppercase tracking-[0.4em] transition-all relative bg-transparent border-none cursor-pointer flex items-center gap-4 ${
                activeTab === tab.name ? "text-accent-gold italic" : "text-secondary-brown/20 hover:text-secondary-brown/40"
              }`}
            >
              <tab.icon size={18} />
              {tab.name}
              {activeTab === tab.name && (
                <motion.div layoutId="activeTabProfile" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent-gold rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="px-4">
          <AnimatePresence mode="wait">
            {activeTab === "Tersimpan" && (
              <motion.div 
                key="saved"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-6"
              >
                {savedPlaces.length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <p className="text-secondary-brown/40 font-serif italic text-xl">Belum ada koleksi yang tersimpan.</p>
                    <Link to="/app/explore" className="text-accent-gold text-xs font-black uppercase tracking-widest mt-4 inline-block hover:underline">Mulai Jelajah →</Link>
                  </div>
                ) : (
                  savedPlaces.map((place, idx) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative h-80 rounded-[2.5rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer"
                    >
                      <img src={place.imageUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={place.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary-brown via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                      <div className="absolute bottom-6 left-6 right-6">
                        <p className="text-[8px] font-black uppercase tracking-widest text-accent-gold mb-1">{place.category[0] || "Umum"}</p>
                        <h4 className="text-xl font-serif text-white italic leading-tight">{place.name}</h4>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === "Kontribusi" && (
              <motion.div 
                key="contribution"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 max-w-4xl mx-auto"
              >
                {contributionPlaces.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-secondary-brown/40 font-serif italic text-xl">Bagikan penemuan hebatmu.</p>
                    <Link to="/app/add-place" className="text-accent-gold text-xs font-black uppercase tracking-widest mt-4 inline-block hover:underline">+ Tambahkan Tempat</Link>
                  </div>
                ) : (
                  contributionPlaces.map((place, idx) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-bg-cream/40 p-6 md:p-8 rounded-[3rem] border border-secondary-brown/10 flex flex-col md:flex-row gap-8 items-center group relative hover:bg-white transition-all shadow-sm hover:shadow-xl"
                    >
                      <div className="w-full md:w-48 h-40 rounded-3xl overflow-hidden flex-shrink-0">
                        <img src={place.imageUrl} className="w-full h-full object-cover" alt={place.name} />
                      </div>
                      <div className="flex-1 space-y-4 text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <h4 className="text-3xl font-serif text-secondary-brown italic tracking-tight">{place.name}</h4>
                          <span className="px-4 py-1.5 bg-accent-gold/20 text-accent-gold text-[8px] font-black uppercase rounded-full tracking-widest border border-accent-gold/20">
                            Terverifikasi
                          </span>
                        </div>
                        <p className="text-sm text-secondary-brown/60 leading-relaxed italic">"Tempat ini benar-benar memberikan ketenangan yang jarang ditemukan di pusat kota. Sangat direkomendasikan untuk sesi menyendiri."</p>
                        <div className="flex items-center justify-center md:justify-start gap-6 pt-2">
                          <div className="flex items-center gap-2 text-[9px] font-black text-secondary-brown/40 uppercase tracking-widest">
                            <Star size={14} className="text-accent-gold fill-accent-gold" /> {place.rating} Rating
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-black text-secondary-brown/40 uppercase tracking-widest">
                             <MapPin size={14} /> {place.address.split(',')[0]}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === "Riwayat" && (
              <motion.div 
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-2xl mx-auto relative px-8"
              >
                {/* Timeline line */}
                <div className="absolute left-14 top-8 bottom-8 w-[2px] bg-secondary-brown/10 hidden md:block"></div>
                
                {historyItems.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-secondary-brown/40 font-serif italic text-xl">Jejak langkahmu dimulai di sini.</p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    {historyItems.map((item, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex gap-8 items-start relative group"
                      >
                        {/* Timeline dot */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-lg group-hover:scale-110 transition-all border-4 border-white shrink-0 ${
                          idx === 0 ? "bg-accent-gold text-white" : "bg-bg-cream text-secondary-brown/40"
                        }`}>
                           {idx === 0 ? <Check size={20} /> : <div className="w-2 h-2 rounded-full bg-current"></div>}
                        </div>
                        
                        <div className="flex-1 pt-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-brown/30 mb-2">{item.date}</p>
                          <div className="bg-white p-6 rounded-[2.5rem] border border-secondary-brown/5 shadow-sm group-hover:shadow-xl transition-all group-hover:-translate-y-1">
                             <p className="text-[9px] font-black uppercase tracking-widest text-[#FFB6C1] mb-2">{item.action}</p>
                             <h4 className="text-xl font-serif text-secondary-brown italic">{item.name}</h4>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
