import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { 
  MapPin, 
  Clock, 
  Navigation, 
  Star, 
  ArrowLeft, 
  Bookmark, 
  Share2, 
  MessageCircle,
  ThumbsUp,
  Send,
  Map as MapIcon,
  Sparkles,
  Camera,
  Crop,
  Info,
  History,
  Zap,
  ShieldAlert,
  CheckCircle,
  X
} from "lucide-react";
import { dataService } from "../../services/dataService";
import MapComponent from "../../components/MapComponent";
import { motion, AnimatePresence } from "motion/react";
import { Place, Review } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { calculateDistance, calculateTravelTime } from "../../lib/utils";
import { ImageEditor } from "../../components/ImageEditor";
import { useRef } from "react";
import { geminiService } from "../../services/geminiService";

import { useMapsLibrary } from "@vis.gl/react-google-maps";

export default function PlaceDetails() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [place, setPlace] = useState<Place | null>(location.state?.place || null);
  const [loadingPlace, setLoadingPlace] = useState(!location.state?.place);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [etaInfo, setEtaInfo] = useState({ distance: "...", time: "..." });
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navSectionRef = useRef<HTMLDivElement>(null);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const [placeInsights, setPlaceInsights] = useState<{
    openingHours: string;
    facilities: string[];
    stories: string;
    jamRamai: string;
    waktuTerbaik: string;
    isRealTime?: boolean;
  } | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Place>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  const [addressComponents, setAddressComponents] = useState({
    street: "",
    city: "",
    province: "",
    postcode: ""
  });

  const handleAdminImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await dataService.uploadImage(file);
      setEditForm(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Gagal mengunggah gambar.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (place) {
      setEditForm(place);
      // Try to parse address into components if possible (rough heuristic)
      const parts = (place.address || "").split(",").map(s => s.trim());
      setAddressComponents({
        street: parts[0] || "",
        city: parts[1] || "",
        province: parts[2] || "",
        postcode: parts[3] || ""
      });
    }
  }, [place]);

  const handleUpdatePlace = async () => {
    if (!place || !editForm.name) return;
    setIsSaving(true);
    try {
      // Build full address from components if they were edited
      const combinedAddress = [
        addressComponents.street,
        addressComponents.city,
        addressComponents.province,
        addressComponents.postcode
      ].filter(Boolean).join(", ");

      const cleanUpdates: any = {
        name: editForm.name,
        category: editForm.category,
        description: editForm.description,
        imageUrl: editForm.imageUrl,
        address: combinedAddress || editForm.address,
        latitude: editForm.latitude,
        longitude: editForm.longitude,
        priceLevel: editForm.priceLevel
      };

      await dataService.updatePlace(place.id, cleanUpdates);
      
      // Re-fetch to ensure we have the real state from server
      const updated = await dataService.getPlaceById(place.id);
      if (updated) {
        setPlace(updated);
        setEditForm(updated);
      } else {
        setPlace({ ...place, ...cleanUpdates } as Place);
      }
      
      setIsEditing(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err) {
      console.error("Failed to update place:", err);
      alert("Gagal memperbarui data tempat. Cek koneksi Supabase di Settings.");
    } finally {
      setIsSaving(false);
    }
  };
  const [polylinePath, setPolylinePath] = useState<google.maps.LatLngLiteral[] | undefined>(undefined);
  const placesLib = useMapsLibrary('places');

  const routesLib = useMapsLibrary('routes');

  const handleStartNavigation = (modeInput?: google.maps.TravelMode | any) => {
    if (!place) return;
    
    // Default to driving if not specified
    const mode = (typeof modeInput === 'string' && modeInput === google.maps.TravelMode.WALKING) ? 'walking' : 'driving';
    
    // Construct Google Maps direction URL
    // If we have user location, use it as origin, otherwise let Google Maps find it
    const origin = userLocation ? `${userLocation[0]},${userLocation[1]}` : '';
    const destination = `${place.latitude},${place.longitude}`;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${mode}`;
    
    window.open(mapsUrl, '_blank');
  };

  const checkIsOpen = (hoursStr: string) => {
    if (!hoursStr) return { isOpen: false, status: "Tutup" };
    
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Handle formats like "08:00 - 22:00" or "08.00 - 22.00"
      const parts = hoursStr.replace(/\./g, ':').split('-').map(p => p.trim());
      if (parts.length !== 2) return { isOpen: true, status: "Buka" }; // Fallback if format is weird
      
      const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + (m || 0);
      };
      
      const startMinutes = parseTime(parts[0]);
      const endMinutes = parseTime(parts[1]);
      
      // Handle cases where opening passes midnight (e.g., 18:00 - 02:00)
      if (endMinutes < startMinutes) {
        const isOpen = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        return { isOpen, status: isOpen ? "Buka" : "Tutup" };
      }
      
      const isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      return { isOpen, status: isOpen ? "Buka" : "Tutup" };
    } catch (e) {
      return { isOpen: true, status: "Buka" };
    }
  };

  const placeStatus = placeInsights ? checkIsOpen(placeInsights.openingHours) : { isOpen: true, status: "Buka" };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToEdit(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleImportPlace = async () => {
    if (!place || !id?.startsWith('ai-')) return;
    setIsImporting(true);
    try {
      const newId = await dataService.addPlace({
        ...place,
        id: undefined as any, // Let DB generate ID
        isFeatured: false,
        addedBy: user?.name || "AI Scout"
      });
      console.log("Place imported with ID:", newId);
      navigate(`/app/place/${newId}`, { replace: true });
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    // Watch user location for real-time distance
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.error("Error watching location:", err),
        { enableHighAccuracy: true }
      );
    }

    const fetchInitialData = async (retryCount = 0) => {
      console.log(`Fetching place data for ID: ${id}, user: ${user?.id}, attempt: ${retryCount + 1}`);
      // Only set loading to true if we don't have a place already from state
      if (retryCount === 0 && !place) setLoadingPlace(true);
      
      try {
        const [found, bookmarks] = await Promise.all([
          dataService.getPlaceById(id as string).catch(() => null),
          dataService.getBookmarks(user?.id || "anon").catch(() => [])
        ]);
        
        if (found) {
          console.log("Place found in database:", found.name);
          setPlace(found);
          const initialReviews = await dataService.getReviews(id as string);
          setReviews(initialReviews);
          setIsBookmarked(bookmarks.includes(id as string));
          setLoadingPlace(false);
        } else if (place && (place.id === id || place.name === id || (typeof id === 'string' && place.id?.includes(id)))) {
          // If we have a place in state from Explore, use it as fallback
          console.warn("Place not found in database, using client-side preview from navigation state.");
          setPlace(place);
          setLoadingPlace(false);
          // Set some empty reviews if not found in DB
          setReviews([]);
          setIsBookmarked(bookmarks.includes(id as string));
        } else if (retryCount < 4) {
          // Increase retries to 4 and length to 2.5s for better resilience 
          console.warn(`Place not found, retrying in 2.5s... (Attempt ${retryCount + 1})`);
          setTimeout(() => fetchInitialData(retryCount + 1), 2500);
        } else {
          console.error("Place definitively not found after retries.");
          setPlace(null);
          setLoadingPlace(false);
        }
      } catch (err) {
        console.error("Gagal ambil data:", err);
        if (retryCount < 2) {
           setTimeout(() => fetchInitialData(retryCount + 1), 1500);
        } else {
           setLoadingPlace(false);
        }
      }
    };
    
    fetchInitialData();

    // subscriptions
    const placeSub = dataService.subscribePlaces((payload) => {
      if (payload.eventType === 'UPDATE' && payload.new.id === id) {
        setPlace(dataService.mapPlace(payload.new));
      }
    });

    const reviewSub = dataService.subscribeReviews(id, (payload) => {
      if (payload.eventType === 'INSERT') {
        const mappedPost = dataService.mapReview(payload.new);
        setReviews(prev => {
          if (prev.some(r => r.id === mappedPost.id)) return prev;
          return [mappedPost, ...prev];
        });
      } else if (payload.eventType === 'UPDATE') {
        const mappedPost = dataService.mapReview(payload.new);
        setReviews(prev => prev.map(r => r.id === mappedPost.id ? mappedPost : r));
      }
    });

    const bookmarkHandler = (e: any) => {
      if (e.detail.table === 'bookmarks' && id) {
        setIsBookmarked(e.detail.new.includes(id));
      }
    };
    dataService.events.addEventListener('change', bookmarkHandler);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      placeSub.unsubscribe();
      reviewSub.unsubscribe();
      dataService.events.removeEventListener('change', bookmarkHandler);
    };
  }, [id, navigate, user?.id]);

  // Recently Viewed Logic
  useEffect(() => {
    if (place && place.id) {
      // 1. Track in Database for persistent stats (if logged in)
      if (user?.id) {
        dataService.trackPlaceView(user.id, place.id);
      }

      // 2. Local History for immediate "Recently Viewed" list
      const historyKey = user?.id ? `recent_places_${user.id}` : 'recent_places_anon';
      try {
        const saved = localStorage.getItem(historyKey);
        let history = saved ? JSON.parse(saved) : [];
        
        // Ensure place is a clean object to save
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
        // Limit
        history = history.slice(0, 15);
        
        localStorage.setItem(historyKey, JSON.stringify(history));
        console.log("Saved to recently viewed:", place.name);
        
        // Dispatch event for UI updates (like Profile or Sidebar)
        window.dispatchEvent(new CustomEvent('history_updated'));
      } catch (e) {
        console.error("Failed to save to history", e);
      }
    }
  }, [place?.id, user?.id]);

  useEffect(() => {
    if (userLocation && place) {
      const dist = calculateDistance(
        userLocation[0], 
        userLocation[1], 
        place.latitude, 
        place.longitude
      );
      const time = calculateTravelTime(dist);
      
      setEtaInfo({
        distance: dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`,
        time: `${time} menit`
      });
    }
  }, [userLocation, place]);

  useEffect(() => {
    if (place && !placeInsights && !isLoadingInsights) {
      fetchPlaceInsights();
    }
  }, [place]);

  const fetchPlaceInsights = async () => {
    if (!place) return;
    setIsLoadingInsights(true);
    try {
      // 1. Try to get AI enrichment first for the story and experience
      const enrichment = await geminiService.getPlaceEnrichment(place.name);
      
      let realTimeHours = enrichment.openingHours || "08:00 - 22:00";
      let isRealTime = false;

      // 2. Try to get REAL-TIME opening hours from Google Maps if library is available
      if (placesLib) {
        try {
          // If it's a real place ID (not starting with ai-), use fetchFields
          let googlePlace: google.maps.places.Place | null = null;
          
          if (place.id && !place.id.startsWith('ai-')) {
            googlePlace = new placesLib.Place({ id: place.id });
            await googlePlace.fetchFields({ fields: ['regularOpeningHours', 'currentOpeningHours', 'displayName'] });
          } else {
            // Otherwise try searching by name
            const { places: searchResults } = await placesLib.Place.searchByText({
              textQuery: `${place.name} ${place.address}`,
              fields: ['regularOpeningHours', 'currentOpeningHours', 'id', 'displayName'],
              maxResultCount: 1
            });
            if (searchResults && searchResults.length > 0) {
              googlePlace = searchResults[0];
            }
          }

          if (googlePlace) {
            // Prefer currentOpeningHours (includes today's overrides)
            const hoursObj = googlePlace.currentOpeningHours || googlePlace.regularOpeningHours;
            if (hoursObj) {
              const today = new Date().getDay(); // 0 is Sunday
              const weekdayDesc = hoursObj.weekdayDescriptions;
              if (weekdayDesc && weekdayDesc.length >= 7) {
                const todayDesc = weekdayDesc[today]; 
                if (todayDesc) {
                  const timePart = todayDesc.split(':').slice(1).join(':').trim();
                  if (timePart && !['Closed', 'Tutup'].includes(timePart)) {
                    realTimeHours = timePart.replace('–', '-');
                    isRealTime = true;
                  }
                }
              }
            }
          }
        } catch (mapErr) {
          console.warn("Real-time Map data fetch failed, using AI data:", mapErr);
        }
      }

      setPlaceInsights({
        openingHours: realTimeHours,
        facilities: enrichment.categories,
        stories: enrichment.description,
        jamRamai: enrichment.jamRamai || "18:00 - 20:00",
        waktuTerbaik: enrichment.waktuTerbaik || "Pagi hari",
        isRealTime
      });
    } catch (err) {
      console.error("Insight enrichment failed:", err);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!id || !user) return;
    try {
      const updated = await dataService.toggleBookmark(user.id, id);
      setIsBookmarked(updated.includes(id));
    } catch (err) {
      console.error("Gagal toggle bookmark:", err);
    }
  };

  const handleSendReview = async () => {
    if (!newComment.trim() || !place || submitting) return;
    
    setSubmitting(true);
    try {
      await dataService.addReview({
        placeId: place.id,
        userId: user?.id || "anon",
        userName: user?.name || "Penjelajah Kota",
        userAvatar: user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (user?.id || "anon"),
        rating: newRating,
        comment: newComment,
        mediaUrl: newImage || undefined
      });
      setNewComment("");
      setNewRating(5);
      setNewImage(null);
    } catch (err) {
      console.error("Gagal kirim review:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPlace) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold"></div>
      <p className="text-secondary-brown/40 font-serif italic">Mencari arsip...</p>
    </div>
  );

  if (!place) return (
    <div className="flex flex-col items-center justify-center h-screen gap-8 p-12 text-center bg-bg-cream/30">
      <div className="w-32 h-32 bg-accent-gold/10 rounded-full flex items-center justify-center text-accent-gold animate-pulse">
        <Sparkles size={64} />
      </div>
      <div className="space-y-4 max-w-lg">
        <h2 className="text-5xl font-serif italic text-secondary-brown tracking-tighter">Arsip Tersembunyi.</h2>
        <p className="text-secondary-brown/60 leading-relaxed font-medium italic">
          ID: <span className="font-mono text-[10px] bg-secondary-brown/5 px-2 py-1 rounded">{id}</span> <br/>
          Sepertinya tempat ini belum terdaftar di arsip pusat atau sedang dalam proses sinkronisasi data kolektif.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={() => navigate("/app/explore")}
          className="px-10 py-5 bg-secondary-brown text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all border-none cursor-pointer shadow-xl"
        >
          Cari di Eksplorasi
        </button>
        <button 
          onClick={() => window.location.reload()}
          className="px-10 py-5 bg-white text-secondary-brown rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-bg-cream transition-all border border-secondary-brown/10 cursor-pointer shadow-sm"
        >
          Coba Refresh
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-24 pb-32 relative">
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-secondary-brown/10 shadow-2xl rounded-2xl px-8 py-5 flex items-center gap-4 min-w-[320px]"
          >
            <div className="w-10 h-10 bg-primary-green rounded-full flex items-center justify-center text-white shadow-lg">
               <CheckCircle size={20} />
            </div>
            <div className="space-y-0.5">
               <p className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/30">Sync Success</p>
               <p className="text-sm font-serif italic text-secondary-brown">Changes Saved Successfully!</p>
            </div>
            <button 
              onClick={() => setShowSuccessToast(false)}
              className="ml-auto text-secondary-brown/20 hover:text-secondary-brown border-none bg-transparent cursor-pointer"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-16 border-b-2 border-secondary-brown/10 pb-16 px-4">
        <div className="space-y-10 flex-1">
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-4 text-secondary-brown/40 hover:text-secondary-brown transition-all uppercase text-[10px] font-extrabold tracking-[0.4em] bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-2 transition-transform" /> Back to Collection
          </button>
          
          {user?.role === 'admin' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-primary-green">
                <ShieldAlert size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Admin Editor Mode</span>
                <span className="h-px w-8 bg-primary-green/20"></span>
                <span className="font-mono text-[9px] text-secondary-brown/30">ID: {id}</span>
              </div>
              <h1 className="text-6xl font-serif text-secondary-brown tracking-tighter">
                Manajemen Destinasi.
              </h1>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-accent-gold font-extrabold uppercase tracking-[0.5em] text-[10px]">
                <Sparkles size={14} className="fill-accent-gold" /> Artifact No. {id?.slice(-4)}
              </div>
              <h1 className="text-8xl lg:text-[10rem] font-serif text-secondary-brown leading-[0.85] tracking-tighter">
                 {place.name} <br />
                 <span className="italic text-accent-gold opacity-90">{Array.isArray(place.category) ? place.category[0] : place.category}.</span>
              </h1>
            </div>
          )}

          <div className="flex flex-wrap gap-12 pt-8">
            <div className="space-y-2 flex-1 min-w-[300px]">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-secondary-brown/30">Location:</span>
              {user?.role === 'admin' ? (
                <textarea 
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                  className="w-full text-xl font-serif text-secondary-brown bg-transparent border-b-2 border-secondary-brown/10 focus:border-primary-green outline-none py-2 resize-none"
                  rows={2}
                />
              ) : (
                <p className="text-xl font-serif text-secondary-brown tracking-tight border-b border-accent-gold">{place.address}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {user?.role === 'admin' ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setEditForm(place)}
                className="px-8 py-4 bg-header-beige/50 text-secondary-brown/60 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-header-beige transition-all border-none cursor-pointer"
              >
                Reset
              </button>
              <button 
                onClick={handleUpdatePlace}
                disabled={isSaving}
                className="px-12 py-4 bg-primary-green text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary-brown transition-all shadow-xl flex items-center gap-3 border-none cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          ) : (
            <>
              <button 
                onClick={() => {
                  handleStartNavigation();
                  navSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-secondary-brown text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all border-none cursor-pointer shadow-xl flex items-center gap-3"
              >
                <Navigation size={16} />
                Jelajahi
              </button>

              {id?.startsWith('ai-') && (
                <button 
                  onClick={handleImportPlace}
                  disabled={isImporting}
                  className="px-8 py-4 bg-accent-gold text-secondary-brown rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all border-none cursor-pointer shadow-xl flex items-center gap-3"
                >
                  <Zap size={16} className={isImporting ? "animate-spin" : ""} />
                  {isImporting ? "Mengarsipkan..." : "Daftarkan ke Arsip"}
                </button>
              )}
              <button 
                onClick={handleToggleBookmark}
                className={`w-20 h-20 flex items-center justify-center border-2 transition-all cursor-pointer ${isBookmarked ? "bg-accent-gold border-accent-gold text-secondary-brown" : "border-secondary-brown/10 text-secondary-brown/40 hover:border-secondary-brown"}`}
              >
                <Bookmark size={28} fill={isBookmarked ? "currentColor" : "none"} />
              </button>
            </>
          )}
        </div>
      </div>

      {user?.role === 'admin' ? (
        <div className="space-y-16 animate-in fade-in duration-700">
          {/* Professional Header Section */}
          <div className="bg-white p-12 lg:p-20 rounded-[3rem] border border-secondary-brown/10 shadow-2xl relative overflow-hidden">
             <div className="flex flex-col lg:flex-row gap-16">
                {/* Left: Professional Image Feature */}
                <div className="lg:w-1/2 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-serif text-secondary-brown italic">Primary Destination Image</h3>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-secondary-brown/40 font-black">Official Visual Identity</p>
                    </div>
                    <button 
                      onClick={() => adminFileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-3 px-6 py-3 bg-secondary-brown text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all cursor-pointer border-none disabled:opacity-50 shadow-lg"
                    >
                      <Camera size={14} />
                      {isUploading ? "Uploading..." : "Upload New Photo"}
                    </button>
                    <input 
                      type="file" 
                      ref={adminFileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleAdminImageUpload} 
                    />
                  </div>

                  <div className="relative aspect-[16/10] rounded-[2.5rem] overflow-hidden border-8 border-bg-cream shadow-inner bg-bg-cream/20 group">
                    <img 
                      src={editForm.imageUrl || place.imageUrl} 
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105" 
                      alt="Preview" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80";
                      }}
                      style={{ opacity: isUploading ? 0.4 : 1 }}
                    />
                    {isUploading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm gap-4">
                        <div className="w-12 h-12 border-4 border-primary-green border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary-green">Processing...</span>
                      </div>
                    )}
                    <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[2.5rem] pointer-events-none"></div>
                  </div>
                </div>

                {/* Right: Core Meta Information */}
                <div className="lg:w-1/2 flex flex-col justify-center space-y-10">
                   <div className="space-y-8">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">Destination Name</label>
                       <input 
                         type="text"
                         value={editForm.name || ""}
                         onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                         className="w-full bg-header-beige/10 border-b-2 border-secondary-brown/10 p-4 font-serif text-5xl focus:border-primary-green outline-none transition-all placeholder:text-secondary-brown/10 text-secondary-brown italic"
                         placeholder="e.g. Urban Forest Cipete"
                       />
                     </div>

                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">Categories (Comma Separated)</label>
                       <input 
                         type="text"
                         value={Array.isArray(editForm.category) ? editForm.category.join(", ") : editForm.category || ""}
                         onChange={(e) => setEditForm({...editForm, category: e.target.value.split(",").map(s => s.trim())})}
                         className="w-full bg-header-beige/10 border-b-2 border-secondary-brown/10 p-4 font-serif text-2xl italic text-accent-gold focus:border-primary-green outline-none transition-all"
                       />
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="p-8 bg-header-beige/30 rounded-3xl border border-secondary-brown/5 space-y-1">
                         <span className="text-[9px] font-black uppercase tracking-widest text-secondary-brown/30">System ID</span>
                         <p className="font-mono text-xs text-secondary-brown/60 truncate">{id}</p>
                      </div>
                      <div className="p-8 bg-header-beige/30 rounded-3xl border border-secondary-brown/5 space-y-1">
                         <span className="text-[9px] font-black uppercase tracking-widest text-secondary-brown/30">Archive Status</span>
                         <p className="text-[10px] font-black text-primary-green flex items-center gap-2">
                            <Zap size={10} className="fill-primary-green" /> PERSISTED
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Detailed Form Breakdown */}
          <div className="grid lg:grid-cols-2 gap-16">
             {/* Left: Location Management */}
             <div className="bg-white p-12 lg:p-16 rounded-[3rem] border border-secondary-brown/10 shadow-xl space-y-10">
                <div className="flex items-center gap-4 text-secondary-brown mb-4">
                   <div className="w-10 h-10 bg-secondary-brown/5 rounded-2xl flex items-center justify-center">
                      <MapPin size={20} />
                   </div>
                   <h3 className="text-3xl font-serif italic">Location Logistics</h3>
                </div>

                <div className="space-y-6">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">Street Address</label>
                      <input 
                        type="text"
                        value={addressComponents.street}
                        onChange={(e) => setAddressComponents({...addressComponents, street: e.target.value})}
                        className="w-full bg-header-beige/5 border-b border-secondary-brown/10 p-4 font-serif text-lg focus:border-primary-green outline-none"
                        placeholder="e.g. Jl. Cipete Raya No. 1"
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">City</label>
                         <input 
                           type="text"
                           value={addressComponents.city}
                           onChange={(e) => setAddressComponents({...addressComponents, city: e.target.value})}
                           className="w-full bg-header-beige/5 border-b border-secondary-brown/10 p-4 font-serif text-lg focus:border-primary-green outline-none"
                           placeholder="Jakarta Selatan"
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">Province</label>
                         <input 
                           type="text"
                           value={addressComponents.province}
                           onChange={(e) => setAddressComponents({...addressComponents, province: e.target.value})}
                           className="w-full bg-header-beige/5 border-b border-secondary-brown/10 p-4 font-serif text-lg focus:border-primary-green outline-none"
                           placeholder="DKI Jakarta"
                         />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">Postcode</label>
                      <input 
                        type="text"
                        value={addressComponents.postcode}
                        onChange={(e) => setAddressComponents({...addressComponents, postcode: e.target.value})}
                        className="w-32 bg-header-beige/5 border-b border-secondary-brown/10 p-4 font-serif text-lg focus:border-primary-green outline-none"
                        placeholder="12410"
                      />
                   </div>
                </div>

                <div className="pt-8 border-t border-secondary-brown/5 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">Latitude</label>
                         <input 
                           type="number"
                           value={editForm.latitude ?? 0}
                           onChange={(e) => setEditForm({...editForm, latitude: parseFloat(e.target.value)})}
                           className="w-full bg-header-beige/5 border-b border-secondary-brown/10 p-4 font-mono text-xs focus:border-primary-green outline-none"
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 ml-1">Longitude</label>
                         <input 
                           type="number"
                           value={editForm.longitude ?? 0}
                           onChange={(e) => setEditForm({...editForm, longitude: parseFloat(e.target.value)})}
                           className="w-full bg-header-beige/5 border-b border-secondary-brown/10 p-4 font-mono text-xs focus:border-primary-green outline-none"
                         />
                      </div>
                   </div>
                </div>
             </div>

             {/* Right: Narrative & Controls */}
             <div className="flex flex-col gap-16">
                <div className="bg-white p-12 lg:p-16 rounded-[3rem] border border-secondary-brown/10 shadow-xl space-y-8 flex-1">
                   <div className="flex items-center gap-4 text-secondary-brown">
                      <div className="w-10 h-10 bg-secondary-brown/5 rounded-2xl flex items-center justify-center">
                         <History size={20} />
                      </div>
                      <h3 className="text-3xl font-serif italic">Curator's Narrative</h3>
                   </div>
                   <textarea 
                     value={editForm.description || ""}
                     onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                     className="w-full flex-1 bg-header-beige/5 border-2 border-secondary-brown/5 p-8 rounded-[2rem] font-serif text-xl italic text-secondary-brown/70 focus:border-accent-gold outline-none resize-none leading-relaxed"
                     rows={8}
                     placeholder="Write the magic of this place..."
                   />
                </div>

                {/* Persistent Action Bar */}
                <div className="bg-secondary-brown p-8 lg:p-10 rounded-[3rem] flex items-center justify-between gap-8 shadow-2xl">
                   <button 
                     onClick={() => {
                       setEditForm(place);
                       const parts = (place.address || "").split(",").map(s => s.trim());
                       setAddressComponents({
                         street: parts[0] || "",
                         city: parts[1] || "",
                         province: parts[2] || "",
                         postcode: parts[3] || ""
                       });
                     }}
                     className="px-10 py-5 bg-white/5 text-white/40 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border-none cursor-pointer"
                   >
                     Discard Changes
                   </button>
                   <button 
                     onClick={handleUpdatePlace}
                     disabled={isSaving || isUploading}
                     className="flex-1 px-12 py-5 bg-primary-green text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-4 border-none cursor-pointer disabled:opacity-50"
                   >
                     {isSaving ? (
                       <>
                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                         Synchronizing with Central Archive...
                       </>
                     ) : (
                       <>
                         <Send size={16} /> Save Changes & Persist to Database
                       </>
                     )}
                   </button>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-0 border border-secondary-brown/10">
          <div className="lg:col-span-8 p-8 lg:p-12 bg-white relative group">
            <div className="relative aspect-[16/9] lg:aspect-auto h-full overflow-hidden rounded-3xl">
               <img src={place.imageUrl} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-[2000ms]" alt={place.name} />
               <div className="absolute inset-0 border-[20px] border-white/10 pointer-events-none"></div>
               
               <motion.div 
                 initial={{ opacity: 0, x: 50 }}
                 whileInView={{ opacity: 1, x: 0 }}
                 className="absolute bottom-12 right-12 bg-white p-10 shadow-2xl space-y-6 max-w-sm border border-secondary-brown/5 rounded-3xl"
               >
                     <div className="space-y-2">
                       <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent-gold">Story Archive</span>
                       <p className="text-xl font-serif italic text-secondary-brown leading-relaxed leading-snug">
                         "{place.description}"
                       </p>
                     </div>
                  <div className="flex items-center gap-10 pt-4 border-t border-secondary-brown/5 text-secondary-brown">
                     <div className="flex flex-col">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-40">Distance</span>
                        <span className="text-2xl font-serif">{etaInfo.distance}</span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-40">Travel Time</span>
                        <span className="text-2xl font-serif">{etaInfo.time}</span>
                     </div>
                  </div>
               </motion.div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white p-12 lg:p-20 flex flex-col justify-between text-secondary-brown space-y-16">
             <div className="space-y-10 text-center lg:text-left">
                <div className="w-16 h-1 bg-accent-gold mx-auto lg:ml-0"></div>
                <h3 className="text-4xl lg:text-5xl font-serif italic tracking-tighter decoration-accent-gold/40 underline underline-offset-8">Curator's Note.</h3>
                <p className="text-xl font-extrabold text-secondary-brown/70 leading-relaxed uppercase tracking-tighter">
                   Waktu emas di sini sangat legendaris. Targetkan kedatangan pukul 16:30 untuk menyaksikan transisi menuju senja.
                </p>
             </div>
             
             <div className="space-y-8">
                <div className="grid grid-cols-2 gap-px bg-secondary-brown/10 border border-secondary-brown/10">
                  <div className="p-8 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent-gold">STATUS</span>
                    <p className={`text-2xl font-serif ${placeStatus.isOpen ? "text-green-600" : "text-red-500"}`}>
                      {placeStatus.status}
                    </p>
                  </div>
                  <div className="p-8 space-y-2 border-l border-secondary-brown/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent-gold">HOURS</span>
                      {placeInsights?.isRealTime && (
                         <div className="flex items-center gap-1 text-[8px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                           <div className="w-1 h-1 bg-green-600 rounded-full animate-pulse"></div>
                           Real-time
                         </div>
                      )}
                    </div>
                    <p className="text-2xl font-serif">{placeInsights?.openingHours || "08.00 — 22.00"}</p>
                  </div>
                </div>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-8 bg-secondary-brown text-white font-extrabold text-xs uppercase tracking-[0.4em] hover:bg-black transition-all duration-500 shadow-2xl flex items-center justify-center gap-4 no-underline"
                >
                  <Navigation size={16} /> Buka Google Maps
                </a>
             </div>
          </div>
        </div>
      )}

      {/* Navigation Map Section */}
      {user?.role !== 'admin' && (
        <div ref={navSectionRef} className="space-y-12 bg-bg-cream/20 py-12 md:py-24 rounded-[2rem] sm:rounded-[4rem]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 px-6 sm:px-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-accent-gold font-extrabold uppercase tracking-[0.5em] text-[10px]">
                <Navigation size={14} className="fill-accent-gold" /> Lokasi & Navigasi
              </div>
              <h2 className="text-6xl font-serif italic text-secondary-brown tracking-tighter">Arah & Navigasi.</h2>
              <p className="text-secondary-brown/40 max-w-sm font-medium italic">
                Klik tombol di bawah untuk membuka petunjuk arah lengkap di aplikasi Google Maps Anda.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <button 
                onClick={() => handleStartNavigation('driving')}
                className="px-10 py-5 bg-secondary-brown text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all no-underline shadow-xl flex items-center gap-3 border-none cursor-pointer"
              >
                Navigasi Mobil <Navigation size={14} />
              </button>
              <button 
                onClick={() => handleStartNavigation('walking')}
                className="px-10 py-5 bg-white text-secondary-brown border-2 border-secondary-brown/10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-bg-cream transition-all shadow-md cursor-pointer flex items-center gap-3"
              >
                Jalan Kaki <MapPin size={14} />
              </button>
            </div>
          </div>

          <div className="mx-2 sm:mx-12 relative h-[350px] sm:h-[500px] rounded-[2rem] sm:rounded-[3.5rem] overflow-hidden shadow-2xl border-2 sm:border-4 border-white bg-bg-cream/50 ring-1 ring-secondary-brown/5">
            {place && (
              <MapComponent 
                places={[place]} 
                userLocation={userLocation} 
                center={[place.latitude, place.longitude]} 
                selectedPlaceId={place.id}
                zoom={15}
              />
            )}

            <div className="absolute top-4 left-4 sm:top-8 sm:left-8 bg-white/90 backdrop-blur-md p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl border border-secondary-brown/5 max-w-[220px] sm:max-w-xs transition-all hover:scale-105">
               <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 bg-accent-gold/10 rounded-full flex items-center justify-center text-accent-gold">
                   <MapPin size={16} />
                 </div>
                 <h4 className="text-lg font-serif italic text-secondary-brown">Titik Tujuan</h4>
               </div>
               <p className="text-[10px] font-bold text-secondary-brown uppercase tracking-widest mb-1">{place.name}</p>
               <p className="text-[10px] text-secondary-brown/40 italic leading-relaxed line-clamp-2">{place.address}</p>
            </div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {user?.role !== 'admin' && (
        <div className="grid lg:grid-cols-12 gap-0 border-x border-b border-secondary-brown/10 bg-header-beige/10">
           <div className="lg:col-span-12 p-6 sm:p-12 lg:p-32 space-y-12 sm:space-y-24">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
                 <div className="space-y-4">
                    <div className="flex items-center gap-4 text-accent-gold font-extrabold uppercase tracking-[0.5em] text-[10px]">
                      <Zap size={14} className="fill-accent-gold" /> Live Archive Update
                    </div>
                    <h2 className="text-6xl font-serif italic text-secondary-brown tracking-tighter">Wawasan & <br/> Arsip Real-time.</h2>
                 </div>
                 {isLoadingInsights && (
                   <div className="flex items-center gap-4 text-secondary-brown/40 font-serif italic text-xl animate-pulse">
                     <div className="w-8 h-8 rounded-full border-2 border-accent-gold border-t-transparent animate-spin"></div>
                     Sinkronisasi data terkini...
                   </div>
                 )}
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-16">
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   className="space-y-8 bg-white p-12 rounded-[3.5rem] shadow-sm border border-secondary-brown/5"
                 >
                    <div className="w-16 h-16 bg-accent-gold/10 rounded-full flex items-center justify-center text-accent-gold">
                      <History size={24} />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-2xl font-serif text-secondary-brown">Cerita & Sejarah.</h4>
                      <p className="text-lg font-medium text-secondary-brown/60 leading-relaxed italic">
                        {placeInsights?.stories || (isLoadingInsights ? "Sedang menelusuri catatan sejarah..." : "Catatan unik sedang diproses oleh curator kami.")}
                      </p>
                    </div>
                 </motion.div>

                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.1 }}
                   className="space-y-8 bg-white p-12 rounded-[3.5rem] shadow-sm border border-secondary-brown/5"
                 >
                    <div className="w-16 h-16 bg-accent-gold/10 rounded-full flex items-center justify-center text-accent-gold">
                      <Info size={24} />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-2xl font-serif text-secondary-brown">Fasilitas Tambahan.</h4>
                      <ul className="space-y-4 list-none p-0">
                        {(placeInsights?.facilities || []).map((fac, i) => (
                          <li key={i} className="flex items-center gap-4 text-lg font-medium text-secondary-brown/60">
                            <div className="w-2 h-2 bg-accent-gold rotate-45"></div>
                            {fac}
                          </li>
                        ))}
                        {!placeInsights && !isLoadingInsights && <p className="text-secondary-brown/40 italic">Menunggu pemindaian fasilitas...</p>}
                        {isLoadingInsights && <p className="text-secondary-brown/40 italic animate-pulse">Menghitung artefak fisik...</p>}
                      </ul>
                    </div>
                 </motion.div>

                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.2 }}
                   className="space-y-8 bg-secondary-brown p-12 rounded-[3.5rem] shadow-xl text-white relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                    <div className="flex justify-between items-start">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-accent-gold">
                        <Clock size={24} />
                      </div>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${placeStatus.isOpen ? "bg-green-500/20 border-green-500/30" : "bg-red-500/20 border-red-500/30"}`}>
                         <div className={`w-2 h-2 rounded-full ${placeStatus.isOpen ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`}></div>
                         <span className={`text-[10px] font-black uppercase tracking-widest ${placeStatus.isOpen ? "text-green-300" : "text-red-300"}`}>
                           Live Status: {placeStatus.status}
                         </span>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <h4 className="text-2xl font-serif italic">Panduan Waktu.</h4>
                      
                      <div className="space-y-6">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-40">Jam Ramai</span>
                          <p className="text-2xl font-serif italic text-accent-gold">{placeInsights?.jamRamai || "—"}</p>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-white/10">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-40">Waktu Berkunjung Terbaik</span>
                          <p className="text-2xl font-serif leading-tight">
                            {placeInsights?.waktuTerbaik || "Memuat waktu kunjungan..."}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                         <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-40">Data Confidence</span>
                         <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: "98%" }}
                              className="h-full bg-accent-gold"
                            />
                         </div>
                      </div>
                    </div>
                 </motion.div>
              </div>
           </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-0 border-x border-b border-secondary-brown/10">
         <div className="lg:col-span-12 p-6 sm:p-12 lg:p-32 space-y-12 sm:space-y-20 bg-white">
            {user?.role !== 'admin' ? (
              <>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 border-b border-secondary-brown/5 pb-20">
                   <h3 className="text-5xl font-serif tracking-tighter uppercase leading-none text-secondary-brown">The Collective <br /> Voice.</h3>
                   <div className="flex items-center gap-10">
                      <div className="text-right">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-secondary-brown/30 mb-2">Total artifacts</p>
                        <p className="text-3xl font-serif italic text-secondary-brown">{reviews.length} Pengalaman dibagikan</p>
                      </div>
                      <div className="w-px h-16 bg-secondary-brown/10 hidden lg:block"></div>
                   </div>
                </div>

                <div className="space-y-px">
                   {/* New Comment Input */}
                   <div className="p-6 sm:p-12 lg:p-20 bg-header-beige/30 flex flex-col lg:flex-row gap-8 sm:gap-16 border-b-2 border-secondary-brown/10 rounded-t-[2rem] sm:rounded-t-[3rem]">
                      <div className="lg:w-1/3 space-y-6">
                        <h4 className="text-3xl font-serif italic text-secondary-brown">Share your <br /> Narrative.</h4>
                        <p className="text-xs font-extrabold text-secondary-brown/40 uppercase leading-relaxed tracking-widest">
                           Perspektif Anda penting. Tambahkan ke arsip keheningan estetika.
                        </p>
                         <div className="flex gap-2 pt-4 hidden">
                          {[1,2,3,4,5].map(i => (
                            <button key={i} onClick={() => setNewRating(i)} className={`transition-all bg-transparent border-none cursor-pointer ${i <= newRating ? "text-accent-gold" : "text-secondary-brown/10"}`}>
                              <Star size={24} fill={i <= newRating ? "currentColor" : "none"} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="lg:w-2/3 space-y-10">
                        <textarea 
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Tulis entri Anda di sini..."
                          className="w-full h-48 bg-white border-4 border-secondary-brown/5 p-10 font-serif text-3xl focus:border-secondary-brown outline-none transition-all placeholder:text-secondary-brown/10 resize-none text-secondary-brown rounded-3xl"
                        />

                        <div className="flex flex-wrap gap-6 items-end">
                          <button onClick={handleSendReview} disabled={submitting} className="group bg-secondary-brown text-[#fff] px-16 py-8 font-extrabold uppercase text-xs tracking-[0.5em] hover:bg-black transition-all flex items-center gap-4 rounded-full shadow-lg cursor-pointer h-20 border-none">
                             {submitting ? "Mengirim..." : "Kirim Artefak"} <Send size={16} className="group-hover:translate-x-2 transition-transform" />
                          </button>
                        </div>
                      </div>
                   </div>

                   {/* List Reviews */}
                   <div className="space-y-px">
                     {Array.isArray(reviews) && reviews.map((review, idx) => (
                        <motion.div 
                          key={review.id}
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          className="p-12 lg:p-20 bg-white flex flex-col md:flex-row gap-16 border-b border-secondary-brown/10 last:border-0 text-secondary-brown"
                        >
                          <div className="md:w-1/4 space-y-6">
                            <img src={review.userAvatar} className="w-24 h-24 rounded-full object-cover grayscale border border-secondary-brown/10" alt="user" />
                            <div className="space-y-2">
                               <h5 className="font-serif text-2xl tracking-tighter italic">@{review.userName}</h5>
                               <p className="text-[10px] font-extrabold opacity-30 uppercase tracking-[0.2em]">Contributor ID: {review.userId.slice(-6)}</p>
                            </div>
                          </div>
                          <div className="md:w-3/4 space-y-8">
                             <div className="flex gap-1 hidden">
                               {[1,2,3,4,5].map(i => (
                                 <Star key={i} className={i <= review.rating ? "text-accent-gold fill-accent-gold" : "text-secondary-brown/5"} size={14} />
                               ))}
                             </div>
                             <p className="text-4xl font-serif italic opacity-80 leading-snug">
                               "{review.comment}"
                             </p>
                             {review.mediaUrl && (
                               <div className="w-full max-w-2xl aspect-video rounded-3xl overflow-hidden shadow-2xl relative group">
                                  <img src={review.mediaUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Review artifact" />
                               </div>
                             )}
                             <div className="flex items-center gap-12 pt-6">
                                <button className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-widest text-secondary-brown/30 hover:text-secondary-brown transition-all bg-transparent border-none cursor-pointer">
                                   <ThumbsUp size={16} /> {review.likes || 0} Appreciations
                                </button>
                             </div>
                          </div>
                        </motion.div>
                     ))}
                   </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center space-y-8">
                <div className="w-24 h-24 bg-primary-green/10 rounded-full flex items-center justify-center mx-auto text-primary-green">
                  <ShieldAlert size={48} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-4xl font-serif italic text-secondary-brown">Arsip Manajemen Selesai.</h3>
                  <p className="max-w-md mx-auto text-secondary-brown/40 font-medium italic">
                    Gunakan panel editor di atas untuk melakukan perubahan data pada artefak "{place.name}". Semua perubahan akan tercatat di log sistem pusat.
                  </p>
                </div>
                <button 
                  onClick={() => navigate("/app/admin")}
                  className="px-12 py-5 bg-secondary-brown text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all border-none cursor-pointer shadow-xl"
                >
                  Kembali ke Dashboard Admin
                </button>
              </div>
            )}
         </div>
      </div>

      <AnimatePresence>
        {imageToEdit && (
          <ImageEditor 
            image={imageToEdit}
            onSave={(edited) => {
              setNewImage(edited);
              setImageToEdit(null);
            }}
            onCancel={() => setImageToEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
