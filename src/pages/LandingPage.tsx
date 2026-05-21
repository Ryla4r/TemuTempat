import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, MapPin, Sparkles, ShieldCheck, Zap, Star } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";

import { feedbackService, SiteReview } from "../services/feedbackService";
import { dataService } from "../services/dataService";
import { Review } from "../types";

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [featuredPlaces, setFeaturedPlaces] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(4.8);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [places, posts, ratingAvg, siteRatings] = await Promise.all([
          dataService.getPlaces(),
          dataService.getPosts(),
          dataService.getAverageWebsiteRating(),
          dataService.getWebsiteRatings()
        ]);
        
        setFeaturedPlaces(places.slice(0, 4));
        setCommunityPosts(posts.slice(0, 6));
        setAverageRating(ratingAvg || 4.8);
        setReviews(siteRatings.map((r: any) => ({
          id: r.id,
          userName: r.users?.name || 'Explorer',
          rating: r.rating,
          comment: r.review_text,
          date: r.created_at
        })));
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

    return () => {
      // Listener removal handled by garbage collection or explicit removal if using dataService.subscribe
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-cream selection:bg-accent-gold selection:text-secondary-brown font-sans overflow-x-hidden text-secondary-brown">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full bg-bg-cream/80 backdrop-blur-xl border-b border-secondary-brown/10 px-10 py-5 z-50 flex items-center justify-between shadow-sm">
        <Link className="flex items-center gap-4 group no-underline hover:no-underline focus:no-underline focus:outline-none" to="/">
          <div className="w-12 h-12 bg-accent-gold rounded-xl text-white flex items-center justify-center font-serif text-2xl shadow-lg transform group-hover:rotate-6 transition-transform">T</div>
          <span className="font-serif text-5xl tracking-tight text-secondary-brown italic">TemuTempat</span>
        </Link>
        <div className="flex gap-6">
          {user ? (
            <Link to="/app" className="bg-[#FFB6C1] text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl no-underline hover:no-underline focus:no-underline focus:outline-none">
              Explore
            </Link>
          ) : (
            <Link to="/login" className="bg-secondary-brown text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl no-underline hover:no-underline focus:no-underline focus:outline-none">
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-60 pb-32 px-10 bg-bg-cream">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7 space-y-12">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="inline-flex items-center gap-4 px-6 py-2 bg-accent-gold/20 text-secondary-brown rounded-full text-[10px] font-extrabold uppercase tracking-[0.3em] mb-10 border border-accent-gold/10">
                  <Zap size={14} fill="currentColor" /> Live Community Feed
                </div>
                <h1 className="text-7xl lg:text-[10rem] font-serif text-secondary-brown mb-10 leading-[0.85] tracking-tight">
                  Escape the <br />
                  <span className="text-accent-gold italic">Ordinary.</span>
                </h1>
                <p className="text-2xl text-secondary-brown/80 font-medium leading-relaxed max-w-xl border-l-4 border-accent-gold pl-8 italic">
                  Temukan permata artistik tersembunyi dan tempat perlindungan yang belum tersentuh oleh hiruk-pikuk kota. Dipandu oleh AI, dikurasi dengan jiwa.
                </p>
                <div className="flex gap-6 pt-10">
                  <Link to={user ? "/app" : "/login"} className="group relative bg-secondary-brown text-white px-12 py-6 rounded-none font-extrabold text-xl transition-all hover:bg-black shadow-2xl no-underline hover:no-underline focus:no-underline focus:outline-none">
                    <span className="relative z-10 flex items-center gap-4">{user ? "Ayo Eksplor" : "Start Curating"} <ArrowRight size={24} /></span>
                    <div className="absolute inset-0 bg-accent-gold translate-x-2 translate-y-2 -z-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform"></div>
                  </Link>
                </div>
              </motion.div>
            </div>
            
            <div className="lg:col-span-5 relative mt-20 lg:mt-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="relative z-10"
              >
                <div className="aspect-[4/5] overflow-hidden bg-white p-4 shadow-[-40px_40px_100px_-20px_rgba(0,0,0,0.1)]">
                  <img 
                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80" 
                    alt="Sanctuary" 
                    className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-1000"
                  />
                </div>
                
                <motion.div
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-12 -left-12 bg-white p-10 text-secondary-brown shadow-2xl max-w-xs border border-secondary-brown/5"
                >
                  <p className="font-serif text-3xl mb-6 italic leading-tight">"Tempat berlindung bagi mereka yang mencari keindahan puitis."</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-40">— Sang Kurator</p>
                </motion.div>
              </motion.div>

              
              {/* Abstract Accents */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-accent-gold/10 rounded-full blur-[120px]"></div>
              <div className="absolute top-1/2 -left-20 w-64 h-64 bg-primary-green/5 rounded-full blur-[100px]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Voice Section (Moved to top area) */}
      <section className="py-40 bg-bg-cream relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-accent-gold/5 -skew-x-12 translate-x-20"></div>
        <div className="max-w-7xl mx-auto px-10 relative z-10">
          <div className="flex flex-col lg:flex-row items-end justify-between gap-12 mb-24">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 text-accent-gold font-extrabold uppercase tracking-[0.4em] text-[10px]">
                <Star size={14} className="fill-accent-gold" /> Art of Discovery
              </div>
              <h2 className="text-6xl md:text-8xl font-serif text-secondary-brown leading-[0.85] tracking-tighter">
                Galeri <br />
                <span className="italic text-accent-gold opacity-90">Hidden Gems.</span>
              </h2>
            </div>
            <p className="text-xl text-secondary-brown/40 max-w-sm font-medium italic border-l-2 border-accent-gold pl-6">
              "Sebuah ekosistem digital untuk para penikmat sunyi dan pemburu estetik."
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {communityPosts.length > 0 ? communityPosts.map((post, idx) => (
              <motion.div
                key={post.id || idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group relative h-[500px] rounded-[3rem] overflow-hidden shadow-2xl bg-white border border-secondary-brown/5"
              >
                {post.media_url?.toLowerCase().match(/\.(mp4|webm|ogg)$/) ? (
                  <video src={post.media_url} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-[2s]" autoPlay muted loop />
                ) : (
                  <img src={post.media_url} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-[2s]" alt="discovery" />
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-10 text-white">
                  <p className="font-serif text-2xl italic mb-4 line-clamp-2">"{post.caption}"</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{post.username}</span>
                    <Link to="/login" className="px-5 py-2 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black text-white hover:bg-white hover:text-secondary-brown transition-colors uppercase tracking-[0.2em] no-underline">Lihat Detail</Link>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-secondary-brown/5">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary-brown/20 italic">Gelombang belum merekam jejak hari ini...</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Website Ratings & Testimonials (Refined Layout) */}
      <section className="py-40 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-24 gap-12 text-center md:text-left border-b border-secondary-brown/5 pb-16">
            <div className="space-y-4">
               <div className="inline-flex items-center gap-3 text-secondary-brown/40 font-extrabold uppercase tracking-[0.4em] text-[9px]">
                <ShieldCheck size={12} className="opacity-30" /> Verified Impressions
              </div>
              <h2 className="text-5xl md:text-7xl font-serif text-secondary-brown leading-none tracking-tighter italic">
                Diskusi Kolektif.
              </h2>
            </div>
            
            <div className="flex flex-col md:items-end gap-1">
              <div className="flex items-center justify-center md:justify-end gap-5">
                <span className="text-6xl md:text-8xl font-serif text-accent-gold leading-none italic">{averageRating.toFixed(1)}</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} size={14} className="fill-accent-gold text-accent-gold opacity-50" />)}
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary-brown/20 md:text-right">
                Global Score Berdasarkan {reviews.length} Kurator
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {reviews.length > 0 ? reviews.map((review, idx) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-bg-cream/40 p-12 rounded-[4rem] border border-secondary-brown/5 flex flex-col justify-between group hover:bg-white hover:shadow-2xl transition-all duration-700 h-full border-b-[6px] border-b-primary-green/20"
              >
                <div className="space-y-10">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        size={14} 
                        className={star <= review.rating ? "text-accent-gold fill-accent-gold" : "text-secondary-brown/10"} 
                      />
                    ))}
                  </div>
                  <p className="text-2xl font-serif text-secondary-brown leading-relaxed italic pr-4">
                    "{review.comment}"
                  </p>
                </div>
                <div className="mt-12 pt-10 border-t border-secondary-brown/10 flex items-center gap-5">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center font-serif text-secondary-brown text-2xl shadow-xl border border-secondary-brown/5 group-hover:bg-primary-green group-hover:text-white transition-colors duration-500 uppercase">
                    {review.userName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-secondary-brown uppercase tracking-[0.2em]">{review.userName}</h4>
                    <p className="text-[9px] font-bold text-primary-green uppercase tracking-widest mt-1">Verified Member</p>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="lg:col-span-3 text-center py-20 bg-bg-cream/20 rounded-[3rem]">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary-brown/20 italic">Belum ada suara kolektif yang terekam...</p>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* Featured Places Section (Moved to Bottom) */}
      <section className="py-40 bg-bg-cream/20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-10">
          <div className="flex flex-col items-center mb-24 text-center">
            <h2 className="text-6xl md:text-7xl font-serif text-secondary-brown mb-6 italic tracking-tight">
              Eksplorasi <span className="text-accent-gold">Terpilih.</span>
            </h2>
            <p className="text-lg text-secondary-brown/60 max-w-xl font-medium uppercase tracking-widest leading-loose">
              Beberapa destinasi paling inspiratif yang baru saja ditambahkan oleh komunitas kami.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredPlaces.map((place, idx) => (
              <motion.div
                key={place.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group cursor-pointer"
                onClick={() => navigate(user ? `/app/place/${place.id}` : "/login")}
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-xl mb-6">
                  <img src={place.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700 grayscale-[20%] group-hover:grayscale-0" alt={place.name} />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-secondary-brown shadow-sm">
                    {place.category}
                  </div>
                </div>
                <h3 className="font-serif text-2xl text-secondary-brown italic group-hover:text-accent-gold transition-colors">{place.name}</h3>
                <div className="flex items-center gap-2 mt-2 opacity-40">
                  <MapPin size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{place.location}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* Premium CTA */}
      <section className="py-24 mb-20 bg-white">
        <div className="max-w-7xl mx-auto px-10">
          <div className="bg-bg-deep-brown rounded-[3rem] p-16 md:p-24 text-center relative overflow-hidden shadow-2xl border border-accent-gold/10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent-gold/10 rounded-full blur-[100px] -mr-48 -mt-48"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/30 rounded-full blur-[100px] -ml-40 -mb-40"></div>
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative z-10"
            >
              <h2 className="text-5xl md:text-7xl font-serif text-secondary-brown mb-8 leading-tight italic">Ready for <br /> <span className="text-accent-gold">Serenity?</span></h2>
              <p className="text-xl text-secondary-brown/70 font-black mb-12 max-w-2xl mx-auto leading-relaxed pr-4 uppercase tracking-tighter">
                Ribuan sudut estetik menanti untuk ditemukan. Bergabunglah sekarang dan jadilah bagian dari kurasi visual terbaik di Indonesia.
              </p>
              <Link to={user ? "/app" : "/login"} className="bg-secondary-brown text-white px-12 py-5 rounded-2xl font-black text-xl hover:scale-110 active:scale-95 transition-all inline-block shadow-xl no-underline hover:no-underline focus:no-underline focus:outline-none">
                {user ? "Ayo Eksplor" : "Join the Collective"}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Elegant Footer */}
      <footer className="py-24 border-t border-secondary-brown/10 bg-bg-cream text-center">
        <div className="max-w-7xl mx-auto px-10 space-y-10">
          <Link className="flex items-center justify-center gap-4 group no-underline hover:no-underline focus:no-underline focus:outline-none" to="/">
            <div className="w-10 h-10 bg-accent-gold rounded-xl text-white flex items-center justify-center font-serif text-xl border-none">T</div>
            <span className="font-serif text-2xl tracking-tight text-secondary-brown italic">TemuTempat</span>
          </Link>
          <div className="flex justify-center gap-10 text-xs font-bold text-secondary-brown/30 uppercase tracking-[0.4em]">
            <a href="#" className="hover:text-accent-gold transition-colors no-underline">Privasi</a>
            <a href="#" className="hover:text-accent-gold transition-colors no-underline">Ketentuan</a>
            <a href="#" className="hover:text-accent-gold transition-colors no-underline">Instagram</a>
          </div>
          <p className="text-lg text-secondary-brown/40 font-light italic">© 2026 TemuTempat. Menemukan kesunyian di tengah kebisingan.</p>
        </div>
      </footer>
    </div>
  );
}
