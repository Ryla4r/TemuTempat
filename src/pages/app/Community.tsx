import React, { useState, useEffect, useMemo } from "react";
import { MessageSquare, Heart, Share2, Zap, Star, TrendingUp, Send, Edit3, Save, Plus, Image, Film, X, Sparkles, Search, Map as MapIcon, ArrowRight, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { dataService } from "../../services/dataService";
import { feedbackService } from "../../services/feedbackService";
import { motion, AnimatePresence } from "motion/react";
import { Place, Review } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import CommunityDetailModal from "../../components/CommunityDetailModal";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";

const REQUIRED_FIELDS = ['displayName', 'formattedAddress', 'id', 'location'];

interface TrendingHashtag {
  id: string;
  name: string;
}

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Terbaru");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [placesList, setPlacesList] = useState<Place[]>([]);
  const [placesMap, setPlacesMap] = useState<Record<string, Place>>({});
  const [trendingTags, setTrendingTags] = useState<TrendingHashtag[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingCommunity, setIsCreatingCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityDesc, setNewCommunityDesc] = useState("");
  const [isSubmittingCommunity, setIsSubmittingCommunity] = useState(false);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());
  const [activeDiscussion, setActiveDiscussion] = useState<string | null>(null);
  const [siteRating, setSiteRating] = useState<number | null>(null);
  const [siteFeedback, setSiteFeedback] = useState("");
  const [isSiteFeedbackSubmitted, setIsSiteFeedbackSubmitted] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Website Reviews/Ratings State
  const [websiteScores, setWebsiteScores] = useState<any[]>([]);
  const [websiteAvg, setWebsiteAvg] = useState<number>(4.8);
  const [loadingWebsiteScores, setLoadingWebsiteScores] = useState<boolean>(false);
  const [reviewSort, setReviewSort] = useState<"terbaru" | "terlama" | "tertinggi">("terbaru");

  // Website Rating Creation State
  const [userRating, setUserRating] = useState<number>(5);
  const [userRatingHover, setUserRatingHover] = useState<number | null>(null);
  const [userReviewText, setUserReviewText] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  
  // Admin Management State
  const [editingTrendingId, setEditingTrendingId] = useState<string | null>(null);
  const [tempRating, setTempRating] = useState<number>(0);

  // Create Post State
  const [isPosting, setIsPosting] = useState(false);
  const [postComment, setPostComment] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [isNewPlace, setIsNewPlace] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [newPostNotification, setNewPostNotification] = useState<string | null>(null);
  const [googlePlaces, setGooglePlaces] = useState<any[]>([]);

  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLib || !suggestionQuery || suggestionQuery.length < 3 || isNewPlace) {
      setGooglePlaces([]);
      return;
    }

    const timer = setTimeout(() => {
      placesLib.Place.searchByText({
        textQuery: suggestionQuery,
        fields: REQUIRED_FIELDS,
        maxResultCount: 5,
        region: 'ID' // Focus on Indonesia
      }).then(({ places }) => {
        setGooglePlaces(places || []);
      }).catch(err => {
        console.error("Gagal cari tempat di Google Maps:", err);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [placesLib, suggestionQuery, isNewPlace]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rawPlaces, rawReviews, rawHashtags, rawGroups] = await Promise.all([
          dataService.getPlaces(),
          dataService.getReviews(),
          dataService.getTrendingHashtags(),
          dataService.getGroups()
        ]);
        
        const allPlaces = Array.isArray(rawPlaces) ? rawPlaces : [];
        const allReviews = Array.isArray(rawReviews) ? rawReviews : [];
        const allHashtags = Array.isArray(rawHashtags) ? rawHashtags : [];
        const allGroups = Array.isArray(rawGroups) ? rawGroups : [];
        
        const pMap = allPlaces.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Place>);
        setPlacesMap(pMap);
        setPlacesList(allPlaces);
        setReviews(allReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setTrendingTags(allHashtags);
        setCommunities(allGroups);
      } catch (err) {
        console.error("Gagal ambil data komunitas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // subscriptions
    const reviewSub = dataService.subscribeReviews(undefined, (payload) => {
      if (payload.eventType === 'INSERT') {
        const mappedPost = dataService.mapReview(payload.new);
        setReviews(prev => {
          if (prev.some(r => r.id === mappedPost.id)) return prev;
          // Show real-time notification
          if (mappedPost.userId !== user?.id) {
            setNewPostNotification(`Postingan baru dari @${mappedPost.userName}`);
            setTimeout(() => setNewPostNotification(null), 5000);
          }
          return [mappedPost, ...prev];
        });
      } else if (payload.eventType === 'UPDATE') {
        const mappedPost = dataService.mapReview(payload.new);
        setReviews(prev => prev.map(r => r.id === mappedPost.id ? mappedPost : r));
      } else if (payload.eventType === 'DELETE') {
        setReviews(prev => prev.filter(r => r.id !== payload.old.id));
      }
    });

    const hashtagSub = dataService.subscribeTrendingHashtags((payload) => {
      if (payload.eventType === 'INSERT') {
        setTrendingTags(prev => {
          if (prev.some(h => h.id === payload.new.id)) return prev;
          return [payload.new as TrendingHashtag, ...prev];
        });
      } else if (payload.eventType === 'UPDATE') {
        setTrendingTags(prev => prev.map(h => h.id === payload.new.id ? payload.new as TrendingHashtag : h));
      } else if (payload.eventType === 'DELETE') {
        setTrendingTags(prev => prev.filter(h => h.id !== payload.old.id));
      }
    });

    const placeSub = dataService.subscribePlaces((payload) => {
      if (payload.eventType === 'INSERT') {
        const mappedPlace = dataService.mapPlace(payload.new);
        setPlacesList(prev => {
          if (prev.some(p => p.id === mappedPlace.id)) return prev;
          return [mappedPlace, ...prev];
        });
        setPlacesMap(prev => ({ ...prev, [mappedPlace.id]: mappedPlace }));
      } else if (payload.eventType === 'UPDATE') {
        const mappedPlace = dataService.mapPlace(payload.new);
        setPlacesList(prev => prev.map(p => p.id === mappedPlace.id ? mappedPlace : p));
        setPlacesMap(prev => ({ ...prev, [mappedPlace.id]: mappedPlace }));
      }
    });

    const groupSub = dataService.subscribeToGroups((allGroups) => {
      setCommunities(allGroups);
    });

    return () => {
      reviewSub.unsubscribe();
      hashtagSub.unsubscribe();
      placeSub.unsubscribe();
      groupSub();
    };
  }, []);

  const trendingPlaces = placesList
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 6);

  const displayReviews = selectedTag 
    ? reviews.filter(r => 
        (r.hashtags && r.hashtags.some(h => `#${h}`.toLowerCase() === selectedTag.toLowerCase() || h.toLowerCase() === selectedTag.toLowerCase() || h.replace('#', '').toLowerCase() === selectedTag.replace('#', '').toLowerCase())) ||
        r.comment.toLowerCase().includes(selectedTag.toLowerCase())
      )
    : reviews;

  const handleSiteRating = (rating: number) => {
    setSiteRating(rating);
  };

  const handleFeedbackSubmit = () => {
    if (!siteRating) return;
    
    feedbackService.addReview({
      rating: siteRating,
      comment: siteFeedback || "Tanpa ulasan tertulis.",
      userName: user?.name || "Ahmad Jaelani"
    });
    
    setIsSiteFeedbackSubmitted(true);
  };
  
  const handleUpdatePlaceRating = async (id: string) => {
    try {
      await dataService.updatePlace(id, { rating: tempRating });
      // Update local state if subscriptions didn't pick it up yet (though they should)
      setPlacesMap(prev => ({
        ...prev,
        [id]: { ...prev[id], rating: tempRating }
      }));
      setPlacesList(prev => prev.map(p => p.id === id ? { ...p, rating: tempRating } : p));
      setEditingTrendingId(null);
    } catch (err) {
      console.error("Gagal update rating:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMedia(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostSubmit = async () => {
    if (!user || !postComment) return;
    
    // Check if we selected a google place
    const isGooglePlace = selectedPlaceId.startsWith('google_');
    if (!isNewPlace && !selectedPlaceId) return;
    if (isNewPlace && !newPlaceName) return;
    
    setIsSubmittingPost(true);
    try {
      let targetPlaceId = selectedPlaceId;
      
      if (isGooglePlace) {
        // Find the place in our google results
        const gPlace = googlePlaces.find(p => `google_${p.id}` === selectedPlaceId);
        if (gPlace) {
          // Check if it already exists in our local list by name
          const existingLocal = placesList.find(p => p.name.toLowerCase() === gPlace.displayName?.toLowerCase());
          if (existingLocal) {
            targetPlaceId = existingLocal.id;
          } else {
            // Add as new place to our database automatically
            const addedPlace = await dataService.addPlace({
              name: gPlace.displayName || "Tempat dari Google Maps",
              address: gPlace.formattedAddress || "Lokasi spesifik",
              description: `Temuan dari Google Maps oleh @${user.name}`,
              category: ["Hidden Gem"],
              imageUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
              priceLevel: 2,
              latitude: gPlace.location?.lat() || -6.2,
              longitude: gPlace.location?.lng() || 106.8,
              addedBy: user.id
            });
            targetPlaceId = addedPlace.id;
          }
        }
      } else if (isNewPlace) {
        const place = await dataService.addPlace({
          name: newPlaceName,
          address: newPlaceAddress || "Lokasi spesifik menunggu konfirmasi",
          description: `Temuan baru oleh @${user.name}`,
          category: ["Baru"],
          imageUrl: mediaPreview || "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
          priceLevel: 2,
          latitude: -6.200000 + (Math.random() - 0.5) * 0.1,
          longitude: 106.816666 + (Math.random() - 0.5) * 0.1,
          addedBy: user.id
        });
        targetPlaceId = place.id;
      }

      const extractedFromComment = (postComment.match(/#[a-z0-9_]+/gi)?.map(h => h.slice(1)) || []) as string[];
      const combinedHashtags = Array.from(new Set(extractedFromComment)) as string[];

      const newReview = await dataService.addReview({
        placeId: targetPlaceId,
        userId: user.id,
        rating: 5,
        comment: postComment,
        userAvatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
        userName: user.name,
        mediaUrl: mediaPreview || undefined,
        hashtags: combinedHashtags
      });
      
      // Update locally if subscription is slow, but subscription will also catch it
      setReviews(prev => {
        if (prev.some(r => r.id === newReview.id)) return prev;
        return [newReview, ...prev];
      });
      
      // Reset form states
      setPostComment("");
      setSelectedPlaceId("");
      setIsNewPlace(false);
      setNewPlaceName("");
      setNewPlaceAddress("");
      setSelectedMedia(null);
      setMediaPreview(null);

      // Explicitly show success notification
      setShowSuccess(true);
      setIsSubmittingPost(false);
      setNewPostNotification("Postingan Anda telah dipublikasikan secara kolektif!");
      
      for (const tag of combinedHashtags) {
        const existing = trendingTags.find(t => t.name.toLowerCase() === (tag as string).toLowerCase() || t.name.toLowerCase() === `#${(tag as string).toLowerCase()}`);
        if (existing) {
          await dataService.updateTrendingHashtag(existing.id, { 
            updates_count: (existing as any).updates_count ? (existing as any).updates_count + 1 : 1 
          });
        } else {
          try {
            await dataService.addTrendingHashtag({ 
              name: `#${tag}`, 
              updates_count: 1 
            } as any);
          } catch (e) {
            // Might exist but not in local trendingTags yet
          }
        }
      }

      setTimeout(() => {
        setShowSuccess(false);
        setIsPosting(false);
        setNewPostNotification(null);
      }, 3000);
      
      const allPlaces = await dataService.getPlaces();
      setPlacesList(allPlaces);
      const pMap = allPlaces.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Place>);
      setPlacesMap(pMap);
    } catch (err) {
      console.error("Gagal mengirim postingan:", err);
      setIsSubmittingPost(false);
      setNewPostNotification("Gagal mengirim postingan. Silakan coba lagi.");
      setTimeout(() => setNewPostNotification(null), 3000);
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role === 'admin') return;
    if (!newCommunityName.trim()) {
      alert("Nama komunitas wajib diisi!");
      return;
    }

    setIsSubmittingCommunity(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .insert([{
          name: newCommunityName.trim(),
          description: newCommunityDesc.trim(),
          created_by: user.id,
          member_count: 1,
          image_url: `https://api.dicebear.com/7.x/initials/svg?seed=${newCommunityName}`
        }])
        .select()
        .single();
      
      if (error) {
        alert("Gagal membuat komunitas: " + error.message);
        throw error;
      }
      
      if (data) {
        // Also add the creator as the first member
        await supabase
          .from('group_members')
          .insert([{
            community_id: data.id,
            user_id: user.id
          }]);

        // Success: Redirect to chat room as requested
        navigate(`/app/community/${data.id}/chat`);
      }
    } catch (err: any) {
      console.error("Database error during community creation:", err);
      alert("Error Database: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmittingCommunity(false);
    }
  };

  const handleLike = (id: string) => {
    setLikedReviews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTopicName = (tag: any) => {
    if (typeof tag === 'string') return tag;
    return tag.name || "";
  };

// Trending items: if a tag is selected, show reviews for that tag. 
  // If no tag is selected, show a mix of trending places and recent reviews with media.
  const trendingFeed = useMemo(() => {
    if (selectedTag) return displayReviews;
    
    // Sort reviews with media by date
    const recentMediaReviews = reviews
      .filter(r => !!r.mediaUrl)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
    
    // Mix with trending places
    return [...trendingPlaces, ...recentMediaReviews];
  }, [selectedTag, displayReviews, reviews, trendingPlaces]);

  const content = (
    <div className="w-full max-w-screen-2xl mx-auto space-y-16 pb-24 px-4 sm:px-10 lg:px-20 relative">
      {/* Real-time Notification */}
      <AnimatePresence>
        {newPostNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 40 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-6 pointer-events-none"
          >
            <div className="bg-white/95 backdrop-blur-xl text-secondary-brown p-6 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-secondary-brown/5 flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent-gold/20 rounded-2xl flex items-center justify-center animate-pulse">
                  <Zap size={20} className="fill-accent-gold" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-brown/40">Aktivitas Kolektif</p>
                  <p className="font-serif text-xl italic tracking-tight">{newPostNotification}</p>
                </div>
              </div>
              <button 
                onClick={() => setNewPostNotification(null)}
                className="bg-transparent border-none text-secondary-brown/20 hover:text-black cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col gap-12 border-b border-secondary-brown/10 pb-16 pt-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 text-accent-gold font-extrabold uppercase tracking-[0.5em] text-[10px]">
            <Zap size={14} className="fill-accent-gold" /> Hub Komunitas
          </div>
          <h1 className="text-7xl lg:text-[12rem] font-serif text-secondary-brown leading-[0.75] tracking-tighter">
            The <br />
            <span className="italic text-secondary-brown/60 opacity-90">Collective.</span>
          </h1>
          <p className="text-xl sm:text-2xl text-secondary-brown/60 font-medium tracking-tight max-w-2xl leading-relaxed">
             Ruang diskusi kolektif tentang sudut-sudut estetik. Urasi visual oleh pengelana urban, untuk pengelana urban.
          </p>
        </div>

        {/* Updated Icon Tabs */}
        <div className="flex border-b-2 border-secondary-brown/5 px-4 overflow-x-auto no-scrollbar">
          {[
            { name: "Terbaru", icon: Zap },
            { name: "Trending", icon: Sparkles }
          ].map(tab => (
            <button
              key={tab.name}
              onClick={() => {
                setActiveTab(tab.name as any);
                setSelectedTag(null);
              }}
              className={`px-12 py-8 text-sm font-bold uppercase tracking-[0.4em] transition-all relative bg-transparent border-none cursor-pointer flex items-center gap-4 ${
                activeTab === tab.name ? "text-accent-gold italic" : "text-secondary-brown/20 hover:text-secondary-brown/40"
              }`}
            >
              <tab.icon size={18} />
              {tab.name}
              {activeTab === tab.name && (
                <motion.div layoutId="activeTabCommunity" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent-gold rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-secondary-brown/10 border border-secondary-brown/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden rounded-[4rem]">
        
        {/* Left - Sidebars (Conditional) */}
        <div className="lg:col-span-4 bg-bg-cream/30 border-r border-secondary-brown/10 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "Terbaru" ? (
              <motion.div
                key="sidebar-recent"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-12 sm:p-20 space-y-24"
              >
                {/* Elite Curators - Kelompok Penjelajah */}
                <div className="space-y-12">
                   <div className="flex items-center justify-between">
                     <div className="space-y-3">
                       <h3 className="text-[10px] font-extrabold text-secondary-brown/30 uppercase tracking-[0.5em]">Kolektif Utama</h3>
                       <p className="text-[11px] font-black text-primary-green uppercase tracking-tighter italic">Top Kelompok Penjelajah Pekan Ini</p>
                     </div>
                     
                     {user?.role !== 'admin' && (
                       <button 
                         onClick={() => setIsCreatingCommunity(true)}
                         className="flex items-center gap-2 bg-primary-green text-white px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-secondary-brown transition-all shadow-lg border-none cursor-pointer"
                       >
                         <Plus size={16} /> Buat Komunitas
                       </button>
                     )}
                   </div>
                   
                   {/* Create Community Section (Inline) */}
                   <AnimatePresence>
                     {isCreatingCommunity && (
                       <motion.form 
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: "auto", opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         onSubmit={handleCreateCommunity}
                         className="bg-white p-8 rounded-[2rem] shadow-xl border border-primary-green/20 space-y-6 overflow-hidden"
                       >
                         <div className="flex items-center justify-between">
                            <h4 className="font-serif text-2xl italic text-secondary-brown">Mulai Hub Baru</h4>
                            <button 
                              type="button"
                              onClick={() => setIsCreatingCommunity(false)}
                              className="text-secondary-brown/40 hover:text-red-500 bg-transparent border-none cursor-pointer"
                            >
                              <X size={18} />
                            </button>
                         </div>
                         
                         <div className="space-y-4">
                           <input 
                              type="text" 
                              placeholder="Nama Komunitas (e.g. Sunset Seekers)"
                              value={newCommunityName}
                              onChange={(e) => setNewCommunityName(e.target.value)}
                              className="w-full bg-header-beige/30 border-none p-4 rounded-xl font-serif text-xl focus:outline-none ring-1 ring-secondary-brown/5 focus:ring-primary-green/30"
                           />
                           <textarea 
                              placeholder="Deskripsi singkat..."
                              value={newCommunityDesc}
                              onChange={(e) => setNewCommunityDesc(e.target.value)}
                              className="w-full bg-header-beige/30 border-none p-4 rounded-xl font-medium text-sm focus:outline-none ring-1 ring-secondary-brown/5 focus:ring-primary-green/30 min-h-[100px]"
                           />
                         </div>
                         
                         <button 
                           type="submit"
                           disabled={isSubmittingCommunity}
                           className="w-full bg-primary-green text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-secondary-brown disabled:bg-secondary-brown/20 transition-all shadow-lg border-none cursor-pointer"
                         >
                           {isSubmittingCommunity ? "Memproses..." : "Pasang Gerbang Sekarang"}
                         </button>
                       </motion.form>
                     )}
                   </AnimatePresence>

                   <div className="space-y-12">
                     {communities.map((group, idx) => (
                       <motion.div 
                         whileHover={{ x: 15 }}
                         key={group.id} 
                         onClick={() => navigate(`/app/community/${group.id}/chat`)}
                         className="flex items-center gap-8 group cursor-pointer"
                       >
                         <div className="relative shrink-0">
                           <img 
                            src={group.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}`} 
                            className="w-20 h-20 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 border-4 border-white shadow-xl" 
                            alt={group.name} 
                           />
                           <div className="absolute -top-1 -right-1 w-8 h-8 bg-accent-gold text-white flex items-center justify-center text-[10px] font-extrabold rounded-full ring-4 ring-white shadow-lg">#{idx + 1}</div>
                         </div>
                         <div className="min-w-0">
                           <p className="font-serif text-3xl text-secondary-brown tracking-tighter leading-none mb-2">{group.name}</p>
                           <div className="flex items-center gap-2">
                            <p className="text-[10px] font-extrabold text-secondary-brown/40 uppercase tracking-[0.2em]">{group.memberCount || 0} Anggota</p>
                            <span className="w-1 h-1 bg-secondary-brown/20 rounded-full" />
                            <p className="text-[10px] font-black text-primary-green uppercase tracking-widest">Chat Sekarang</p>
                           </div>
                         </div>
                       </motion.div>
                     ))}
                   </div>
                </div>

                <div className="pt-10 border-t border-secondary-brown/5">
                   <p className="text-xs font-medium text-secondary-brown/40 italic leading-relaxed">
                     Bagian ini menampilkan kontributor paling aktif dalam diskusi kolektif pekan ini. Rating platform dipindahkan ke bagian bawah agar lebih luas.
                   </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="sidebar-trending"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-8 sm:p-12 space-y-12"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-accent-gold/10 rounded-xl flex items-center justify-center text-accent-gold shadow-sm">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-extrabold text-secondary-brown/30 uppercase tracking-[0.5em]">Global Pulse</h3>
                    <p className="text-[10px] font-black text-accent-gold uppercase italic tracking-tighter">Sedang Hangat</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(Array.isArray(trendingTags) && trendingTags.length > 0 ? trendingTags : [{id: '1', name: '#SenjaDiJakarta'}, {id: '2', name: '#KopiSembunyi'}]).map((tag, idx) => (
                    <motion.button 
                      key={tag.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => setSelectedTag(tag.name)}
                      className={cn(
                        "w-full text-left px-8 py-10 rounded-[2rem] transition-all no-underline border-none cursor-pointer group relative overflow-hidden",
                        selectedTag === tag.name 
                          ? "bg-secondary-brown text-white shadow-2xl scale-[1.02]" 
                          : "bg-header-beige/50 text-secondary-brown hover:bg-white hover:shadow-xl hover:scale-[1.02]"
                      )}
                    >
                      <span className="font-serif text-3xl tracking-tighter block relative z-10">{tag.name}</span>
                      <div className={cn(
                        "w-12 h-1 mt-4 transition-all duration-500",
                        selectedTag === tag.name ? "bg-accent-gold w-full" : "bg-accent-gold/40 group-hover:w-20"
                      )} />
                    </motion.button>
                  ))}
                </div>

                <div className="pt-10">
                  <p className="text-sm font-medium text-secondary-brown/40 italic leading-relaxed">
                    Pilih hashtag untuk melihat kurasi visual dari komunitas berdasarkan tema tersebut.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center - Feed */}
        <div className={cn(
          "lg:col-span-8 space-y-px transition-colors duration-1000",
          activeTab === "Trending" ? "bg-white/80" : "bg-white"
        )}>
          {loading ? (
             <div className="flex justify-center py-60">
                <div className="w-16 h-16 border-4 border-accent-gold border-t-transparent animate-spin rounded-full"></div>
             </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === "Terbaru" ? (
                <motion.div
                  key="recent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="divide-y divide-secondary-brown/5"
                >
                  {/* CREATE POST SECTION */}
                  <div className="p-12 lg:p-20 bg-white border-b-8 border-secondary-brown/10">
                    <AnimatePresence mode="wait">
                      {!isPosting ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={() => setIsPosting(true)}
                          className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-header-beige/30 border border-secondary-brown/5 cursor-pointer hover:bg-white hover:shadow-xl transition-all group"
                        >
                          <img 
                            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`} 
                            className="w-16 h-16 rounded-2xl grayscale group-hover:grayscale-0 transition-all shadow-lg" 
                            alt="me" 
                          />
                          <p className="text-xl font-serif text-secondary-brown/40 italic">Bagikan keseruan hidden gem-mu hari ini...</p>
                          <div className="ml-auto w-12 h-12 bg-secondary-brown text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Plus size={20} />
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-header-beige/10 p-10 rounded-[3rem] border border-primary-green/20 space-y-8 relative overflow-hidden"
                        >
                          <AnimatePresence>
                            {showSuccess && (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-primary-green/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center text-white space-y-6"
                              >
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.2 }}
                                  className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
                                >
                                  <motion.div
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.5, delay: 0.5 }}
                                  >
                                    <Sparkles size={60} className="text-primary-green fill-primary-green" />
                                  </motion.div>
                                </motion.div>
                                <div className="text-center space-y-2">
                                  <h4 className="font-serif text-5xl italic tracking-tighter">Berhasil!</h4>
                                  <p className="text-xs font-black uppercase tracking-[0.4em] opacity-80">Terima kasih atas kontribusimu.</p>
                                </div>
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: "200px" }}
                                  transition={{ duration: 2 }}
                                  className="h-1 bg-white/30 rounded-full overflow-hidden"
                                >
                                  <div className="h-full bg-white w-full animate-progress-fast" />
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="flex items-center justify-between">
                            <h3 className="font-serif text-3xl italic text-secondary-brown">Tulis Ceritamu</h3>
                            <button 
                              onClick={() => setIsPosting(false)}
                              className="text-secondary-brown/40 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>

                          {/* Announcement Box */}
                          <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-accent-gold/5 border-l-4 border-accent-gold p-6 rounded-r-2xl space-y-2"
                          >
                            <div className="flex items-center gap-3 text-accent-gold">
                              <Sparkles size={18} />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tips Menulis</span>
                            </div>
                            <p className="text-sm font-medium text-secondary-brown italic">
                              "Gunakan hashtag # untuk melihat saran tag trending. Setiap cerita yang jujur membantu menjaga ekosistem ketenangan kita tetap hidup."
                            </p>
                          </motion.div>

                          <div className="space-y-6">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest text-accent-gold">Lokasi Hidden Gem</p>
                                <button 
                                  onClick={() => setIsNewPlace(!isNewPlace)}
                                  className="text-[9px] font-bold text-accent-gold uppercase tracking-widest bg-white/50 px-4 py-2 rounded-full border border-accent-gold/20 hover:bg-secondary-brown hover:text-white transition-all cursor-pointer"
                                >
                                  {isNewPlace ? "Pilih dari Daftar" : "Tempat Baru?"}
                                </button>
                              </div>
                              
                              <AnimatePresence mode="wait">
                                {!isNewPlace ? (
                                  <motion.div
                                    key="select-place"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="relative flex-1"
                                  >
                                    <div className="relative group">
                                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary-brown/20 group-focus-within:text-accent-gold transition-colors" size={24} />
                                      <input 
                                        type="text"
                                        placeholder="Cari kota atau nama tempat..."
                                        value={selectedPlaceId ? placesMap[selectedPlaceId]?.name : suggestionQuery}
                                        onFocus={() => setShowSuggestions(true)}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setSuggestionQuery(val);
                                          setSelectedPlaceId(""); 
                                          setShowSuggestions(true);
                                        }}
                                        className="w-full bg-white border-none pl-16 pr-8 py-6 rounded-3xl font-serif text-2xl focus:outline-none ring-2 ring-secondary-brown/5 focus:ring-accent-gold/30 shadow-sm transition-all"
                                      />
                                      {selectedPlaceId && (
                                        <button 
                                          onClick={() => {
                                            setSelectedPlaceId("");
                                            setSuggestionQuery("");
                                          }}
                                          className="absolute right-6 top-1/2 -translate-y-1/2 bg-header-beige/50 p-2 rounded-full text-secondary-brown/40 hover:text-red-500 transition-all border-none cursor-pointer"
                                        >
                                          <X size={16} />
                                        </button>
                                      )}
                                    </div>

                                    {showSuggestions && !isNewPlace && (
                                      <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute left-0 right-0 top-full mt-4 z-[300] bg-white border border-secondary-brown/10 rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,0.2)] overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar"
                                      >
                                        <div className="p-4 bg-bg-cream/20 border-b border-secondary-brown/5 flex items-center gap-2">
                                           <MapIcon size={14} className="text-accent-gold" />
                                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-brown/40">Hasil Pencarian</span>
                                        </div>
                                        {placesList
                                          .filter(p => !suggestionQuery || p.name.toLowerCase().includes(suggestionQuery.toLowerCase()) || (p.address && p.address.toLowerCase().includes(suggestionQuery.toLowerCase())))
                                          .map(p => (
                                            <button
                                              key={p.id}
                                              onClick={() => {
                                                setSelectedPlaceId(p.id);
                                                setShowSuggestions(false);
                                                setSuggestionQuery("");
                                              }}
                                              className="w-full text-left p-6 hover:bg-primary-green/5 flex items-center gap-6 group transition-all border-none cursor-pointer border-b border-secondary-brown/5 last:border-0"
                                            >
                                              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
                                                <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.name} />
                                              </div>
                                              <div className="min-w-0">
                                                <h4 className="font-serif text-2xl text-secondary-brown group-hover:text-primary-green transition-colors">{p.name}</h4>
                                                <p className="text-secondary-brown/40 text-sm italic truncate">{p.address}</p>
                                              </div>
                                              <ArrowRight size={16} className="ml-auto text-primary-green opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                                            </button>
                                          ))}

                                        {googlePlaces.length > 0 && (
                                          <>
                                            <div className="p-4 bg-primary-green/5 border-b border-primary-green/10 flex items-center gap-2">
                                              <Sparkles size={14} className="text-primary-green" />
                                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-green">Saran dari Google Maps</span>
                                            </div>
                                            {Array.isArray(googlePlaces) && googlePlaces.map(p => (
                                              <button
                                                key={`google_${p.id}`}
                                                onClick={() => {
                                                  // Mark as google place so we can add it to DB on submit
                                                  setSelectedPlaceId(`google_${p.id}`);
                                                  setShowSuggestions(false);
                                                  setSuggestionQuery("");
                                                }}
                                                className="w-full text-left p-6 hover:bg-primary-green/5 flex items-center gap-6 group transition-all border-none cursor-pointer border-b border-secondary-brown/5 last:border-0"
                                              >
                                                <div className="w-16 h-16 rounded-2xl bg-header-beige/30 flex items-center justify-center shadow-md flex-shrink-0 group-hover:bg-primary-green/10 transition-colors">
                                                  <MapIcon size={24} className="text-secondary-brown/20 group-hover:text-primary-green transition-colors" />
                                                </div>
                                                <div className="min-w-0">
                                                  <h4 className="font-serif text-2xl text-secondary-brown group-hover:text-primary-green transition-colors">{p.displayName}</h4>
                                                  <p className="text-secondary-brown/40 text-sm italic truncate">{p.formattedAddress}</p>
                                                </div>
                                                <ArrowRight size={16} className="ml-auto text-primary-green opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                                              </button>
                                            ))}
                                          </>
                                        )}
                                      </motion.div>
                                    )}
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="new-place-input"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                                  >
                                    <input 
                                      type="text" 
                                      placeholder="Nama Hidden Gem..."
                                      value={newPlaceName}
                                      onChange={(e) => setNewPlaceName(e.target.value)}
                                      className="w-full bg-white border-none p-5 rounded-2xl font-serif text-xl focus:outline-none ring-1 ring-secondary-brown/5 focus:ring-primary-green/30"
                                    />
                                    <input 
                                      type="text" 
                                      placeholder="Alamat/Area (Opsional)"
                                      value={newPlaceAddress}
                                      onChange={(e) => setNewPlaceAddress(e.target.value)}
                                      className="w-full bg-white border-none p-5 rounded-2xl font-serif text-xl focus:outline-none ring-1 ring-secondary-brown/5 focus:ring-primary-green/30"
                                    />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            <div className="space-y-4 relative">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary-green">Ceritamu</p>
                                <span className="text-[9px] font-bold text-secondary-brown/40 uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full">Ketik # untuk saran</span>
                              </div>
                              <textarea 
                                value={postComment}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPostComment(val);
                                  
                                  const cursorPosition = e.target.selectionStart || 0;
                                  const textBeforeCursor = val.substring(0, cursorPosition);
                                  const lastHashIndex = textBeforeCursor.lastIndexOf('#');
                                  
                                  // Check if we are currently typing a hashtag (no space after the last #)
                                  if (lastHashIndex !== -1 && !textBeforeCursor.substring(lastHashIndex).includes(' ')) {
                                    const query = textBeforeCursor.substring(lastHashIndex + 1);
                                    setSuggestionQuery(query);
                                    setShowSuggestions(true);
                                  } else {
                                    setShowSuggestions(false);
                                  }
                                }}
                                onClick={(e) => {
                                  // Re-check suggestions when clicking to move cursor
                                  const cursorPosition = (e.target as HTMLTextAreaElement).selectionStart || 0;
                                  const textBeforeCursor = postComment.substring(0, cursorPosition);
                                  const lastHashIndex = textBeforeCursor.lastIndexOf('#');
                                  if (lastHashIndex !== -1 && !textBeforeCursor.substring(lastHashIndex).includes(' ')) {
                                    setSuggestionQuery(textBeforeCursor.substring(lastHashIndex + 1));
                                    setShowSuggestions(true);
                                  } else {
                                    setShowSuggestions(false);
                                  }
                                }}
                                placeholder="Gunakan hashtag seperti #SenjaDiJakarta untuk ikut serta dalam tren..."
                                className="w-full bg-white border-none p-8 rounded-[2.5rem] font-serif text-3xl tracking-tighter focus:outline-none ring-2 ring-secondary-brown/5 focus:ring-primary-green/30 min-h-[180px] resize-none shadow-sm placeholder:text-secondary-brown/10"
                              />

                              <AnimatePresence>
                                {showSuggestions && (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute left-0 right-0 top-full mt-4 z-50 bg-white/95 backdrop-blur-2xl border border-secondary-brown/10 rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.15)] overflow-hidden"
                                  >
                                    <div className="p-5 border-b border-secondary-brown/5 flex items-center justify-between bg-header-beige/30">
                                      <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-accent-gold rounded-full animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/60">Saran Tag Trending</span>
                                      </div>
                                      <button onClick={() => setShowSuggestions(false)} className="bg-transparent border-none p-2 cursor-pointer text-secondary-brown/20 hover:text-red-500 transition-colors">
                                        <X size={14} />
                                      </button>
                                    </div>
                                    <div className="max-h-[280px] overflow-y-auto p-3 custom-scrollbar">
                                      {(Array.isArray(trendingTags) && trendingTags.length > 0 ? trendingTags : [
                                        { id: '1', name: '#Collector', updates_count: 100 },
                                        { id: '2', name: '#HiddenGem', updates_count: 85 },
                                        { id: '3', name: '#Aesthetic', updates_count: 70 },
                                        { id: '4', name: '#KopiSembunyi', updates_count: 45 },
                                        { id: '5', name: '#Senja', updates_count: 30 }
                                      ])
                                        .filter(t => !suggestionQuery || t.name.toLowerCase().includes(suggestionQuery.toLowerCase()) || (t.name && t.name.replace('#', '').toLowerCase().includes(suggestionQuery.toLowerCase())))
                                        .map((tag) => (
                                          <button
                                            key={tag.id}
                                            onClick={() => {
                                              const textarea = document.querySelector('textarea');
                                              const currentPos = textarea?.selectionStart || 0;
                                              const textBeforeCursor = postComment.substring(0, currentPos);
                                              const lastHashIndex = textBeforeCursor.lastIndexOf('#');
                                              
                                              const before = postComment.substring(0, lastHashIndex);
                                              const after = postComment.substring(currentPos);
                                              
                                              const tagToAdd = tag.name.startsWith('#') ? tag.name : `#${tag.name}`;
                                              const newText = before + tagToAdd + " " + after;
                                              setPostComment(newText);
                                              setShowSuggestions(false);
                                              
                                              // Focus back and move cursor
                                              setTimeout(() => {
                                                if (textarea) {
                                                  textarea.focus();
                                                  const newPos = before.length + tagToAdd.length + 1;
                                                  textarea.setSelectionRange(newPos, newPos);
                                                }
                                              }, 0);
                                            }}
                                            className="w-full text-left px-6 py-5 rounded-2xl hover:bg-primary-green/5 text-secondary-brown font-serif text-2xl group border-none cursor-pointer flex items-center justify-between transition-all"
                                          >
                                            <div className="flex items-center gap-4">
                                              <div className="w-10 h-10 bg-secondary-brown/5 rounded-full flex items-center justify-center group-hover:bg-primary-green/10 transition-colors">
                                                <TrendingUp size={16} className="text-primary-green opacity-40 group-hover:opacity-100" />
                                              </div>
                                              <span>{tag.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <span className="text-[9px] font-black text-secondary-brown/20 italic">{(tag as any).updates_count || 0} SEBUTAN</span>
                                              <Zap size={14} className="text-accent-gold opacity-0 group-hover:opacity-100 transition-all" />
                                            </div>
                                          </button>
                                        ))}
                                      {trendingTags.length === 0 && !suggestionQuery && (
                                        <div className="p-10 text-center space-y-2">
                                          <p className="font-serif text-xl italic text-secondary-brown/40">Mulai tren baru...</p>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            <div className="space-y-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary-green">Visual Hidden Gem</p>
                              
                              <div className="relative">
                                {!mediaPreview ? (
                                  <label className="flex flex-col items-center justify-center w-full h-48 bg-white border-2 border-dashed border-secondary-brown/10 rounded-[2.5rem] cursor-pointer hover:bg-white/80 hover:border-primary-green/30 transition-all group overflow-hidden">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6 space-y-2">
                                      <div className="flex gap-2">
                                        <Image className="w-8 h-8 text-secondary-brown/20 group-hover:text-primary-green transition-colors" />
                                        <Film className="w-8 h-8 text-secondary-brown/20 group-hover:text-primary-green transition-colors" />
                                      </div>
                                      <p className="text-sm font-serif italic text-secondary-brown/40">Ketuk untuk pilih foto atau video dari galeri</p>
                                    </div>
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*,video/*"
                                      onChange={handleFileChange}
                                    />
                                  </label>
                                ) : (
                                  <div className="relative w-full rounded-[2.5rem] overflow-hidden bg-white border border-secondary-brown/10 shadow-xl group">
                                    {selectedMedia?.type.startsWith('video') ? (
                                      <video src={mediaPreview} className="w-full h-64 object-cover" controls />
                                    ) : (
                                      <img src={mediaPreview} className="w-full h-64 object-cover" alt="Preview" />
                                    )}
                                    <button 
                                      onClick={() => { setSelectedMedia(null); setMediaPreview(null); }}
                                      className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-red-500 shadow-2xl hover:bg-white transition-all border-none cursor-pointer z-10"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-end gap-6 pt-4">
                              <button 
                                onClick={handlePostSubmit}
                                disabled={(!selectedPlaceId && !isNewPlace) || (isNewPlace && !newPlaceName) || !postComment || isSubmittingPost}
                                className={cn(
                                  "w-full sm:w-auto px-12 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 border-none cursor-pointer shadow-xl",
                                  ((!selectedPlaceId && !isNewPlace) || (isNewPlace && !newPlaceName) || !postComment || isSubmittingPost)
                                    ? "bg-secondary-brown/10 text-secondary-brown/20"
                                    : "bg-primary-green text-white hover:bg-secondary-brown"
                                )}
                              >
                                {isSubmittingPost ? "MENGIRIM..." : "PUBLIKASIKAN"} <Send size={14} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Website Stats Summary */}
                  <div className="p-12 lg:p-20 bg-header-beige/30 border-b border-secondary-brown/5">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                      <div className="space-y-4 text-center md:text-left">
                        <h3 className="text-sm font-black uppercase tracking-[0.4em] text-primary-green">Komentar Kolektif</h3>
                        <h2 className="text-5xl lg:text-7xl font-serif text-secondary-brown tracking-tighter leading-none">Diskusi <br/><span className="italic">Penjelajah Urban.</span></h2>
                      </div>
                      <div className="flex gap-8">
                         <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-secondary-brown/5 text-center px-12">
                            <p className="text-4xl font-serif text-primary-green mb-1">4.9/5</p>
                            <p className="text-[10px] font-black uppercase text-secondary-brown/40 tracking-widest">Site Rating</p>
                         </div>
                         <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-secondary-brown/5 text-center px-12">
                            <p className="text-4xl font-serif text-accent-gold mb-1">1.2k+</p>
                            <p className="text-[10px] font-black uppercase text-secondary-brown/40 tracking-widest">Reports</p>
                         </div>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(displayReviews) && displayReviews.map((activity, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      key={activity.id}
                      className="bg-bg-deep-brown/20 p-8 sm:p-12 lg:p-16 space-y-8 group relative rounded-[2rem] m-8 shadow-2xl overflow-hidden border border-bg-cream/10"
                    >
                      <div className="flex flex-col space-y-6">
                        {/* Header like the image */}
                        <div className="flex items-center justify-between pb-4 border-b border-bg-cream/10">
                          <div className="flex items-center gap-4">
                            <img src={activity.userAvatar} className="w-10 h-10 rounded-full border border-bg-cream/10" alt="user" />
                            <div className="bg-bg-cream/5 px-4 py-1.5 rounded-full">
                              <span className="text-xs font-bold text-bg-cream">@{activity.userName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-bg-cream/40 uppercase tracking-widest">{new Date(activity.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>

                        {/* Image Section */}
                        {activity.mediaUrl && (
                          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-inner cursor-pointer" onClick={() => navigate(`/app/place/${activity.placeId}`)}>
                            <img 
                              src={activity.mediaUrl} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]" 
                              alt="post media"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent"></div>
                          </div>
                        )}

                        {/* Content Section */}
                        <div className="space-y-4 px-2 pb-2">
                          <div className="flex items-center justify-between">
                            <Link to={`/app/place/${activity.placeId}`} className="no-underline text-inherit group/title">
                              <h3 className="text-3xl font-serif text-secondary-brown group-hover/title:text-primary-green transition-colors tracking-tight">
                                {placesMap[activity.placeId]?.name || "Arsip Penjelajah"}
                              </h3>
                            </Link>
                            <div className="flex items-center gap-1.5 bg-secondary-brown text-white px-3 py-1 rounded-full shadow-lg">
                              <Star className="text-accent-gold fill-accent-gold" size={14} />
                              <span className="text-xs font-bold">{activity.rating}</span>
                            </div>
                          </div>

                          <p className="text-lg font-serif italic text-secondary-brown/80 leading-relaxed">
                            "{activity.comment}"
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(activity.hashtags) && activity.hashtags.map((tag, i) => (
                              <button 
                                key={i} 
                                onClick={() => setSelectedTag(`#${tag}`)}
                                className="text-xs font-bold uppercase tracking-widest text-primary-green hover:underline bg-transparent border-none p-0 cursor-pointer"
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-8 pt-4 border-t border-secondary-brown/5">
                            <button 
                              onClick={() => handleLike(activity.id)}
                              className={cn(
                                "flex items-center gap-2 text-[10px] font-black tracking-widest uppercase transition-all bg-transparent border-none cursor-pointer",
                                likedReviews.has(activity.id) ? "text-red-500 scale-110" : "text-secondary-brown/40 hover:text-red-500"
                              )}
                            >
                              <Heart size={20} className={likedReviews.has(activity.id) ? "fill-current" : ""} /> 
                              <span>{likedReviews.has(activity.id) ? (activity.likes || 0) + 1 : activity.likes || 0}</span>
                            </button>
                            
                            <button 
                              onClick={() => setActiveDiscussion(activeDiscussion === activity.id ? null : activity.id)}
                              className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-secondary-brown/40 hover:text-secondary-brown transition-all bg-transparent border-none cursor-pointer"
                            >
                              <MessageSquare size={20} /> <span>DISKUSI</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="trending"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="p-12 lg:p-20"
                >
                  <div className="mb-12">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-1 bg-accent-gold"></div>
                      <h3 className="text-sm font-black uppercase tracking-[0.4em] text-accent-gold">
                        {selectedTag ? `Results for ${selectedTag}` : "Pilihan Editor"}
                      </h3>
                    </div>
                    <h2 className="text-6xl sm:text-8xl font-serif text-secondary-brown leading-none tracking-tighter">
                      {selectedTag ? "Temuan Terkait." : <>Tempat Paling <br/> <span className="italic text-primary-green">Banyak Dicari.</span></>}
                    </h2>
                    {selectedTag && (
                      <button 
                        onClick={() => setSelectedTag(null)}
                        className="mt-6 text-xs font-black uppercase tracking-widest text-primary-green bg-transparent border-none cursor-pointer hover:underline"
                      >
                        ← Kembali ke semua temuan
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {Array.isArray(activeTab === "Trending" ? trendingFeed : []) && (activeTab === "Trending" ? trendingFeed : []).map((item, idx) => (
                      <motion.div
                        key={'id' in item ? item.id : (item as any).id || idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                          "group/card relative bg-bg-cream rounded-[3rem] overflow-hidden shadow-xl border border-bg-deep-brown/5",
                          editingTrendingId === ('id' in item ? item.id : null) && "ring-4 ring-accent-gold"
                        )}
                      >
                        {editingTrendingId === ('id' in item ? item.id : null) && (
                          <div className="absolute inset-0 z-20 bg-secondary-brown/90 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center space-y-6 animate-in fade-in">
                            <h4 className="text-white font-serif text-3xl italic tracking-tighter">Edit Trending Priority</h4>
                            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">Atur rating untuk mengubah urutan trending</p>
                            
                            <div className="flex gap-4 items-center">
                              <input 
                                type="range" 
                                min="0" 
                                max="5" 
                                step="0.1" 
                                value={tempRating}
                                onChange={(e) => setTempRating(parseFloat(e.target.value))}
                                className="w-48 appearance-none bg-white/10 h-1 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-accent-gold [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                              />
                              <span className="text-4xl font-serif text-accent-gold min-w-[60px]">{tempRating.toFixed(1)}</span>
                            </div>

                            <div className="flex gap-4 w-full max-w-xs">
                               <button 
                                 onClick={() => handleUpdatePlaceRating((item as Place).id)}
                                 className="flex-1 bg-accent-gold text-secondary-brown py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all border-none cursor-pointer flex items-center justify-center gap-2"
                               >
                                 <Save size={14} /> SIMPAN
                               </button>
                               <button 
                                 onClick={() => setEditingTrendingId(null)}
                                 className="flex-1 bg-white/10 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all border-none cursor-pointer"
                               >
                                 BATAL
                               </button>
                            </div>
                          </div>
                        )}
                        <Link to={`/app/place/${'id' in item ? item.id : (item as Review).placeId}`} className="block no-underline text-inherit overflow-hidden h-full">
                          <div className="aspect-[4/5] relative overflow-hidden">
                            <img 
                              src={'image' in item ? item.image : (item as Review).mediaUrl || placesMap[(item as Review).placeId]?.image} 
                              className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-1000" 
                              alt="trending" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover/card:opacity-40 transition-opacity"></div>
                            
                            <div className="absolute top-8 left-8 flex items-center gap-3">
                              <div className="bg-white/90 backdrop-blur-md px-6 py-2 rounded-full flex items-center gap-2">
                                <Star size={14} className="fill-accent-gold text-accent-gold" />
                                <span className="text-xs font-black text-secondary-brown">{('rating' in item ? (item as Place).rating : (item as Review).rating || 5).toFixed(1)}</span>
                              </div>
                              
                              {'mediaUrl' in item && (
                                <div className="bg-primary-green/90 backdrop-blur-md px-6 py-2 rounded-full text-white text-[9px] font-black uppercase tracking-widest">
                                  POSTING KOMUNITAS
                                </div>
                              )}

                              {user?.role === "admin" && 'id' in item && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingTrendingId(item.id);
                                    setTempRating(item.rating);
                                  }}
                                  className="bg-primary-green p-3 rounded-full text-white shadow-xl hover:bg-accent-gold transition-colors border-none cursor-pointer"
                                >
                                  <Edit3 size={14} />
                                </button>
                              )}
                            </div>
 
                            <div className="absolute bottom-10 left-10 right-10">
                              {'mediaUrl' in item ? (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase text-accent-gold tracking-[0.3em] mb-1">
                                    @{ (item as Review).userName }
                                  </p>
                                  <h4 className="text-2xl font-serif text-white tracking-tighter leading-tight group-hover/card:translate-x-2 transition-transform duration-500 line-clamp-2">
                                    "{ (item as Review).comment }"
                                  </h4>
                                </div>
                              ) : (
                                <>
                                  <p className="text-[10px] font-black uppercase text-accent-gold tracking-[0.3em] mb-3">
                                    {(item as Place).category.join(", ")}
                                  </p>
                                  <h4 className="text-4xl font-serif text-white tracking-tighter leading-tight group-hover/card:translate-x-2 transition-transform duration-500">
                                    {(item as Place).name}
                                  </h4>
                                </>
                              )}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>      {/* NEW: Wide Horizontal Site Rating Banner / Admin Trending Control */}
      <AnimatePresence>
        {activeTab === "Terbaru" && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "mt-16 p-12 sm:p-20 rounded-[4rem] shadow-[0_30px_60px_-15px_rgba(45,86,64,0.3)] relative overflow-hidden",
              user?.role === "admin" ? "bg-secondary-brown text-white" : "bg-primary-green text-white"
            )}
          >
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {user?.role === "admin" ? (
                <>
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} className="text-accent-gold" />
                      </div>
                      <h3 className="font-black text-xs uppercase tracking-[0.5em]">Admin Trending Control</h3>
                    </div>
                    <h2 className="text-6xl sm:text-8xl font-serif leading-[0.85] tracking-tighter">
                      Kurasi Arus <br />
                      <span className="italic opacity-80 text-accent-gold">Kolektif Anda.</span>
                    </h2>
                    <p className="text-xl text-white/60 font-medium leading-relaxed max-w-xl">
                      Anda memiliki otoritas penuh untuk mengatur tren. Gunakan tab <span className="text-accent-gold">Trending</span> untuk menyesuaikan urutan prioritas tempat-tempat yang sedang hangat.
                    </p>
                    <button 
                      onClick={() => setActiveTab("Trending")}
                      className="bg-accent-gold text-secondary-brown px-12 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-white transition-all shadow-2xl border-none cursor-pointer"
                    >
                      Buka Kontrol Trending
                    </button>
                  </div>
                  <div className="hidden lg:flex justify-center flex-col items-center gap-6">
                     <div className="w-64 h-64 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                        <Edit3 size={120} className="text-accent-gold opacity-20" />
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">Mode Administrator Aktif</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                        <Star size={24} className="text-accent-gold fill-accent-gold" />
                      </div>
                      <h3 className="font-black text-xs uppercase tracking-[0.5em]">Site Quality Evaluation</h3>
                    </div>
                    <h2 className="text-6xl sm:text-8xl font-serif leading-[0.85] tracking-tighter">
                      Feedbackmu <br />
                      <span className="italic opacity-80">adalah kompas.</span>
                    </h2>
                    <p className="text-xl text-white/70 font-medium leading-relaxed max-w-xl">
                      Bantu kami menyempurnakan kurasi visual ini. Ratingmu menentukan arah perkembangan platform Kolektif selanjutnya.
                    </p>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xl p-8 sm:p-12 rounded-[3.5rem] border border-white/10 overflow-hidden">
                    <AnimatePresence mode="wait">
                      {!isSiteFeedbackSubmitted ? (
                        <motion.div 
                          key="rating-form"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-10"
                        >
                          <div>
                            <p className="text-sm font-black uppercase tracking-widest text-accent-gold mb-8 text-center lg:text-left">1. Nilai Pengalamanmu</p>
                            <div className="flex justify-between items-center gap-1 sm:gap-4">
                              {[1,2,3,4,5].map(star => (
                                <button 
                                  key={star} 
                                  onClick={() => handleSiteRating(star)}
                                  className="group/star transition-all duration-500 hover:-translate-y-1 bg-transparent border-none cursor-pointer flex flex-col items-center gap-2"
                                >
                                  <div className={cn(
                                    "w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500",
                                    siteRating && siteRating >= star ? "bg-accent-gold shadow-2xl scale-105" : "bg-white/10 group-hover/star:bg-white/20"
                                  )}>
                                    <Star 
                                      size={18} 
                                      className={cn(
                                        "transition-all sm:w-6 sm:h-6",
                                        siteRating && siteRating >= star ? "text-white fill-white" : "text-white/20"
                                      )} 
                                    />
                                  </div>
                                  <span className={cn(
                                    "text-[8px] font-black uppercase tracking-widest transition-opacity hidden sm:block",
                                    siteRating === star ? "opacity-100" : "opacity-0"
                                  )}>
                                    {star === 5 ? "Perfect" : star === 1 ? "Fix This" : "Good"}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-6">
                            <p className="text-sm font-black uppercase tracking-widest text-accent-gold text-center lg:text-left">2. Bagikan Aspirasi (Opsional)</p>
                            <textarea 
                              value={siteFeedback}
                              onChange={(e) => setSiteFeedback(e.target.value)}
                              placeholder="Apa yang bisa kami tingkatkan? Bagikan pemikiranmu di sini..."
                              className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/50 transition-all resize-none h-32 placeholder:text-white/20"
                            />
                            <button 
                              onClick={handleFeedbackSubmit}
                              disabled={!siteRating}
                              className={cn(
                                "w-full py-6 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border-none cursor-pointer flex items-center justify-center gap-3",
                                siteRating ? "bg-accent-gold text-secondary-brown hover:bg-white hover:scale-[1.02] shadow-xl" : "bg-white/10 text-white/20 cursor-not-allowed"
                              )}
                            >
                              KIRIM ASPRESIASI <Send size={14} />
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="rating-success"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-8 sm:p-12 text-center space-y-6"
                        >
                          <div className="flex flex-col items-center gap-4">
                             <div className="flex gap-2 mb-4">
                               {[1,2,3,4,5].map(star => (
                                 <Star 
                                   key={star} 
                                   size={24} 
                                   className={cn(
                                     "transition-all",
                                     siteRating && siteRating >= star ? "text-accent-gold fill-accent-gold" : "text-white/10"
                                   )} 
                                 />
                               ))}
                             </div>
                             <div className="w-16 h-16 bg-accent-gold/20 rounded-full flex items-center justify-center shadow-xl">
                               <Zap size={24} className="fill-accent-gold text-accent-gold" />
                             </div>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold">Apresiasi Dicatat</p>
                              <h3 className="text-3xl font-serif tracking-tighter text-white">Terima kasih, {user?.name || "Kurator"}!</h3>
                            </div>
                            
                            {siteFeedback && (
                              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 italic text-sm text-white/80 leading-relaxed text-left relative">
                                 <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary-green rounded-full flex items-center justify-center border border-white/10">
                                   <MessageSquare size={12} className="text-accent-gold" />
                                 </div>
                                 "{siteFeedback}"
                              </div>
                            )}
                            
                            <p className="text-[11px] text-white/40 font-medium italic">Masukanmu sangat berharga bagi kurasi visual Kolektif selanjutnya.</p>
                          </div>
                          <button 
                            onClick={() => {
                              setIsSiteFeedbackSubmitted(false);
                              setSiteRating(null);
                              setSiteFeedback("");
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-accent-gold/60 bg-transparent border-none cursor-pointer hover:text-accent-gold transition-colors"
                          >
                            Kirim ulasan lain
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
            
            {/* Aesthetic Background Accents */}
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-accent-gold/10 rounded-full blur-[100px]" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[120px] -mr-40 -mt-40" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Community Detail Modal */}
      <AnimatePresence>
        {selectedCommunity && (
          <CommunityDetailModal 
            community={selectedCommunity} 
            onClose={() => setSelectedCommunity(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );

  return content;
}
