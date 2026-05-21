import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, ArrowLeft, Loader2, Sparkles, ArrowRight, Eye, EyeOff, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { motion } from "motion/react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { AlertCircle, Settings } from "lucide-react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, signInWithGoogle, isLoading: authLoading } = useAuth();
  
  const successMessageFromLocation = location.state?.message;

  const [dbStatus, setDbStatus] = useState<{ checked: boolean; exists: boolean; error?: string }>({ checked: false, exists: false });

  React.useEffect(() => {
    // Only redirect if we have a user and authentication context is NOT loading
    if (user && !authLoading) {
      if (user.role === 'admin' || user.email === 'admin@temutempat.com') {
        navigate("/app/admin", { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  // Check if tables exist
  React.useEffect(() => {
    if (isSupabaseConfigured && !dbStatus.checked) {
      const checkTables = async () => {
        try {
          const { error } = await supabase.from('users').select('id').limit(1);
          if (error) {
            if (error.message.includes('does not exist')) {
              setDbStatus({ checked: true, exists: false, error: "Tabel 'users' tidak ditemukan. Harap jalankan script SQL di Dashboard Supabase." });
            } else {
              setDbStatus({ checked: true, exists: true, error: error.message });
            }
          } else {
            setDbStatus({ checked: true, exists: true });
          }
        } catch (err: any) {
          setDbStatus({ checked: true, exists: false, error: err.message });
        }
      };
      checkTables();
    }
  }, [isSupabaseConfigured, dbStatus.checked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      if (isSignUp) {
        const { error: authError } = await signUp(email, password, username, phone);
        if (authError) {
          setError(authError.message);
        } else {
          setSuccess("Pendaftaran berhasil! Akun Anda sudah siap. Silakan masukkan kembali email dan password untuk masuk.");
          setIsSignUp(false);
          setEmail("");
          setPassword("");
          setUsername("");
          setPhone("");
        }
      } else {
        const { error: authError } = await signIn(email, password);
        if (authError) {
          console.error("LOGIN ERROR:", authError);
          alert("Login Gagal: " + (authError.message || "Unknown error"));
          
          if (authError.message === "Invalid login credentials") {
            setError("Akun tidak ditemukan atau password salah. Jika Anda belum terdaftar, silakan 'Buat Akun Baru' di bawah.");
          } else if (authError.message.toLowerCase().includes("email not confirmed") || authError.message.toLowerCase().includes("confirm your email")) {
            setError("Error: Email belum konfirmasi. Harap matikan 'Confirm email' di Supabase agar bisa login langsung.");
          } else {
            setError(authError.message);
          }
        }
      }
    } catch (err: any) {
      console.error("FAIL-SAFE ERROR CATCH:", err);
      alert("Error: " + (err.message || "Terjadi kesalahan sistem"));
      setError(err.message || "Gagal verifikasi identitas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError("");
      await signInWithGoogle();
    } catch (err: any) {
      const errorMessage = err.message || err.msg || "";
      if (errorMessage.includes("provider is not enabled")) {
        setError("Google Login belum aktif. Aktifkan di Supabase Dashboard (Authentication > Providers > Google).");
      } else if (errorMessage.toLowerCase().includes("redirect_uri_mismatch") || errorMessage.includes("403") || errorMessage.includes("access_denied")) {
        setError("Google 403 / Access Denied. HARAP CEK: 1. Tambahkan email Anda ke 'Test Users' di Google Cloud OAuth Consent Screen. 2. Copy 'Callback URL' dari Supabase Google Provider, lalu PASTE ke 'Authorized redirect URIs' di Google Cloud Credentials (OAuth client ID).");
      } else {
        setError(`Google Sign-In gagal: ${errorMessage || "Unknown error"}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-bg-cream flex font-sans overflow-hidden">
      {/* Left Side - Image Showcase */}
      <div className="hidden lg:block w-7/12 relative bg-secondary-brown overflow-hidden">
        <motion.img 
          key={isSignUp ? 'signup-img' : 'login-img'}
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          src={isSignUp ? "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80" : "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1600&q=80"} 
          alt="Showcase" 
          className="absolute inset-0 w-full h-full object-cover grayscale-[30%]"
        />
        <div className="absolute inset-0 border-[60px] border-white/5 pointer-events-none"></div>
        <div className="absolute top-1/2 left-24 -translate-y-1/2 z-20 text-white max-w-3xl space-y-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 1 }}
          >
            <div className="w-24 h-24 bg-white text-secondary-brown flex items-center justify-center mb-16 shadow-2xl rotate-3 border-none">
              <Sparkles className="animate-pulse" size={48} />
            </div>
            <h1 className="text-8xl lg:text-[9rem] font-serif mb-12 leading-[0.85] tracking-tighter">
               {isSignUp ? "Daftar" : "Kurasi"} <br />
               <span className="italic text-accent-gold">{isSignUp ? "Akun." : "Ketenangan."}</span>
            </h1>
            <p className="text-3xl text-white/70 font-extrabold max-w-xl leading-relaxed uppercase tracking-tighter border-l-4 border-accent-gold pl-12">
               {isSignUp ? "Mulai perjalanan Anda di arsip Temutempat." : "Selamat datang kembali. Masuk untuk mengakses ruang pribadi Anda."}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-5/12 flex items-center justify-center p-12 bg-bg-cream relative overflow-y-auto">
        <div className="w-full max-w-xl py-12">
          <Link to="/" className="inline-flex items-center gap-6 text-secondary-brown/40 hover:text-primary-green transition-all group font-extrabold uppercase tracking-[0.4em] text-[10px] no-underline mb-12">
            <ArrowLeft size={16} className="group-hover:-translate-x-2 transition-transform" /> Kembali Ke Arsip
          </Link>

          <motion.div
            key={isSignUp ? 'signup-form' : 'login-form'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            <div className="space-y-4">
              <h2 className="text-6xl font-serif text-secondary-brown leading-tight tracking-tighter italic">
                {isSignUp ? "Daftar Baru." : "Masuk."}
              </h2>
              <div className="h-2 w-24 bg-accent-gold"></div>
            </div>

            {(success || successMessageFromLocation) && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-green-50 border-l-8 border-green-500 p-6 text-green-700 font-extrabold text-[10px] uppercase tracking-widest"
              >
                {success || successMessageFromLocation}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {!isSupabaseConfigured && (
                <div className="bg-accent-gold/10 border-l-8 border-accent-gold p-8 rounded-r-2xl space-y-4 shadow-sm text-secondary-brown font-medium italic text-xs">
                  Sistem autentikasi belum siap. Harap masukkan URL dan Anon Key di menu Settings.
                </div>
              )}

              {isSupabaseConfigured && dbStatus.checked && !dbStatus.exists && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-50 border-l-8 border-red-500 p-6 text-red-600 font-extrabold text-[10px] uppercase tracking-widest"
                >
                  {dbStatus.error}
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-red-50 border-l-8 border-red-500 p-6 text-red-600 font-extrabold text-xs uppercase tracking-widest relative overflow-hidden"
                >
                  <p>{error}</p>
                  {email === 'admin@temutempat.com' && (
                    <div className="mt-4 p-4 bg-white/50 border border-red-200 rounded-xl">
                      <p className="text-[10px] text-red-800">PETUNJUK ADMIN:</p>
                      <p className="text-[10px] text-red-700 italic lowercase tracking-normal">Sistem akan otomatis mendaftarkan akun admin jika Anda memasukkan email & password yang benar untuk pertama kali. Silakan coba klik 'Masuk' lagi.</p>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="space-y-6">
                {isSignUp && (
                  <>
                    <div className="space-y-4">
                      <label className="block text-[10px] font-extrabold text-secondary-brown/30 uppercase tracking-[0.5em]">Username</label>
                      <div className="relative border-b-2 border-secondary-brown/10 focus-within:border-primary-green transition-all">
                        <UserIcon className="absolute left-0 top-1/2 -translate-y-1/2 text-secondary-brown/20" size={24} />
                        <input 
                          type="text" 
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Nama curator" 
                          className="w-full pl-12 pr-4 py-4 bg-transparent outline-none text-2xl font-serif italic text-secondary-brown border-none placeholder:text-secondary-brown/10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-[10px] font-extrabold text-secondary-brown/30 uppercase tracking-[0.5em]">No. HP</label>
                      <div className="relative border-b-2 border-secondary-brown/10 focus-within:border-primary-green transition-all">
                        <input 
                          type="tel" 
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0812..." 
                          className="w-full pl-0 pr-4 py-4 bg-transparent outline-none text-2xl font-serif text-secondary-brown border-none placeholder:text-secondary-brown/10"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-4">
                  <label className="block text-[10px] font-extrabold text-secondary-brown/30 uppercase tracking-[0.5em]">Alamat Email</label>
                  <div className="relative border-b-2 border-secondary-brown/10 focus-within:border-primary-green transition-all">
                    <Mail className="absolute left-0 top-1/2 -translate-y-1/2 text-secondary-brown/20" size={24} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="curator@temutempat.id" 
                      className="w-full pl-12 pr-4 py-4 bg-transparent outline-none text-2xl font-serif italic text-secondary-brown border-none placeholder:text-secondary-brown/10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-extrabold text-secondary-brown/30 uppercase tracking-[0.5em]">Password</label>
                  <div className="relative border-b-2 border-secondary-brown/10 focus-within:border-primary-green transition-all">
                    <Lock className="absolute left-0 top-1/2 -translate-y-1/2 text-secondary-brown/20" size={24} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-12 py-4 bg-transparent outline-none text-2xl font-serif text-secondary-brown border-none placeholder:text-secondary-brown/10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-secondary-brown/30 hover:text-primary-green bg-transparent border-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading || !isSupabaseConfigured}
                className="group relative w-full py-6 bg-secondary-brown text-white font-extrabold text-xs uppercase tracking-[0.6em] transition-all hover:bg-primary-green shadow-xl disabled:opacity-50 border-none cursor-pointer mt-4"
              >
                <span className="relative z-10 flex items-center justify-center gap-6">
                   {isLoading ? (
                     <><Loader2 className="animate-spin" size={24} /> Memproses...</>
                   ) : (
                     <>{isSignUp ? "Daftar Sekarang" : "Masuk"} <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" /></>
                   )}
                </span>
                <div className="absolute inset-0 bg-accent-gold translate-x-2 translate-y-2 -z-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform"></div>
              </button>

              <div className="pt-8 text-center">
                <p className="text-[10px] font-extrabold text-secondary-brown/30 uppercase tracking-[0.3em] mb-4">
                  {isSignUp ? "Sudah punya akun?" : "Belum punya akun?"}
                </p>
                <button 
                  type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                  setSuccess("");
                  // Clear all fields on toggle
                  setEmail("");
                  setPassword("");
                  setUsername("");
                  setPhone("");
                }}
                  className="text-primary-green hover:text-secondary-brown font-extrabold uppercase tracking-[0.2em] text-[10px] bg-transparent border-none cursor-pointer underline decoration-2 underline-offset-4"
                >
                  {isSignUp ? "Masuk Sekarang" : "Buat Akun Baru"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
