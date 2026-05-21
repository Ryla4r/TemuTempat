import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Map as MapIcon, List, Navigation, Compass, Sparkles, X, Loader2, ArrowRight, AlertCircle, History, ExternalLink, MapPin } from "lucide-react";
import { dataService } from "../../services/dataService";
import { geminiService } from "../../services/geminiService";
import MapComponent from "../../components/MapComponent";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Place } from "../../types";
import { calculateDistance } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";

export default function Explore() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<"map" | "list">("map");
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [apiPlaces, setApiPlaces] = useState<Place[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // AI Recommendation State
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<{ id: string, insight: string }[] | null>(null);
  const [aiTitle, setAiTitle] = useState("");
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load recently viewed places per user
  const loadHistory = useCallback(() => {
    if (user?.id) {
      const historyKey = `recent_places_${user.id}`;
      const saved = localStorage.getItem(historyKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Defensive deduplication just in case
          const unique = parsed.filter((p: any, index: number, self: any[]) => 
            index === self.findIndex((t: any) => t.name.toLowerCase().trim() === p.name.toLowerCase().trim())
          );
          setRecentPlaces(unique);
        } catch (e) {
          console.error("Failed to parse recent places:", e);
        }
      } else {
        setRecentPlaces([]);
      }
    } else {
      setRecentPlaces([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadHistory();
    
    // Listen for history updates from other components
    window.addEventListener('history_updated', loadHistory);
    return () => window.removeEventListener('history_updated', loadHistory);
  }, [loadHistory]);

  const clearHistory = useCallback(() => {
    if (!user?.id) return;
    const historyKey = `recent_places_${user.id}`;
    localStorage.removeItem(historyKey);
    setRecentPlaces([]);
    window.dispatchEvent(new CustomEvent('history_updated'));
  }, [user?.id]);

  const hasAutoSearched = React.useRef(false);
  // Handle URL query for smart search
  useEffect(() => {
    const query = searchParams.get('q');
    if (query && !aiLoading && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      setAiInput(query);
      // Small delay to ensure map is ready
      const timer = setTimeout(() => {
        handleAiSearch(query);
      }, 1000);
      return () => clearTimeout(timer);
    }

    const id = searchParams.get('id');
    if (id) {
      setSelectedPlaceId(id);
    }
  }, [searchParams]);

  const allPlaces = useMemo(() => {
    // Combine unique places from local db and local API results
    const combined = [...places];
    if (Array.isArray(apiPlaces)) {
      apiPlaces.forEach(ap => {
        if (!combined.find(p => p.id === ap.id || p.name === ap.name)) {
          combined.push(ap);
        }
      });
    }
    return combined;
  }, [places, apiPlaces]);

  useEffect(() => {
    // Get user location
    let watchId: number;
    if (navigator.geolocation) {
      const handlePosition = (position: GeolocationPosition) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      };
      
      const handleError = (error: GeolocationPositionError) => {
        console.error("Gagal mendapatkan lokasi:", error);
      };

      navigator.geolocation.getCurrentPosition(handlePosition, handleError);
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [errorVisible, setErrorVisible] = useState<string | null>(null);
  const loadingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Safety valve for aiLoading
  useEffect(() => {
    if (aiLoading) {
      loadingTimerRef.current = setTimeout(() => {
        setAiLoading(false);
        setErrorVisible("Proses AI terlalu lama. Menampilkan hasil seadanya...");
      }, 45000); // 45 seconds timeout
    } else {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    }
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [aiLoading]);
  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        const data = await dataService.getPlaces();
        setPlaces(Array.isArray(data) ? data : []);
        if (!Array.isArray(data) || data.length === 0) {
           // Don't set errorVisible for empty database, it's a normal state for new apps
           console.log("Database is empty, inviting user to use AI search.");
        }
      } catch (err) {
        console.error("Gagal mengambil data:", err);
        setPlaces([]);
        setErrorVisible("Sepertinya Supabase belum terhubung. Cek Environment Variables (SUPABASE_URL & SUPABASE_KEY) di Settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();

    const subscription = dataService.subscribePlaces((payload: any) => {
      if (payload.eventType === 'INSERT') {
        setPlaces(prev => [dataService.mapPlace(payload.new), ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setPlaces(prev => prev.map(p => p.id === payload.new.id ? dataService.mapPlace(payload.new) : p));
      } else if (payload.eventType === 'DELETE') {
        setPlaces(prev => prev.filter(p => p.id !== payload.new?.id && p.id !== payload.old?.id));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navigate = useNavigate();

  const handleNavigateToDetail = async (place: Place) => {
    if (aiLoading) return;
    
    // Save to Recently Viewed History
    if (user?.id) {
      const historyKey = `recent_places_${user.id}`;
      try {
        const saved = localStorage.getItem(historyKey);
        let history = saved ? JSON.parse(saved) : [];
        const entry = {
          id: place.id,
          name: place.name,
          imageUrl: place.imageUrl,
          category: place.category,
          address: place.address,
          rating: place.rating,
          viewedAt: new Date().toISOString()
        };
        // Remove if exists by ID or Name (case-insensitive) to prevent duplicates
        history = history.filter((p: any) => p.id !== place.id && p.name.toLowerCase().trim() !== place.name.toLowerCase().trim());
        // Add to front
        history.unshift(entry);
        localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 15)));
        window.dispatchEvent(new CustomEvent('history_updated'));
      } catch (e) {
        console.error("Failed to save to history", e);
      }
    }

    // If it's a temporary place from Google AI, save it to the DB first so it becomes 'real'
    if (place.addedBy === "Google AI" || place.id?.startsWith('ai-new') || place.id?.startsWith('bulk-')) {
      setAiLoading(true);
      try {
        console.log("Auto-persisting AI place:", place.name);
        // Double check if it exists by coordinates OR Name to prevent duplicates
        const existing = places.find(p => p.name.toLowerCase() === place.name.toLowerCase() || (Math.abs(p.latitude - place.latitude) < 0.0001 && Math.abs(p.longitude - place.longitude) < 0.0001));
        
        if (!existing) {
          const saved = await dataService.addPlace({
            name: place.name,
            address: place.address,
            description: place.description || "Tempat menarik ditemukan lewat AI.",
            imageUrl: place.imageUrl,
            latitude: place.latitude,
            longitude: place.longitude,
            category: place.category,
            priceLevel: place.priceLevel || 1,
            addedBy: user?.id || "00000000-0000-0000-0000-000000000000"
          });
          
          if (saved && saved.id) {
             console.log("Place auto-persisted with ID:", saved.id);
             // Update history with the real ID
             const historyKey = `recent_places_${user?.id || 'anon'}`;
             const s = localStorage.getItem(historyKey);
             if (s) {
               let h = JSON.parse(s);
               h = h.map((item: any) => (item.name === place.name) ? { ...item, id: saved.id } : item);
               localStorage.setItem(historyKey, JSON.stringify(h));
             }
             navigate(`/app/place/${saved.id}`, { state: { place: saved } });
             return;
          }
        } else {
           console.log("Place already exists in DB, using ID:", existing.id);
           navigate(`/app/place/${existing.id}`, { state: { place: existing } });
           return;
        }
      } catch (err: any) {
        console.error("Auto-persist failed:", err);
      } finally {
        setAiLoading(false);
      }
    }
    
    navigate(`/app/place/${place.id}`, { state: { place } });
  };


  const lastAiSearchTime = React.useRef(0);
  const handleAiSearch = async (overrideQuery?: string | any) => {
    // Throttle: 3 seconds between AI searches
    const now = Date.now();
    if (now - lastAiSearchTime.current < 3000 && !overrideQuery) {
      console.warn("Throttling AI search");
      return;
    }
    lastAiSearchTime.current = now;

    let queryToUse = (typeof overrideQuery === 'string' ? overrideQuery : null) || aiInput;
    if (!queryToUse || typeof queryToUse !== 'string' || !queryToUse.trim()) {
       setErrorVisible("Masukkan kata kunci pencarian terlebih dahulu.");
       return;
    }
    queryToUse = queryToUse.trim();
    setShowHistory(false);
    setAiLoading(true);
    setErrorVisible(null);
    try {
      // Check if it's a "Discover [City]" type of request
      const cityMatch = queryToUse.match(/discover\s+([a-z\s]+)|cari\s+di\s+([a-z\s]+)/i);
      const cityName = cityMatch ? (cityMatch[1] || cityMatch[2]) : null;

      if (cityName && (queryToUse.toLowerCase().includes("discover") || queryToUse.toLowerCase().includes("bulk") || queryToUse.toLowerCase().includes("semua"))) {
         await handleBulkAiDiscover(cityName.trim(), queryToUse);
         return;
      }

      // 1. Get smart search keywords from AI
      let searchQuery = queryToUse;
      let searchTags: string[] = [];
      
      try {
        const keywords = await geminiService.getSearchKeywords(queryToUse);
        searchQuery = keywords.query;
        searchTags = keywords.tags;
      } catch (e: any) {
        console.warn("Keywords AI failed, using raw query:", e);
        if (e.message !== "QUOTA_EXHAUSTED") {
           setErrorVisible("AI sedang sibuk, menggunakan pencarian standar...");
        }
      }

      setAiTitle(queryToUse);
      
      // 2. Trigger global search via map event
      try {
        window.dispatchEvent(new CustomEvent('google-maps-smart-search', { 
          detail: { query: searchQuery, tags: searchTags } 
        }));
      } catch (e) {
        console.warn("Map search event failed:", e);
      }

      // 3. Get AI suggestions independently
      try {
        const localResult = await geminiService.getPlaceRecommendations(queryToUse, places);
        if (localResult && localResult.recommendations) {
          setAiResults(localResult.recommendations);
          setActiveFilter("DISCOVER");
        }
      } catch (e: any) {
        console.error("AI recommendations failed:", e);
        if (e.message === "QUOTA_EXHAUSTED") {
          setErrorVisible("Kuota AI penuh. Menampilkan koleksi kurasi terbaik kami untuk Anda.");
          // Use hardcoded fallback for quota exhausted
          const fallback = await geminiService.getPlaceRecommendations("jakarta", []); 
          setAiResults(fallback.recommendations);
          setActiveFilter("DISCOVER");
        } else {
          throw e;
        }
      }
    } catch (err: any) {
      console.error("AI recommendation failed:", err);
      setErrorVisible("Gagal mendapatkan saran: " + (err.message || "Unknown error"));
    } finally {
      setAiLoading(false);
    }
  };

  // DISABLED: Automatic AI refinement to conserve API quota.
  // The first AI results are usually sufficient, and re-triggering on every map search update 
  // consumes the 20-req/day limit too quickly.
  /*
  useEffect(() => {
    const refineResults = async () => {
      if (activeFilter === "DISCOVER" && Array.isArray(apiPlaces) && apiPlaces.length > 0 && !aiLoading) {
        try {
          // Re-rank combined results
          const combined = [...places];
          apiPlaces.forEach(ap => {
            if (!combined.find(p => p.id === ap.id)) combined.push(ap);
          });
          
          const result = await geminiService.getPlaceRecommendations(aiTitle, combined);
          setAiResults(result.recommendations);
        } catch (err) {
          console.error("Refinement failed:", err);
        }
      }
    };
    refineResults();
  }, [apiPlaces, activeFilter, aiLoading]);
  */

  const filteredPlaces = useMemo(() => {
    // If no search or filter is active, we might want to return an empty list or only featured ones
    if (activeFilter === "Semua" && !aiTitle) {
      return []; 
    }

    let results: Place[] = [];

    if (activeFilter === "DISCOVER" && aiResults) {
      aiResults.forEach(res => {
        const local = allPlaces.find(p => p.id === res.id);
        if (local) {
          results.push(local);
        } else if ((res.id.startsWith("ai-new-") || res.id.startsWith("mock-")) && res.name) {
          results.push({
            id: res.id,
            name: res.name,
            description: res.description || "Tempat menarik ditemukan lewat pencarian kolektif.",
            address: res.address || "Lokasi baru",
            imageUrl: res.imageUrl || res.image || `https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=600&fit=crop&q=80&sig=${res.id}`,
            category: res.category || ["discovery"],
            rating: 0,
            latitude: res.latitude || 0,
            longitude: res.longitude || 0,
            priceLevel: res.priceLevel || 1,
            addedBy: "Pencarian Kolektif",
            createdAt: new Date().toISOString()
          });
        }
      });

      if (Array.isArray(apiPlaces)) {
        apiPlaces.forEach(ap => {
          if (!results.find(r => r.id === ap.id)) {
            results.push(ap);
          }
        });
      }
    } else {
      results = allPlaces.filter(p => {
        const matchesFilter = activeFilter === "Semua" || p.category.some(c => c.toLowerCase() === activeFilter.toLowerCase());
        return matchesFilter;
      });
    }

    // Strict relevance sorting if there's an input
    if (aiInput.trim()) {
      const q = aiInput.toLowerCase().trim();
      results = results.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // Exact starts with
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Inclusion rank
        const aIndex = aName.indexOf(q);
        const bIndex = bName.indexOf(q);
        if (aIndex !== -1 && bIndex !== -1) {
          if (aIndex !== bIndex) return aIndex - bIndex;
        } else if (aIndex !== -1) return -1;
        else if (bIndex !== -1) return 1;

        return aName.localeCompare(bName);
      });
    }

    return results;
  }, [allPlaces, apiPlaces, activeFilter, aiResults, aiTitle, aiInput]);

  // Auto-select first result when AI search results come in
  useEffect(() => {
    if (activeFilter === "DISCOVER" && !selectedPlaceId && filteredPlaces.length > 0 && !aiLoading) {
      setSelectedPlaceId(filteredPlaces[0].id);
    }
  }, [filteredPlaces, activeFilter, aiLoading, selectedPlaceId]);

  const clearAiResults = () => {
    setAiResults(null);
    setAiTitle("");
    setAiInput("");
    setApiPlaces([]);
    setActiveFilter("Semua");
  };

  const handleBulkAiDiscover = async (city: string, vibe: string) => {
    setAiLoading(true);
    setAiTitle(`Discovery: ${city}`);
    try {
      const { places: suggestedPlaces } = await geminiService.bulkDiscover(city, vibe);
      
      // Map to Place type
      const formatted = suggestedPlaces.map((p: any, idx: number) => ({
        id: `bulk-${idx}-${Date.now()}`,
        name: p.name,
        description: p.description,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        category: p.category,
        imageUrl: p.imageUrl,
        priceLevel: p.priceLevel || 1,
        rating: 4.5,
        addedBy: "Google AI",
        createdAt: new Date().toISOString()
      }));

      setApiPlaces(formatted);
      setActiveFilter("DISCOVER");
      setAiResults(formatted.map((p: any) => ({ id: p.id, insight: "Saran penjelajah" })));
    } catch (err: any) {
      console.error("Bulk discovery failed:", err);
      if (err.message === "QUOTA_EXHAUSTED") {
        setErrorVisible("Kuota AI penuh. Menampilkan koleksi kurasi massal default.");
        const { places: fallback } = await geminiService.bulkDiscover("jakarta", "terbaik");
        const formatted = fallback.map((p: any, idx: number) => ({
          id: `bulk-fallback-${idx}-${Date.now()}`,
          name: p.name,
          description: p.description,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          category: p.category,
          imageUrl: p.imageUrl,
          priceLevel: p.priceLevel || 1,
          rating: 4.5,
          addedBy: "Google AI (Safe Mode)",
          createdAt: new Date().toISOString()
        }));
        setApiPlaces(formatted);
        setActiveFilter("DISCOVER");
        setAiResults(formatted.map((p: any) => ({ id: p.id, insight: "Koleksi Kurasi" })));
      } else {
        setErrorVisible("Gagal pencarian massal: " + (err.message || "Unknown error"));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!apiPlaces || apiPlaces.length === 0) return;
    setIsBulkAdding(true);
    try {
      let addedCount = 0;
      for (const place of apiPlaces) {
        if (place.addedBy === "Google AI") {
           // Only add if not exists
           const exists = places.find(p => p.name === place.name && Math.abs(p.latitude - place.latitude) < 0.0001);
           if (!exists) {
              await dataService.addPlace({
                name: place.name,
                address: place.address,
                description: place.description,
                imageUrl: place.imageUrl,
                latitude: place.latitude,
                longitude: place.longitude,
                category: place.category,
                priceLevel: place.priceLevel || 1,
                addedBy: user?.id || "00000000-0000-0000-0000-000000000000" // Use logged in user
              });
              addedCount++;
           }
        }
      }
      alert(`Berhasil menambahkan ${addedCount} tempat baru ke koleksi!`);
      // Refresh local places
      const latest = await dataService.getPlaces();
      setPlaces(Array.isArray(latest) ? latest : []);
      setApiPlaces([]); // Clear AI suggestions once they are "real"
      setActiveFilter("Semua");
    } catch (err) {
      console.error("Bulk add failed:", err);
    } finally {
      setIsBulkAdding(false);
    }
  };

  const handleAddFromMap = async (partialPlace: Partial<Place>) => {
    try {
      const newPlace = await dataService.addPlace({
        name: partialPlace.name || "Unknown Place",
        address: partialPlace.address || "",
        description: `Tempat menarik yang ditemukan lewat Google Maps.`,
        imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80", // Default image
        latitude: partialPlace.latitude || 0,
        longitude: partialPlace.longitude || 0,
        category: partialPlace.category || ["General"],
        priceLevel: 1,
        addedBy: user?.id || "00000000-0000-0000-0000-000000000000" // Use logged in user
      });
      
      // Auto-focus on the new place
      setSelectedPlaceId(newPlace.id);
    } catch (err) {
      console.error("Failed to add place from map:", err);
    }
  };

  const refreshLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(newLoc);
          setLoading(false);
          // Set zoom to be closer when finding user location
        },
        (error) => {
          console.error("Gagal mendapatkan lokasi:", error);
          alert("Gagal mendapatkan lokasi. Pastikan izin lokasi sudah diberikan.");
          setLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Browser Anda tidak mendukung fitur lokasi.");
    }
  };

  const mapCenter = useMemo(() => {
    const isValidCoord = (c: any) => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number' && !isNaN(c[0]) && !isNaN(c[1]);
    
    if (isValidCoord(userLocation)) return userLocation!;
    
    if (filteredPlaces.length > 0) {
      const p = filteredPlaces[0];
      if (typeof p.latitude === 'number' && typeof p.longitude === 'number' && !isNaN(p.latitude) && !isNaN(p.longitude)) {
        return [p.latitude, p.longitude] as [number, number];
      }
    }
    return [-6.2088, 106.8456] as [number, number]; // Jakarta area fallback
  }, [filteredPlaces, userLocation]);

  // Handle map view rendering issues
  useEffect(() => {
    if (view === "map") {
      // Trigger a window resize event to help Google Maps recalculate its size after a short delay
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        console.log("Map view activated, resize triggered");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [view]);

  return (
    <div className="flex flex-col gap-6 relative">
      <AnimatePresence>
        {errorVisible && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 12 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-sm px-4"
          >
            <div className="bg-secondary-brown text-white p-4 rounded-2xl shadow-2xl border border-accent-gold/20 flex items-start gap-4">
              <div className="w-10 h-10 bg-accent-gold/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} className="text-accent-gold" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent-gold">System Note</p>
                <p className="text-xs font-serif italic text-white/90 leading-relaxed pr-6">{errorVisible}</p>
                <button 
                   onClick={() => setErrorVisible(null)}
                   className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-bg-cream/10 backdrop-blur-[1px] flex flex-col items-center justify-center p-8"
          >
            <div className="relative flex flex-col items-center gap-24">
              {/* Anime-style Thinking Dots (Tik Tik Tik - Flat & Step-by-step) */}
              <div className="flex items-center gap-10">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-4 h-4 rounded-full bg-secondary-brown/60"
                    animate={{
                      opacity: [0, 1],
                    }}
                    transition={{
                      duration: 0.3,
                      repeat: Infinity,
                      repeatDelay: 1.2, // Pause after all dots appeared
                      delay: i * 0.4, // "Tik" ... "Tik" ... "Tik"
                      ease: "linear",
                    }}
                  />
                ))}
              </div>

              <button 
                onClick={() => setAiLoading(false)}
                className="px-12 py-3 text-secondary-brown/20 hover:text-secondary-brown transition-all cursor-pointer font-black tracking-[0.8em] text-[10px] uppercase border-none bg-transparent"
              >
                Batal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent-gold/10 rounded-[1.2rem] flex items-center justify-center shadow-sm border border-accent-gold/5">
            <Compass className="text-accent-gold" size={28} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-[2.5rem] font-serif text-secondary-brown leading-none tracking-tighter">Eksplorasi.</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary-brown/20 pl-0.5 whitespace-nowrap">Temukan Hidden Gems</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex bg-secondary-brown/5 p-1.5 rounded-2xl border border-secondary-brown/5 shadow-sm shrink-0">
            <button 
              onClick={() => setView("map")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl text-xs md:text-sm font-bold transition-all border-none cursor-pointer ${view === "map" ? "bg-white text-secondary-brown shadow-xl" : "text-secondary-brown/30 hover:bg-white/50"}`}
            >
              <MapIcon size={16} /> Peta
            </button>
            <button 
              onClick={() => setView("list")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl text-xs md:text-sm font-bold transition-all border-none cursor-pointer ${view === "list" ? "bg-white text-secondary-brown shadow-xl" : "text-secondary-brown/30 hover:bg-white/50"}`}
            >
              <List size={16} /> Daftar
            </button>
          </div>

          <button 
            onClick={refreshLocation}
            className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-white text-secondary-brown shadow-lg border border-secondary-brown/5 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-secondary-brown hover:text-white transition-all cursor-pointer shadow-secondary-brown/5"
          >
            <Navigation size={14} className="text-accent-gold" /> Update Lokasi
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 lg:gap-8 overflow-hidden min-h-[600px] lg:h-[78vh]">
        {/* Sidebar Controls - visible as full list on mobile list view, or as floating search on map view */}
        <div className={`w-full lg:w-[420px] flex flex-col gap-4 min-h-0 ${view === "map" ? "absolute sm:static bottom-8 left-8 right-8 lg:w-96 z-50" : "flex"}`}>
          <div className={`flex-shrink-0 bg-white/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-secondary-brown/5 shadow-2xl space-y-6 ${view === "map" && "lg:bg-white lg:shadow-sm"}`}>
            
            {/* AI SMART SEARCH */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pl-1">
                <label className="text-[10px] font-black text-accent-gold uppercase tracking-[0.3em] flex items-center gap-2">
                  <Sparkles size={14} className="shrink-0 animate-pulse" /> 
                  AI Discovery
                </label>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-gold"></span>
                  </span>
                  <span className="text-[7px] font-black uppercase tracking-widest text-secondary-brown/30">Live Syncing</span>
                </div>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Vibe mu? (e.g. 'Kedai kopi sepi')" 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                  className="w-full pl-6 pr-14 py-4 bg-secondary-brown/[0.03] border-none rounded-2xl focus:ring-2 focus:ring-accent-gold/20 outline-none text-sm md:text-base font-serif italic text-secondary-brown placeholder:text-secondary-brown/10 transition-all"
                />
                
                <AnimatePresence>
                  {showHistory && recentPlaces.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-secondary-brown/5 overflow-hidden z-[100]"
                    >
                      <div className="p-4 border-b border-secondary-brown/5 flex items-center justify-between bg-header-beige/10">
                         <div className="flex items-center gap-2">
                            <History size={12} className="text-accent-gold" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/40">Terakhir Dilihat</span>
                         </div>
                         <button 
                           onClick={() => setShowHistory(false)}
                           className="text-[9px] font-black uppercase text-secondary-brown/50 hover:text-secondary-brown border-none bg-transparent cursor-pointer"
                         >
                           Tutup
                         </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto no-scrollbar">
                        {recentPlaces.map((p, i) => (
                           <div 
                             key={p.id || i}
                             onClick={() => {
                               handleNavigateToDetail(p);
                               setShowHistory(false);
                             }}
                             className="px-4 py-3 flex items-center justify-between hover:bg-header-beige/30 cursor-pointer group transition-all border-b border-secondary-brown/[0.02] last:border-none"
                           >
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                                   <img 
                                     src={p.imageUrl} 
                                     alt={p.name}
                                     className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                     onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517230873562-1cf08552467d?w=200&q=80"; }}
                                   />
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-sm font-serif italic text-secondary-brown group-hover:text-accent-gold transition-colors">{p.name}</span>
                                   <span className="text-[9px] text-secondary-brown/40 uppercase tracking-widest truncate max-w-[180px]">
                                      {Array.isArray(p.category) ? p.category.join(", ") : p.category || "Hidden Gem"}
                                   </span>
                                </div>
                             </div>
                             <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-accent-gold" />
                           </div>
                        ))}
                      </div>
                      <button 
                        onClick={clearHistory}
                        className="w-full py-3 bg-secondary-brown/[0.02] text-[8px] font-black uppercase tracking-[0.2em] text-secondary-brown/30 hover:text-red-400 hover:bg-red-50 transition-all border-none cursor-pointer"
                      >
                        Hapus Semua Riwayat View
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {showHistory && (
                  <div 
                    className="fixed inset-0 z-0" 
                    onClick={() => setShowHistory(false)}
                  />
                )}

                <button 
                  onClick={() => handleAiSearch()}
                  disabled={aiLoading || !aiInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-secondary-brown text-white rounded-xl hover:bg-accent-gold transition-all disabled:opacity-50 border-none cursor-pointer group z-10"
                >
                  {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide ${view === "map" && "hidden lg:block"}`}>
            {(filteredPlaces.length > 0 || activeFilter === "DISCOVER") && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-2 py-2">
                <h3 className="text-[9px] md:text-[10px] font-black text-secondary-brown/30 uppercase tracking-[0.2em] italic">
                  {activeFilter === "DISCOVER" ? aiTitle || "Saran Penjelajah" : `Hasil (${filteredPlaces.length})`}
                </h3>
                <div className="flex items-center gap-2">
                  {activeFilter === "DISCOVER" && apiPlaces.some(p => p.addedBy === "Pencarian Kolektif") && (
                    <button 
                      onClick={handleBulkAdd}
                      disabled={isBulkAdding}
                      className="text-[8px] font-black text-white flex items-center gap-2 uppercase tracking-widest border-none bg-primary-green/80 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-primary-green transition-all shadow-sm"
                    >
                      {isBulkAdding ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      Simpan Semua
                    </button>
                  )}
                  {activeFilter === "DISCOVER" && (
                    <button onClick={clearAiResults} className="text-[8px] font-black text-secondary-brown flex items-center gap-2 uppercase tracking-widest border-none bg-secondary-brown/5 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-secondary-brown/10 transition-all">
                      <X size={10} /> Batal
                    </button>
                  )}
                </div>
              </div>
            )}

            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-white animate-pulse rounded-2xl border border-secondary-brown/5"></div>)
            ) : filteredPlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                <div className="w-20 h-20 bg-accent-gold/5 rounded-full flex items-center justify-center">
                  <Sparkles size={32} className="text-accent-gold/40" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-serif text-secondary-brown italic">Mulai Petualanganmu.</h3>
                  <p className="text-xs text-secondary-brown/40 font-medium leading-relaxed uppercase tracking-widest leading-loose">
                    Gunakan fitur AI di atas untuk mencari "Vibe" atau tempat spesifik di Indonesia.
                  </p>
                </div>
                <div className="pt-4 flex flex-wrap justify-center gap-2">
                  {["Kopi Sepi", "Sunset Aesthetic", "Hutan Pinus", "Vintage Vibes"].map(tag => (
                    <button 
                      key={tag}
                      onClick={() => { setAiInput(tag); handleAiSearch(tag); }}
                      className="px-4 py-2 bg-white border border-secondary-brown/10 rounded-full text-[10px] font-black text-secondary-brown/40 uppercase tracking-widest hover:border-accent-gold hover:text-accent-gold transition-all cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              filteredPlaces.map((place) => {
                const aiRecommendation = aiResults?.find(r => r.id === place.id);
                return (
                  <div 
                    key={place.id}
                    onMouseEnter={() => {
                      setSelectedPlaceId(place.id);
                      // Focus map on this place when hovering
                      if (view === "map" && place.latitude && place.longitude) {
                        window.dispatchEvent(new CustomEvent('map-focus-place', {
                          detail: { lat: place.latitude, lng: place.longitude }
                        }));
                      }
                    }}
                    className={`block p-4 rounded-[2rem] border transition-all group no-underline relative ${selectedPlaceId === place.id ? "bg-white border-accent-gold shadow-lg -translate-y-0.5" : "bg-white border-transparent shadow-sm hover:shadow-md"}`}
                  >
                    {place.addedBy === "Pencarian Kolektif" && (
                      <div className="absolute top-2 right-2 bg-accent-gold/10 text-accent-gold text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1 shadow-sm border border-accent-gold/20 z-10">
                        <Sparkles className="w-2 h-2" />
                        Discovery
                      </div>
                    )}
                    <div className="flex gap-4 cursor-pointer" onClick={() => handleNavigateToDetail(place)}>
                      <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm relative">
                        <img 
                          src={place.imageUrl} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          alt={place.name} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517230873562-1cf08552467d?w=800&q=80";
                          }}
                        />
                        {aiRecommendation && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-accent-gold rounded-full flex items-center justify-center text-white shadow-sm">
                            <Sparkles size={10} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-0.5">
                           <h4 className="font-bold text-base text-secondary-brown truncate group-hover:text-accent-gold transition-colors">{place.name}</h4>
                        </div>
                        {aiRecommendation ? (
                          <p className="text-[10px] text-accent-gold font-medium leading-tight line-clamp-2 mb-1.5 italic">
                            "{aiRecommendation.insight}"
                          </p>
                        ) : (
                          <p className="text-xs text-secondary-brown/50 truncate mb-1.5">{place.address}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-accent-gold bg-accent-gold/5 px-3 py-1 rounded-full uppercase tracking-wider">{place.rating} ★</span>
                          {userLocation && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-secondary-brown/70 tabular-nums">
                                {(() => {
                                  const d = calculateDistance(userLocation[0], userLocation[1], place.latitude, place.longitude);
                                  return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
                                })()}
                              </span>
                              <span className="text-[8px] font-medium text-secondary-brown/30">
                                {(() => {
                                  const d = calculateDistance(userLocation[0], userLocation[1], place.latitude, place.longitude);
                                  const time = Math.round(d * 4 + 2);
                                  return `±${time} mnt`;
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-secondary-brown/[0.04]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const origin = userLocation ? `${userLocation[0]},${userLocation[1]}` : '';
                          const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${place.latitude},${place.longitude}&travelmode=driving`;
                          window.open(mapsUrl, '_blank');
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-secondary-brown text-white rounded-xl text-[9px] font-black uppercase tracking-wider border-none cursor-pointer hover:bg-black transition-all shadow-sm active:scale-95"
                      >
                        <Navigation size={12} /> Navigasi
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (place.latitude && place.longitude) {
                            setView("map");
                            setSelectedPlaceId(place.id);
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('map-focus-place', {
                                detail: { lat: place.latitude, lng: place.longitude, zoom: 16 }
                              }));
                            }, 100);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-gold/10 text-secondary-brown rounded-xl text-[9px] font-black uppercase tracking-wider border-none cursor-pointer hover:bg-accent-gold/20 transition-all active:scale-95"
                      >
                        <MapPin size={12} /> Di Maps
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToDetail(place);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-secondary-brown/10 text-secondary-brown/60 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer hover:border-accent-gold hover:text-accent-gold transition-all active:scale-95"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            {activeFilter === "AI" && filteredPlaces.length === 0 && !aiLoading && (
              <div className="p-8 text-center bg-white rounded-[2rem] border border-secondary-brown/5">
                <Sparkles size={32} className="mx-auto text-accent-gold/20 mb-4" />
                <p className="text-sm font-serif text-secondary-brown/40">Duh, belum nemu tempat yang pas banget buat kamu. Coba request yang lain?</p>
              </div>
            )}
          </div>
        </div>

        {/* Main View Area - Map */}
        <div className={`flex-1 h-full min-h-[500px] lg:min-h-0 rounded-[3rem] overflow-hidden border border-secondary-brown/10 shadow-2xl relative ${view === "list" ? "hidden lg:block" : "block"}`}>
          <AnimatePresence mode="wait">
            {view === "map" ? (
              <motion.div 
                key="map"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full"
              >
                <MapComponent 
                  places={filteredPlaces} 
                  center={mapCenter} 
                  userLocation={userLocation}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={setSelectedPlaceId}
                  onNavigateToDetail={handleNavigateToDetail}
                  onAddFromMap={handleAddFromMap}
                  onSearchResults={(results) => {
                    setApiPlaces(results);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full overflow-y-auto pr-4 no-scrollbar"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {filteredPlaces.map(place => (
                    <div 
                      key={place.id}
                      onClick={() => handleNavigateToDetail(place)}
                      className="bg-white p-8 rounded-[3rem] border border-secondary-brown/5 hover:shadow-2xl transition-all group flex flex-col sm:flex-row gap-8 no-underline cursor-pointer"
                    >
                      <div className="w-full sm:w-48 h-48 rounded-[2.5rem] overflow-hidden flex-shrink-0 shadow-lg relative">
                        <img 
                          src={place.imageUrl} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                          alt={place.name} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517230873562-1cf08552467d?w=800&q=80";
                          }}
                        />
                        {activeFilter === "DISCOVER" && aiResults?.some(r => r.id === place.id) && (
                          <div className="absolute top-4 right-4 px-4 py-2 bg-accent-gold text-white rounded-full font-black text-[9px] uppercase tracking-widest shadow-xl flex items-center gap-2">
                            <Sparkles size={12} /> Curator's Pick
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-2">
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="text-2xl font-serif text-secondary-brown group-hover:text-accent-gold transition-colors">{place.name}</h3>
                            <div className="flex items-center gap-1">
                              <span className="text-lg font-bold text-accent-gold">★ {place.rating}</span>
                            </div>
                          </div>
                          {activeFilter === "DISCOVER" && aiResults?.find(r => r.id === place.id) ? (
                            <div className="mb-6 p-4 bg-accent-gold/5 rounded-2xl border border-accent-gold/10">
                               <p className="text-sm font-medium text-accent-gold leading-relaxed italic">
                                 "{aiResults.find(r => r.id === place.id)?.insight}"
                               </p>
                            </div>
                          ) : (
                            <p className="text-base text-secondary-brown/60 mb-6 line-clamp-3 font-light leading-relaxed">{place.description}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-3 items-center">
                            {(Array.isArray(place.category) ? place.category : []).map(c => (
                              <span key={c} className="text-[11px] font-bold text-secondary-brown/30 uppercase tracking-widest">{c}</span>
                            ))}
                            {userLocation && (
                              <div className="flex items-center gap-3 ml-2">
                                <span className="text-[11px] font-black text-accent-gold uppercase tracking-tighter">
                                  {(() => {
                                    const d = calculateDistance(userLocation[0], userLocation[1], place.latitude, place.longitude);
                                    return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
                                  })()}
                                </span>
                                <span className="text-[10px] font-bold text-secondary-brown/20 uppercase tracking-widest bg-secondary-brown/5 px-2 py-0.5 rounded">
                                  {(() => {
                                    const d = calculateDistance(userLocation[0], userLocation[1], place.latitude, place.longitude);
                                    const time = Math.round(d * 4 + 2);
                                    return `±${time} menit`;
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=driving`;
                              window.open(mapsUrl, '_blank');
                            }}
                            className="w-12 h-12 rounded-2xl bg-secondary-brown/5 flex items-center justify-center text-accent-gold hover:bg-accent-gold hover:text-white transition-all shadow-sm border-none cursor-pointer"
                            title="Navigasi di Google Maps"
                          >
                            <Navigation size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
