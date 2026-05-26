import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Search, MapPin, Sparkles, Star,
  ChevronRight, ArrowRight, Loader2, Bookmark,
  Activity, Navigation, Zap, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dataService } from "../../services/dataService";
import { Place } from "../../types";
import { geminiService } from "../../services/geminiService";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const [publishFeedback, setPublishFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchUserStats = useCallback(async () => {
    if (!user) return;
    try {
      const stats = await dataService.getUserStats(user.id);
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
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(coords);
          try {
            const res = await fetch(`/api/geocode?lat=${coords.lat}&lng=${coords.lng}`);
            if (!res.ok) throw new Error("Server error");
            const data = await res.json();
            let name = "";
            if (data.results && data.results[0]) {
              const c = data.results[0].address_components.find((c: any) =>
                c.types.includes("administrative_area_level_2") ||
                c.types.includes("locality") ||
                c.types.includes("sublocality")
              );
              name = c?.long_name || data.results[0].formatted_address;
            } else if (data.nominatim) {
              const nd = data.nominatim;
              const district = nd.address?.suburb || nd.address?.neighbourhood || nd.address?.village || nd.address?.town;
              const city = nd.address?.city || nd.address?.regency || nd.address?.county;
              name = district && city ? `${district}, ${city}` : district || city || "Lokasi saat ini";
            }
            setLocationName(name || "Lokasi saat ini");
          } catch {
            setLocationName("Lokasi saat ini");
          }
        },
        () => setLocationName("GPS tidak aktif / Izin ditolak")
      );
    }
  };

  useEffect(() => {
    const unsub = dataService.subscribeToPlaces(setPlaces);
    refreshLocation();
    fetchUserStats();
    setLoading(false);

    const genericHandler = (e: any) => {
      const table = e.detail?.table;
      if (table === 'bookmarks' || table === 'user_views' || table === 'reviews' || e.type === 'history_updated') {
        fetchUserStats();
      }
    };
    dataService.events.addEventListener('change', genericHandler);
    window.addEventListener('history_updated', genericHandler);

    return () => {
      unsub();
      dataService.events.removeEventListener('change', genericHandler);
      window.removeEventListener('history_updated', genericHandler);
      if (aiAbortController.current) aiAbortController.current.abort();
    };
  }, [fetchUserStats]);

  const lastFetchedLocation = useRef<string>("");
  useEffect(() => {
    const valid = userLocation && locationName && !["Mencari lokasi...", "Lokasi tidak dikenal", "Lokasi saat ini", "GPS tidak aktif / Izin ditolak"].includes(locationName);
    if (valid && locationName !== lastFetchedLocation.current) {
      lastFetchedLocation.current = locationName;
      fetchNearbySuggestions();
    }
  }, [userLocation, locationName]);

  const fetchNearbySuggestions = async () => {
    if (!userLocation) return;
    if (aiAbortController.current) aiAbortController.current.abort();
    aiAbortController.current = new AbortController();
    setIsLoadingNearby(true);
    setErrorStatus(null);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 90000));
      const aiPromise = geminiService.getNearbyTrending(locationName, userLocation, places);
      const result = await Promise.race([aiPromise, timeoutPromise]) as any;
      if (result?.recommendations) setNearbyTrending(result.recommendations);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (err.message === "QUOTA_EXHAUSTED") setErrorStatus("QUOTA");
      else if (err.message === "TIMEOUT") setErrorStatus("TIMEOUT");
      else setErrorStatus("GENERIC");
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const handleSmartSearch = () => {
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
      {/* Location Indicator */}
      <section className="px-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="bg-accent-gold/5 border border-accent-gold/10 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-gold/20 rounded-full flex items-center justify-center text-accent-gold animate-pulse">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-accent-gold/60 mb-1">Status Real-time</p>
              <h3 className="text-xl font-serif text-secondary-brown italic">
                Saat ini Anda berada di <span className="font-bold not-italic">{locationName}</span>
              </h3>
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
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[10px] font-bold text-secondary-brown/40 uppercase tracking-widest">GPS Aktif</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* User Stats */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Ulasan Kolektif", value: userStats.reviewCount, icon: Star, color: "text-accent-gold", bg: "bg-accent-gold/5" },
            { label: "Tempat Ditemukan", value: userStats.exploredCount, icon: MapPin, color: "text-secondary-brown", bg: "bg-secondary-brown/5" },
            { label: "Koleksi Tersimpan", value: userStats.savedCount, icon: Bookmark, color: "text-secondary-brown", bg: "bg-secondary-brown/5" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
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
              Discover <br /><span className="italic text-secondary-brown/60">Indo Vibes.</span>
            </h1>
            <p className="text-secondary-brown/50 text-base md:text-xl max-w-2xl mx-auto font-medium leading-relaxed italic">
              "Temukan hidden gem terbaik di <span className="text-secondary-brown border-b border-accent-gold/30">{locationName}</span> hari ini."
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative group max-w-2xl mx-auto">
            <div className="absolute -inset-4 bg-accent-gold/20 rounded-[4rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative bg-white p-3 md:p-5 rounded-[3rem] shadow-2xl border border-secondary-brown/10 flex items-center gap-2">
              <input
                type="text" value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSmartSearch()}
                placeholder="Cari tempat nongkrong atau vibe tertentu..."
                className="w-full bg-transparent border-none py-4 px-6 outline-none font-serif italic text-2xl md:text-3xl text-secondary-brown placeholder:text-secondary-brown/20"
              />
              <button
                onClick={handleSmartSearch} disabled={isSearching}
                className="bg-secondary-brown text-white p-4 md:p-6 rounded-[2.5rem] hover:bg-accent-gold transition-all border-none cursor-pointer shadow-lg"
              >
                {isSearching ? <Loader2 size={32} className="animate-spin" /> : <Search size={32} />}
              </button>
            </div>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3 opacity-60">
            {["Cafe Vintage", "Taman Sepi", "Bekerja Nyaman", "Hidden Gem Viral"].map(vibe => (
              <button
                key={vibe} onClick={() => setAiInput(vibe)}
                className="px-4 py-2 rounded-full border border-secondary-brown/10 bg-white/50 text-[10px] font-bold text-secondary-brown hover:bg-secondary-brown hover:text-white transition-all cursor-pointer"
              >
                # {vibe}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Nearby Trending */}
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
              [...Array(4)].map((_, i) => (
                <div key={`sk-${i}`} className="bg-white/40 rounded-[2.5rem] border border-secondary-brown/5 overflow-hidden animate-pulse">
                  <div className="h-48 bg-secondary-brown/5" />
                  <div className="p-6 space-y-3">
                    <div className="h-5 bg-secondary-brown/5 rounded-full w-3/4" />
                    <div className="h-3 bg-secondary-brown/5 rounded-full w-1/2" />
                    <div className="h-3 bg-secondary-brown/5 rounded-full w-full" />
                  </div>
                </div>
              ))
            ) : nearbyTrending.length > 0 ? (
              nearbyTrending.map((place, idx) => (
                <motion.div
                  key={place.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
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
                      ? "Kuota Gemini AI sedang penuh."
                      : errorStatus === "TIMEOUT"
                      ? "Pencarian AI memakan waktu terlalu lama."
                      : `Kami kesulitan mendeteksi vibe di sekitar ${locationName}.`}
                  </p>
                </div>
                <button
                  onClick={fetchNearbySuggestions}
                  className="bg-secondary-brown text-white px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all cursor-pointer border-none shadow-2xl flex items-center gap-3 mx-auto"
                >
                  <RefreshCw size={14} className={isLoadingNearby ? "animate-spin" : ""} />
                  Segarkan Penjelajahan AI
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}