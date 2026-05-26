import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, MapPin, Sparkles, ShieldCheck, Zap, Star, Heart, MessageCircle, CornerDownRight } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";

import { feedbackService, SiteReview } from "../services/feedbackService";
import { dataService } from "../services/dataService";
import { getUnsplashImage } from "../services/unsplashService";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [siteReviews, setSiteReviews] = useState<SiteReview[]>([]);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [featuredPlaces, setFeaturedPlaces] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);

  // Realtime site reviews from feedbackService
  useEffect(() => {
    const unsub = feedbackService.subscribe((reviews) => {
      setSiteReviews(reviews);
      // Hitung rata-rata dari data nyata
      if (reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setAverageRating(avg);
      } else {
        setAverageRating(0);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [places, posts] = await Promise.all([
          dataService.getPlaces(),
          dataService.getPosts(),
        ]);
        
        const enhancedPlaces = await Promise.all(
          places.slice(0, 4).map(async (place: any) => {
            try {
              const url = await getUnsplashImage(place.name, place.category);
              return { ...place, imageUrl: url || place.imageUrl };
            } catch (err) {
              return place;
            }
          })
        );
        
        setFeaturedPlaces(enhancedPlaces);
        setCommunityPosts(posts.slice(0, 6));

        const combinedAvg = allRatings.length > 0
          ? allRatings.reduce((sum: number, val: number) => sum + val, 0) / allRatings.length
          : ratingAvg || 4.8;
        setAverageRating(combinedAvg);
      } catch (err) {
        console.error("Gagal ambil data:", err);
      }
    };

    fetchData();

    const postSub = dataService.events.addEventListener("user_posts_change", (payload: any) => {
      if (payload.detail.eventType === 'INSERT') {
        setCommunityPosts(prev => [payload.detail.new, ...prev].slice(0, 6));
      }
    });

    return () => {};
  }, []);

  return (
    <div className="min-h-screen bg-bg-cream selection:bg-accent-gold selection:text-secondary-brown font-sans overflow-x-hidden text-secondary-brown">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full bg-bg-cream/80 backdrop-blur-xl border-b border-secondary-brown/10 px-4 sm:px-10 py-4 md:py-5 z-50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
          <Link className="flex items-center gap-3 sm:gap-4 group no-underline hover:no-underline focus:no-underline focus:outline-none" to="/">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary-brown text-white rounded-xl flex items-center justify-center font-serif text-xl sm:text-2xl shadow-md transform group-hover:rotate-6 transition-transform">T</div>
            <span className="font-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight text-secondary-brown italic">TemuTempat</span>
          </Link>
          <div className="flex gap-4 sm:gap-6">
            {user ? (
              <Link to="/app" className="bg-secondary-brown text-white px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-black transition-all shadow-md no-underline">
                Explore
              </Link>
            ) : (
              <Link to="/login" className="bg-secondary-brown text-white px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-black transition-all shadow-md no-underline">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 sm:pt-48 lg:pt-56 pb-20 lg:pb-32 px-4 sm:px-10 bg-bg-cream relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-7 space-y-8 sm:space-y-12">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-secondary-brown/5 text-secondary-brown rounded-full text-[9px] font-extrabold uppercase tracking-[0.25em] mb-6 sm:mb-10 border border-secondary-brown/10">
                  <Zap size={12} className="text-secondary-brown fill-secondary-brown" /> Temukan Sudut Tersembunyi
                </div>
                <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[8rem] xl:text-[9.5rem] font-serif text-secondary-brown mb-6 sm:mb-10 leading-[0.9] tracking-tight">
                  Escape the <br />
                  <span className="text-secondary-brown italic">Ordinary.</span>
                </h1>
                <p className="text-lg sm:text-2xl text-secondary-brown/80 font-medium leading-relaxed max-w-xl border-l-4 border-secondary-brown pl-6 sm:pl-8 italic my-6 sm:my-8">
                  Temukan tempat perlindungan artistik, kopi senja tersembunyi, dan pesona alam yang belum terjamah. Dirancang untuk pencari keindahan sejati.
                </p>
                <div className="flex gap-4 sm:gap-6 pt-4 sm:pt-6">
                  <Link to={user ? "/app" : "/login"} className="group relative bg-secondary-brown text-white px-8 sm:px-12 py-4 sm:py-6 rounded-none font-extrabold text-lg sm:text-xl transition-all hover:bg-black shadow-lg no-underline">
                    <span className="relative z-10 flex items-center gap-3 sm:gap-4">{user ? "Mulai Eksplor" : "Bergabung Sekarang"} <ArrowRight size={20} /></span>
                    <div className="absolute inset-0 bg-accent-gold translate-x-1.5 translate-y-1.5 -z-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform"></div>
                  </Link>
                </div>
              </motion.div>
            </div>
            
            <div className="lg:col-span-5 relative mt-12 lg:mt-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="relative z-10"
              >
                <div className="aspect-[4/5] overflow-hidden bg-white p-3 sm:p-4 shadow-xl border border-secondary-brown/10">
                  <img 
                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80" 
                    alt="Sanctuary" 
                    className="w-full h-full object-cover grayscale-[15%] hover:grayscale-0 transition-all duration-[1200ms]"
                  />
                </div>
                
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-8 -left-4 sm:-bottom-12 sm:-left-12 bg-white p-6 sm:p-10 text-secondary-brown shadow-2xl max-w-[260px] sm:max-w-xs border border-secondary-brown/5"
                >
                  <p className="font-serif text-xl sm:text-3xl mb-4 sm:mb-6 italic leading-tight">"Keindahan sesungguhnya terletak di tempat-tempat yang sunyi."</p>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest opacity-40">— Sang Penjelajah</p>
                </motion.div>
              </motion.div>

              <div className="absolute -top-10 -right-10 w-64 h-64 sm:w-80 sm:h-80 bg-accent-gold/20 rounded-full blur-[80px] sm:blur-[120px]"></div>
              <div className="absolute top-1/2 -left-10 w-48 h-48 sm:w-64 sm:h-64 bg-secondary-brown/5 rounded-full blur-[70px] sm:blur-[100px]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Website Ratings & Testimonials */}
      <section className="py-20 sm:py-32 bg-white relative overflow-hidden border-t border-b border-secondary-brown/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 sm:mb-16 gap-8 text-center md:text-left border-b border-secondary-brown/5 pb-12 sm:pb-16">
            <div className="space-y-3 sm:space-y-4">
              <div className="inline-flex items-center gap-2 text-secondary-brown/50 font-extrabold uppercase tracking-[0.3em] text-[10px]">
                <ShieldCheck size={14} className="text-secondary-brown opacity-60" /> Ulasan Pengguna & Kurator
              </div>
              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-serif text-secondary-brown leading-none tracking-tighter italic">
                Suara Komunitas.
              </h2>
            </div>
            
            <div className="flex flex-col md:items-end gap-1.5">
              {averageRating > 0 ? (
                <div className="flex items-center justify-center md:justify-end gap-4">
                  <span className="text-5xl sm:text-8xl font-serif text-secondary-brown leading-none italic">{averageRating.toFixed(1)}</span>
                  <div className="flex flex-col items-start">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={16} className={`${s <= Math.round(averageRating) ? "fill-secondary-brown text-secondary-brown" : "text-secondary-brown/20"}`} />
                      ))}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#FFB6C1] mt-1.5">Rating Sangat Baik</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-serif italic text-secondary-brown/30">Belum ada rating.</p>
              )}
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-secondary-brown/30 md:text-right">
                Berdasarkan Ulasan {siteReviews.length} Teman Perjalanan
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {siteReviews.length > 0 ? siteReviews.map((review, idx) => (
                <motion.div
                  key={review.id || idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-bg-cream/40 p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] border border-secondary-brown/10 flex flex-col justify-between group hover:bg-neutral-50 hover:shadow-xl transition-all duration-500 h-full border-b-[5px] border-b-secondary-brown/20"
                >
                  <div className="space-y-5">
                    {/* Stars */}
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={14} className={star <= review.rating ? "text-secondary-brown fill-secondary-brown" : "text-secondary-brown/10"} />
                      ))}
                    </div>

                    {/* Comment */}
                    <p className="text-xl sm:text-2xl font-serif text-secondary-brown/90 leading-relaxed italic pr-2">
                      "{review.comment}"
                    </p>

                    {/* Like & Reply count — read only di landing page */}
                    <div className="flex items-center gap-5 pt-1">
                      {review.likes?.length > 0 && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-secondary-brown/30">
                          <Heart size={12} className="fill-red-300 text-red-300" />
                          {review.likes.length}
                        </span>
                      )}
                      {review.replies?.length > 0 && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-secondary-brown/30">
                          <MessageCircle size={12} />
                          {review.replies.length} balasan
                        </span>
                      )}
                    </div>

                    {/* Show up to 1 reply preview */}
                    {review.replies?.length > 0 && (
                      <div className="bg-white/60 rounded-2xl p-4 border border-secondary-brown/5 flex gap-2 items-start">
                        <CornerDownRight size={10} className="text-secondary-brown/20 mt-1 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-[9px] font-black text-secondary-brown uppercase tracking-wide">
                              {review.replies[0].userName}
                            </span>
                            {review.replies[0].userRole === "admin" && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-secondary-brown text-white rounded-full text-[7px] font-black uppercase tracking-widest">
                                <ShieldCheck size={7} /> Admin
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-secondary-brown/50 font-serif italic line-clamp-1">{review.replies[0].text}</p>
                          {review.replies.length > 1 && (
                            <p className="text-[9px] text-secondary-brown/30 font-bold mt-1">+{review.replies.length - 1} balasan lainnya</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t border-secondary-brown/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-serif text-secondary-brown text-lg shadow-md border border-secondary-brown/5 group-hover:bg-secondary-brown group-hover:text-white transition-colors duration-300 uppercase font-bold shrink-0">
                        {review.userName ? review.userName.charAt(0) : "E"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-secondary-brown uppercase tracking-[0.15em]">{review.userName || 'Explorer'}</h4>
                          {review.userRole === "admin" && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-secondary-brown text-white rounded-full text-[7px] font-black uppercase tracking-widest">
                              <ShieldCheck size={7} /> Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-bold text-secondary-brown/40 uppercase tracking-widest mt-0.5">
                          {timeAgo(review.createdAt)}
                        </p>
                      </div>
                    </div>
                    {/* CTA untuk login */}
                    {!user && (
                      <Link
                        to="/login"
                        className="text-[9px] font-black uppercase tracking-widest text-secondary-brown/30 hover:text-secondary-brown transition-colors no-underline border border-secondary-brown/10 px-3 py-1.5 rounded-full"
                      >
                        Like & Balas →
                      </Link>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-16 sm:py-20 bg-bg-cream/20 rounded-[3rem] border border-dashed border-secondary-brown/15">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-secondary-brown/30 italic">Belum ada ulasan platform yang terekam...</p>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* Featured Places Section */}
      <section className="py-20 sm:py-36 bg-bg-cream/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-10">
          <div className="flex flex-col items-center mb-16 sm:mb-24 text-center space-y-4">
            <span className="inline-flex items-center gap-2 text-secondary-brown/50 font-extrabold uppercase tracking-[0.3em] text-[10px]">
              <Sparkles size={12} /> Destinasi Terpilih
            </span>
            <h2 className="text-4xl sm:text-6xl font-serif text-secondary-brown leading-tight italic tracking-tight">
              Eksplorasi <span className="text-secondary-brown italic">Terpopuler.</span>
            </h2>
            <p className="text-sm sm:text-base text-secondary-brown/60 max-w-xl font-medium uppercase tracking-widest leading-loose">
              Beberapa destinasi paling inspiratif yang baru saja ditambahkan oleh komunitas kami menggunakan kurasi visual otomatis.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {featuredPlaces.map((place, idx) => (
              <motion.div
                key={place.id || idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group cursor-pointer bg-white p-4 rounded-[2rem] border border-secondary-brown/5 shadow-md hover:shadow-xl transition-all h-full"
                onClick={() => navigate(user ? `/app/place/${place.id}` : "/login")}
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] mb-4 sm:mb-6">
                  <img 
                    src={place.imageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-all duration-[1000ms]" 
                    alt={place.name} 
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-secondary-brown shadow-sm border border-secondary-brown/5">
                    {place.category}
                  </div>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-secondary-brown italic group-hover:text-secondary-brown/70 transition-colors px-1">{place.name}</h3>
                <div className="flex items-center gap-2 mt-2 opacity-60 px-1 text-secondary-brown">
                  <MapPin size={10} />
                  <span className="text-[9px] font-bold uppercase tracking-widest">{place.location}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium CTA */}
      <section className="py-12 sm:py-20 px-4 sm:px-10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#FAF9F6] rounded-[2.5rem] sm:rounded-[4rem] p-10 sm:p-20 md:p-24 text-center relative overflow-hidden shadow-xl border border-secondary-brown/10">
            <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-accent-gold/20 rounded-full blur-[80px] sm:blur-[100px] -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 sm:w-80 sm:h-80 bg-secondary-brown/5 rounded-full blur-[80px] sm:blur-[100px] -ml-32 -mb-32"></div>
            
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative z-10 max-w-2xl mx-auto space-y-6 sm:space-y-8"
            >
              <h2 className="text-4xl sm:text-6xl font-serif text-secondary-brown leading-tight italic">Siap Menemukan <br /> <span className="text-secondary-brown italic">Kedamaian?</span></h2>
              <p className="text-sm sm:text-base text-secondary-brown/70 font-bold max-w-lg mx-auto leading-relaxed uppercase tracking-widest">
                Puluhan destinasi eksotik dan ulasan kurator berpengalaman menanti Anda di dalam platform.
              </p>
              <div>
                <Link to={user ? "/app" : "/login"} className="bg-secondary-brown text-white px-8 sm:px-12 py-3.5 sm:py-4.5 rounded-xl font-bold text-sm sm:text-base hover:scale-105 active:scale-95 transition-all inline-block shadow-md">
                  {user ? "Ayo Eksplor Sekarang" : "Gabung ke Komunitas"}
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Elegant Footer */}
      <footer className="py-16 sm:py-24 border-t border-secondary-brown/10 bg-bg-cream text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-10 space-y-8 sm:space-y-10">
          <Link className="flex items-center justify-center gap-3 group no-underline" to="/">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary-brown text-white rounded-xl flex items-center justify-center font-serif text-lg sm:text-xl border-none">T</div>
            <span className="font-serif text-xl sm:text-2xl tracking-tight text-secondary-brown italic">TemuTempat</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-[10px] sm:text-xs font-bold text-secondary-brown/40 uppercase tracking-[0.3em]">
            <a href="https://www.tiktok.com/@ars1pida_?_r=1&_t=ZS-96XSFfCdCeC" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-brown transition-colors">TikTok</a>
            <a href="https://linktr.ee/rylaa_" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-brown transition-colors">Linktree</a>
            <a href="https://www.instagram.com/syrra.js?igsh=MW5pMWZrcnhwaTFocw==" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-brown transition-colors">Instagram</a>
          </div>
          <p className="text-xs sm:text-sm text-secondary-brown/50 font-light italic">© 2026 TemuTempat. Menemukan keindahan sejati di setiap sudut.</p>
          <p className="text-xs sm:text-sm text-secondary-brown/50 font-light italic">CREATED BY RIFDAH R. AISY</p>
        </div>
      </footer>
    </div>
  );
}