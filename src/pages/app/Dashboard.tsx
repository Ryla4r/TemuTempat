import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Search, MapPin, Sparkles, Star, Clock, 
  ChevronRight, ArrowRight, Loader2, Heart, Bookmark,
  ShieldCheck, Activity, Users, MessageSquare, 
  Trash2, Edit3, Save, Circle, UserPlus,
  CheckCircle2, Navigation, X, Zap, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dataService } from "../../services/dataService";
import { Place, Review } from "../../types";
import { geminiService } from "../../services/geminiService";
import MapComponent from "../../components/MapComponent";
import { ImageEditor } from "../../components/ImageEditor";

function AnimatedNumber({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1">
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-serif italic text-secondary-brown"
      >
        {value}
      </motion.p>
      <p className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/30">{label}</p>
    </div>
  );
}

function AdminControlCenter() {
  const [activeTab, setActiveTab] = useState<"overview" | "places" | "reviews" | "users">("overview");
  const [places, setPlaces] = useState<Place[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [imageToEdit, setImageToEdit] = useState<{ src: string; type: 'new' | 'edit' } | null>(null);
  const [newPlace, setNewPlace] = useState<Partial<Place>>({
    name: "",
    description: "",
    category: [],
    address: "",
    imageUrl: ""
  });

  useEffect(() => {
    const unsubPlaces = dataService.subscribeToPlaces(setPlaces);
    const unsubReviews = dataService.subscribeToReviews(setReviews);
    const unsubUsers = dataService.subscribeToUsers(setUsers);
    setLoading(false);
    return () => {
      unsubPlaces();
      unsubReviews();
      unsubUsers();
    };
  }, []);

  const handleAddPlace = async () => {
    if (!newPlace.name) return;
    await dataService.addPlace({
      ...newPlace,
      name: newPlace.name,
      description: newPlace.description || "",
      imageUrl: newPlace.imageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
      latitude: -6.2,
      longitude: 106.8,
      category: newPlace.category || ["General"],
      priceLevel: 1,
      addedBy: "Admin"
    } as any);
    setShowAddPlace(false);
    setNewPlace({});
  };

  const handleUpdatePlace = async () => {
    if (!editingPlace) return;
    await dataService.updatePlace(editingPlace.id, editingPlace);
    setEditingPlace(null);
  };

  const handleDeletePlace = async (id: string) => {
    if (confirm("Hapus data ini?")) await dataService.deletePlace(id);
  };

  if (loading) return null;

  return (
    <div className="space-y-12 pb-20 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-secondary-brown/10 pb-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-accent-gold font-extrabold uppercase tracking-[0.4em] text-[10px]">
            <ShieldCheck size={14} /> Admin Overview
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-secondary-brown leading-[0.9] tracking-tight">
            Console.
          </h1>
        </div>
        
        <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-secondary-brown/5">
          {(["overview", "places", "reviews", "users"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer ${
                activeTab === tab ? "bg-secondary-brown text-white shadow-lg" : "text-secondary-brown/40 hover:text-secondary-brown"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-secondary-brown/5 shadow-sm">
              <AnimatedNumber value={users.length} label="Total Users" />
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-secondary-brown/5 shadow-sm">
              <AnimatedNumber value={places.length} label="Total Places" />
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-secondary-brown/5 shadow-sm">
              <AnimatedNumber value={reviews.length} label="Total Reviews" />
            </div>
          </motion.div>
        )}

        {activeTab === "places" && (
          <motion.div key="places" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-secondary-brown/5">
              <h3 className="text-3xl font-serif text-secondary-brown italic">Artifact Catalog.</h3>
              <button 
                onClick={() => setShowAddPlace(true)} 
                className="bg-accent-gold text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest border-none cursor-pointer shadow-lg shadow-accent-gold/20"
              >
                ADD NEW PLACE
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6">
              {Array.isArray(places) && places.map(place => (
                <div key={place.id} className="bg-white p-6 rounded-[2rem] border border-secondary-brown/5 flex items-center gap-8">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-bg-cream shrink-0">
                    <img src={place.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-2xl font-serif font-bold text-secondary-brown leading-tight">{place.name}</h4>
                    <p className="text-secondary-brown/40 text-xs italic line-clamp-1">{place.address}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingPlace(place)} className="p-3 rounded-xl bg-secondary-brown/10 text-secondary-brown border-none cursor-pointer"><Edit3 size={16} /></button>
                    <button onClick={() => handleDeletePlace(place.id)} className="p-3 rounded-xl bg-red-50 text-red-500 border-none cursor-pointer"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Place Minimal Modal */}
      <AnimatePresence>
        {(showAddPlace || editingPlace) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3000] bg-secondary-brown/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-bg-cream w-full max-w-lg p-10 rounded-[3rem] shadow-2xl relative">
              <h2 className="text-4xl font-serif text-secondary-brown mb-8 italic text-center">Edit Record</h2>
              <div className="space-y-6">
                <input 
                   className="w-full bg-white/50 border-none rounded-2xl p-4 outline-none font-serif text-lg italic" 
                   value={editingPlace ? editingPlace.name : newPlace.name} 
                   onChange={e => editingPlace ? setEditingPlace({...editingPlace, name: e.target.value}) : setNewPlace({...newPlace, name: e.target.value})}
                   placeholder="Name"
                />
                <div className="flex gap-3">
                  <button onClick={editingPlace ? handleUpdatePlace : handleAddPlace} className="flex-1 bg-secondary-brown text-white py-4 rounded-xl font-black text-[10px] uppercase">SAVE</button>
                  <button onClick={() => { setShowAddPlace(false); setEditingPlace(null); }} className="px-6 bg-black/5 text-secondary-brown py-4 rounded-xl font-serif italic border-none cursor-pointer">CANCEL</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserDashboard() {
  const [aiInput, setAiInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("Mencari lokasi...");
  const [nearbyTrending, setNearbyTrending] = useState<any[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const aiAbortController = useRef<AbortController | null>(null);
  
  const [userStats, setUserStats] = useState({ exploredCount: 0, savedCount: 0, reviewCount: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Social Post State
  const [postCaption, setPostCaption] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    if (publishFeedback && publishFeedback.type === 'success') {
      const timer = setTimeout(() => setPublishFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [publishFeedback]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPostFile(file);
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      setPublishFeedback(null);
    }
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !postFile || isPublishing) return;

    setIsPublishing(true);
    setPublishFeedback(null);
    try {
      // 1. Upload to Storage
      const { storageService } = await import('../../services/storageService');
      const mediaUrl = await storageService.uploadMedia(postFile);
      
      // 2. Insert to Database
      await dataService.addPost({
        user_id: user.id,
        username: user.name || user.email,
        media_url: mediaUrl,
        caption: postCaption
      });
      
      // 3. Reset state
      setPostFile(null);
      setFilePreview(null);
      setPostCaption("");
      setPublishFeedback({ type: 'success', message: "Petualanganmu berhasil dibagikan! 🚀" });
    } catch (err: any) {
      console.error("Publishing error:", err);
      setPublishFeedback({ 
        type: 'error', 
        message: err.message || "Gagal membagikan petualangan." 
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const fetchUserStats = useCallback(async () => {
    if (!user) return;
    try {
      const stats = await dataService.getUserStats(user.id);
      
      // Calculate local history length for "Tempat Ditemukan" fallback
      const historyKey = `recent_places_${user.id}`;
      const savedHistory = localStorage.getItem(historyKey);
      const localHistoryLength = savedHistory ? JSON.parse(savedHistory).length : 0;
      
      setUserStats({
        ...stats,
        exploredCount: Math.max(stats.exploredCount || 0, localHistoryLength)
      });
    } catch (e) {
      console.error("Dashboard stats failed:", e);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user]);

  const refreshLocation = () => {
    setLocationName("Mencari lokasi...");
    setErrorStatus(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(coords);
          
          // Reverse Geocode
          try {
            let name = "";
            
            const res = await fetch(`/api/geocode?lat=${coords.lat}&lng=${coords.lng}`);
            if (!res.ok) throw new Error("Server responded with error");
            const data = await res.json();
            
            // Handle Google Maps response
            if (data.results && data.results[0]) {
              const cityComponent = data.results[0].address_components.find((c: any) => c.types.includes("administrative_area_level_2") || c.types.includes("locality") || c.types.includes("sublocality"));
              name = cityComponent?.long_name || data.results[0].formatted_address;
            } 
            // Handle Nominatim fallback from server
            else if (data.nominatim) {
              const nd = data.nominatim;
              const district = nd.address?.suburb || nd.address?.neighbourhood || nd.address?.village || nd.address?.hamlet || nd.address?.town;
              const city = nd.address?.city || nd.address?.city_district || nd.address?.regency || nd.address?.county;
              if (district && city) name = `${district}, ${city}`;
              else name = district || city || "Lokasi saat ini";
            }
            
            setLocationName(name || "Lokasi saat ini");
          } catch (e) {
            console.warn("Geocoding failed:", e);
            setLocationName("Lokasi saat ini");
          }
        },
        (error) => {
          console.error("Geolocation failed:", error);
          setLocationName("GPS tidak aktif / Izin ditolak");
        }
      );
    }
  };

  useEffect(() => {
    const unsubscribe = dataService.subscribeToPlaces(setPlaces);
    refreshLocation();
    fetchUserStats();
    setLoading(false);

    // Subscribe to realtime updates for stats
    const genericHandler = (e: any) => {
      const table = e.detail?.table;
      if (table === 'bookmarks' || table === 'user_views' || table === 'reviews' || e.type === 'history_updated') {
         fetchUserStats();
      }
    };
    dataService.events.addEventListener('change', genericHandler);
    window.addEventListener('history_updated', genericHandler);

    return () => {
      unsubscribe();
      dataService.events.removeEventListener('change', genericHandler);
      window.removeEventListener('history_updated', genericHandler);
      if (aiAbortController.current) aiAbortController.current.abort();
    };
  }, [fetchUserStats]);

  // Fetch nearby trending when location is found
  const lastFetchedLocation = useRef<string>("");
  useEffect(() => {
    const isLocationValid = userLocation && locationName && !["Mencari lokasi...", "Lokasi tidak dikenal", "Lokasi saat ini", "Gagal mendeteksi nama lokasi", "GPS tidak aktif / Izin ditolak"].includes(locationName);
    
    if (isLocationValid && locationName !== lastFetchedLocation.current) {
      lastFetchedLocation.current = locationName;
      fetchNearbySuggestions();
    }
  }, [userLocation, locationName]);

  const fetchNearbySuggestions = async () => {
    if (!userLocation) return;
    
    // Abort previous request
    if (aiAbortController.current) aiAbortController.current.abort();
    aiAbortController.current = new AbortController();

    setIsLoadingNearby(true);
    setErrorStatus(null);
    try {
      // Add a client-side timeout for AI calls
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("TIMEOUT")), 90000)
      );

      const aiPromise = geminiService.getNearbyTrending(locationName, userLocation, places);
      
      const result = await Promise.race([aiPromise, timeoutPromise]) as any;

      if (result && result.recommendations) {
        setNearbyTrending(result.recommendations);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Nearby trending failed:", err);
      if (err.message === "QUOTA_EXHAUSTED") {
        setErrorStatus("QUOTA");
      } else if (err.message === "TIMEOUT") {
        setErrorStatus("TIMEOUT");
      } else {
        setErrorStatus("GENERIC");
      }
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const handleSmartSearch = async () => {
    if (!aiInput.trim()) return;
    setIsSearching(true);
    navigate(`/app/explore?q=${encodeURIComponent(aiInput)}`);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-cream">
       <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-12 h-12 border-4 border-accent-gold border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-24 pb-20 mt-10">
      {/* Real-time Location Indicator */}
      <section className="px-6 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-accent-gold/5 border border-accent-gold/10 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-gold/20 rounded-full flex items-center justify-center text-accent-gold animate-pulse">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-accent-gold/60 mb-1">Status Real-time</p>
              <h3 className="text-xl font-serif text-secondary-brown italic">Saat ini Anda berada di <span className="text-secondary-brown font-bold not-italic">{locationName}</span></h3>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={refreshLocation}
              className="flex items-center gap-2 px-4 py-2 bg-white/50 hover:bg-white rounded-full transition-all border-none cursor-pointer text-[10px] font-black uppercase tracking-widest text-secondary-brown/60"
            >
               <Navigation size={12} /> Refresh Lokasi
            </button>
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
               <span className="text-[10px] font-bold text-secondary-brown/40 uppercase tracking-widest">GPS Aktif</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* User Quick Stats */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Ulasan Kolektif", value: userStats.reviewCount, icon: Star, color: "text-accent-gold", bg: "bg-accent-gold/5" },
            { label: "Tempat Ditemukan", value: userStats.exploredCount, icon: MapPin, color: "text-secondary-brown", bg: "bg-secondary-brown/5" },
            { label: "Koleksi Tersimpan", value: userStats.savedCount, icon: Bookmark, color: "text-secondary-brown", bg: "bg-secondary-brown/5" },
          ].map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => navigate('/app/profile')}
              className="bg-white p-6 rounded-[2.5rem] border border-secondary-brown/5 flex items-center justify-between group hover:bg-secondary-brown hover:text-white transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${s.bg} ${s.color} group-hover:bg-white/20 group-hover:text-white transition-all`}>
                  <s.icon size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-60">{s.label}</p>
                  <p className="text-3xl font-serif italic leading-none">{isLoadingStats ? "..." : s.value}</p>
                </div>
              </div>
              <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Hero AI Navigator */}
      <section className="relative pt-10 pb-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(circle_at_center,rgba(194,166,140,0.1)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-gold/10 rounded-full text-accent-gold text-[10px] font-black uppercase tracking-[0.3em]">
              <Sparkles size={14} /> AI-Powered Navigator
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-serif text-secondary-brown leading-[0.85] tracking-tighter">
              Discover <br />
              <span className="italic text-secondary-brown/60">Indo Vibes.</span>
            </h1>
            <p className="text-secondary-brown/50 text-base md:text-xl max-w-2xl mx-auto font-medium leading-relaxed italic">
              "Temukan hidden gem terbaik di <span className="text-secondary-brown border-b border-accent-gold/30">{locationName}</span> hari ini."
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative group max-w-2xl mx-auto">
            <div className="absolute -inset-4 bg-accent-gold/20 rounded-[4rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative bg-white p-3 md:p-5 rounded-[3rem] shadow-2xl border border-secondary-brown/10 flex items-center gap-2">
              <input 
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                placeholder="Cari tempat nongkrong atau vibe tertentu..."
                className="w-full bg-transparent border-none py-4 px-6 outline-none font-serif italic text-2xl md:text-3xl text-secondary-brown placeholder:text-secondary-brown/20"
              />
              <button 
                onClick={handleSmartSearch} 
                disabled={isSearching} 
                className="bg-secondary-brown text-white p-4 md:p-6 rounded-[2.5rem] hover:bg-accent-gold transition-all border-none cursor-pointer shadow-lg"
              >
                {isSearching ? <Loader2 size={32} className="animate-spin" /> : <Search size={32} />}
              </button>
            </div>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3 opacity-60">
            {["Cafe Vintage", "Taman Sepi", "Bekerja Nyaman", "Hidden Gem Viral"].map(vibe => (
              <button 
                key={vibe}
                onClick={() => setAiInput(vibe)}
                className="px-4 py-2 rounded-full border border-secondary-brown/10 bg-white/50 text-[10px] font-bold text-secondary-brown hover:bg-secondary-brown hover:text-white transition-all cursor-pointer"
              >
                # {vibe}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Nearby Trending Recommendations */}
      <section className="px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-secondary-brown/10 pb-10 gap-6">
          <div className="space-y-2">
             <div className="flex items-center gap-2 text-accent-gold text-[10px] font-black uppercase tracking-widest">
               <Activity size={14} className="text-red-500" /> Sedang Viral di {locationName}
             </div>
             <h2 className="text-5xl font-serif italic text-secondary-brown tracking-tighter">Rekomendasi Pintar.</h2>
          </div>
          {isLoadingNearby && (
            <div className="flex items-center gap-2 text-secondary-brown/40 font-serif italic">
               <Loader2 size={16} className="animate-spin" /> Menganalisis vibe sekitar...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <AnimatePresence>
            {isLoadingNearby ? (
              // Skeletons
              [...Array(4)].map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white/40 rounded-[2.5rem] border border-secondary-brown/5 overflow-hidden animate-pulse">
                  <div className="h-48 bg-secondary-brown/5" />
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                       <div className="h-6 bg-secondary-brown/5 rounded-full w-3/4" />
                       <div className="h-3 bg-secondary-brown/5 rounded-full w-1/2" />
                    </div>
                    <div className="space-y-1">
                       <div className="h-3 bg-secondary-brown/5 rounded-full w-full" />
                       <div className="h-3 bg-secondary-brown/5 rounded-full w-2/3" />
                    </div>
                  </div>
                </div>
              ))
            ) : nearbyTrending.length > 0 ? (
              nearbyTrending.map((place, idx) => (
                <motion.div 
                  key={place.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ y: -8 }} 
                  className="bg-white rounded-[2.5rem] border border-secondary-brown/5 overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col"
                  onClick={() => navigate(`/app/place/${place.id}`, { state: { place } })}
                >
                  <div className="h-48 relative overflow-hidden">
                    <img src={place.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={place.name} />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-accent-gold flex items-center gap-1 shadow-sm">
                      <Sparkles size={10} /> AI Pick
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                       <h3 className="text-xl font-serif italic text-secondary-brown group-hover:text-black transition-colors">{place.name}</h3>
                       <p className="text-[10px] text-accent-gold font-bold uppercase tracking-widest mb-3">{place.insight}</p>
                       <p className="text-xs text-secondary-brown/40 line-clamp-2 italic">{place.description}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-secondary-brown/5">
                       <span className="text-[9px] font-black text-secondary-brown/30 uppercase tracking-widest flex items-center gap-1">
                         <MapPin size={10} /> {place.address.split(',')[0]}
                       </span>
                       <div className="w-8 h-8 rounded-full bg-secondary-brown/5 flex items-center justify-center text-secondary-brown group-hover:bg-accent-gold group-hover:text-white transition-colors">
                          <ChevronRight size={14} />
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center space-y-6">
                 <div className="w-24 h-24 bg-accent-gold/5 rounded-full flex items-center justify-center mx-auto text-accent-gold/40 border border-accent-gold/10">
                   {errorStatus === "QUOTA" ? <Zap size={40} className="text-red-400" /> : <Navigation size={40} />}
                 </div>
                 <div className="space-y-2">
                    <p className="text-secondary-brown/60 font-serif text-2xl italic max-w-lg mx-auto leading-tight">
                      {errorStatus === "QUOTA" 
                        ? "Maaf, kuota Gemini AI sedang penuh. Kami tidak bisa memproses rekomendasi pintar saat ini."
                        : errorStatus === "TIMEOUT"
                        ? "Pencarian AI memakan waktu terlalu lama. Sinyal mungkin kurang stabil."
                        : `Kami kesulitan mendeteksi vibe pintar secara real-time di sekitar ${locationName}.`}
                    </p>
                    <p className="text-sm text-secondary-brown/30 font-medium max-w-sm mx-auto">
                      {errorStatus === "QUOTA"
                        ? "Coba lagi beberapa detik lagi untuk mengaktifkan kembali pemindaian AI."
                        : "Pastikan GPS aktif dan koneksi internet stabil."}
                    </p>
                 </div>
                 <button 
                  onClick={fetchNearbySuggestions} 
                  className="bg-secondary-brown text-white px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all cursor-pointer border-none shadow-2xl flex items-center gap-3 mx-auto"
                >
                  <RefreshCw size={14} className={isLoadingNearby ? "animate-spin" : ""} />
                  {errorStatus === "QUOTA" ? "Coba Lagi Sekarang" : "Segarkan Penjelajahan AI"}
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Featured Grid */}
      <section className="px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex items-end justify-between border-b border-secondary-brown/10 pb-10">
          <h2 className="text-5xl font-serif italic text-secondary-brown tracking-tighter">Handpicked Gems.</h2>
          <button onClick={() => navigate('/app/explore')} className="flex items-center gap-3 text-secondary-brown/40 hover:text-secondary-brown transition-all border-none bg-transparent cursor-pointer font-black text-[10px] uppercase tracking-widest">
            Lihat Peta Lengkap <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {(Array.isArray(places) ? places : []).filter(p => p.isFeatured).slice(0, 3).map(place => (
            <motion.div key={place.id} whileHover={{ y: -12 }} className="group cursor-pointer" onClick={() => navigate(`/app/place/${place.id}`, { state: { place } })}>
               <div className="aspect-[3/4] rounded-[3.5rem] overflow-hidden mb-8 relative shadow-2xl">
                  <img src={place.imageUrl} className="w-full h-full object-cover grayscale transition-all duration-1000 group-hover:grayscale-0 group-hover:scale-110" alt="" />
                  <div className="absolute top-8 right-8 w-14 h-14 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/30">
                     <Heart size={20} />
                  </div>
               </div>
               <div className="space-y-3 px-4">
                  <h3 className="text-3xl font-serif italic text-secondary-brown group-hover:text-black transition-colors">{place.name}</h3>
                  <p className="text-secondary-brown/40 text-sm font-medium italic">{place.address}</p>
               </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdminView = user?.role === "admin";
  return isAdminView ? <AdminControlCenter /> : <UserDashboard />;
}
