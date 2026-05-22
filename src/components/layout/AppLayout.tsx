import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Map, 
  Users, 
  MessageSquare, 
  PlusCircle, 
  User as UserIcon,
  Bell,
  LogOut,
  Menu,
  X,
  Settings,
  Compass,
  Sparkles,
  ArrowRight,
  Home
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
        setMobileMenuOpen(false); // Close mobile drawer on desktop
      }
    };
    handleResize(); // trigger on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/app", icon: LayoutDashboard },
    { name: "Eksplor", path: "/app/explore", icon: Compass },
    { name: "Profil", path: "/app/profile", icon: UserIcon },
  ];

  const adminItems = [
    { name: "Admin Dashboard", path: "/app/admin", icon: Settings },
    { name: "Kelola User", path: "/app/admin/users", icon: Users },
    { name: "Kelola Tempat", path: "/app/admin/places", icon: Map },
  ];

  return (
    <div className="flex h-screen bg-bg-cream overflow-hidden font-sans relative">
      {/* 1. DESKTOP SIDEBAR - Kept as ultra-slim Dock */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 64 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className={cn(
          "hidden lg:flex h-[calc(100vh-4rem)] my-8 ml-8 bg-white/70 backdrop-blur-3xl border border-secondary-brown/5 rounded-[2.5rem] shadow-[10px_0_40px_-15px_rgba(0,0,0,0.02)] flex-col items-center py-6 z-[100] group transition-all duration-500 overflow-y-auto overflow-x-hidden no-scrollbar w-16 min-w-[64px] max-w-[64px] touch-pan-y",
          !isSidebarOpen && "ml-0 border-none px-0 w-0"
        )}
      >
        {/* Minimalist Brand Symbol */}
        <div className="mb-6">
          <motion.div 
            whileHover={{ rotate: 180, scale: 1.1 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="w-9 h-9 bg-secondary-brown text-white flex items-center justify-center rounded-[1.2rem] shadow-lg cursor-pointer"
            onClick={() => navigate("/app")}
          >
            <Sparkles size={16} />
          </motion.div>
        </div>

        {/* Navigation Symbols */}
        <nav className="flex-1 flex flex-col gap-4 w-full items-center">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/app"}
              className={({ isActive }) =>
                cn(
                  "relative transition-all duration-500 group/nav flex items-center justify-center border-none cursor-pointer p-2.5 rounded-lg",
                  isActive 
                    ? "bg-secondary-brown text-bg-cream shadow-[0_8px_16px_-4px_rgba(93,77,68,0.3)] scale-105" 
                    : "text-secondary-brown/40 hover:bg-secondary-brown/10 hover:text-secondary-brown"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={cn("stroke-[2.5px] transition-colors", isActive ? "text-bg-cream" : "text-secondary-brown/40 group-hover/nav:text-secondary-brown")} />
                  
                  {/* Minimalist Tooltip */}
                  <div className="absolute left-[calc(100%+1.5rem)] bg-secondary-brown text-[#FAF9F6] text-[9px] font-black uppercase tracking-[0.3em] px-3.5 py-2 rounded-xl opacity-0 translate-x-4 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-2xl z-[200]">
                    {item.name}
                  </div>
                </>
              )}
            </NavLink>
          ))}

          {user?.role === "admin" && (
            <div className="w-4 h-px bg-secondary-brown/10 my-1" />
          )}

          {user?.role === "admin" && adminItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "relative transition-all duration-500 group/nav flex items-center justify-center border-none cursor-pointer p-2.5 rounded-lg",
                  isActive 
                    ? "bg-secondary-brown text-bg-cream shadow-[0_8px_16px_-4px_rgba(93,77,68,0.3)] scale-105" 
                    : "text-secondary-brown/40 hover:bg-secondary-brown/10 hover:text-secondary-brown"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={cn("stroke-[2.5px] transition-colors", isActive ? "text-bg-cream" : "text-secondary-brown/40 group-hover/nav:text-secondary-brown")} />
                  <div className="absolute left-[calc(100%+1.5rem)] bg-secondary-brown text-[#FAF9F6] text-[9px] font-black uppercase tracking-[0.3em] px-3.5 py-2 rounded-xl opacity-0 translate-x-4 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-2xl z-[200]">
                    {item.name}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Minimalist Profile / Logout Section */}
        <div className="mt-auto flex flex-col items-center gap-4">
          <button 
             onClick={handleLogout}
             className="w-10 h-10 bg-secondary-brown/5 hover:bg-black hover:text-white text-secondary-brown/40 flex items-center justify-center rounded-xl transition-all duration-300 border-none cursor-pointer group/logout relative"
          >
            <LogOut size={16} className="transition-colors group-hover/logout:text-white" />
            <div className="absolute left-[calc(100%+1.5rem)] bg-black text-[#FAF9F6] text-[9px] font-black uppercase tracking-[0.3em] px-3.5 py-2 rounded-xl opacity-0 translate-x-4 pointer-events-none group-hover/logout:opacity-100 group-hover/logout:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-2xl z-[200]">
              Keluar
            </div>
          </button>
          
          <Link to="/app/profile" className="relative group/profile p-0 border-none focus:outline-none">
            <div className="w-10 h-10 p-0.5 bg-white border border-secondary-brown/5 rounded-[1.2rem] shadow-md hover:border-secondary-brown transition-all duration-500 overflow-hidden">
               <img 
                src={user?.avatar || "https://ui-avatars.com/api/?name=" + user?.name} 
                className="w-full h-full rounded-[1rem] object-cover grayscale hover:grayscale-0 transition-all duration-700" 
                alt="avatar" 
              />
            </div>
            <div className="absolute left-[calc(100%+1.5rem)] bg-white text-secondary-brown border border-secondary-brown/10 p-3 rounded-2xl opacity-0 translate-x-4 pointer-events-none group-hover/profile:opacity-100 group-hover/profile:translate-x-0 transition-all duration-500 shadow-[0_30px_60px_rgba(0,0,0,0.1)] z-[200] w-32">
              <p className="font-serif text-[11px] text-secondary-brown mb-0.5 italic leading-none">{user?.name}</p>
              <p className="text-[5px] font-black uppercase tracking-widest text-secondary-brown/30">{user?.role}</p>
            </div>
          </Link>
        </div>
      </motion.aside>

      {/* 2. MOBILE & TABLET SLIDING OFFCANVAS DRAWER */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black z-[1000]"
            />
            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="lg:hidden fixed top-0 left-0 h-full w-[280px] sm:w-[320px] bg-white z-[1001] shadow-2xl flex flex-col p-6 border-r border-secondary-brown/10 overflow-y-auto overflow-x-hidden no-scrollbar touch-pan-y"
            >
              {/* Header inside drawer */}
              <div className="flex items-center justify-between mb-8 border-b border-secondary-brown/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary-brown text-white rounded-xl flex items-center justify-center font-serif text-lg font-bold">
                    T
                  </div>
                  <div>
                    <h3 className="font-serif text-lg italic text-secondary-brown leading-tight">TemuTempat</h3>
                    <p className="text-[8px] font-extrabold uppercase tracking-widest text-[#FFB6C1]">Kurasi Estetik</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-9 h-9 bg-secondary-brown/5 hover:bg-secondary-brown/10 rounded-full flex items-center justify-center text-secondary-brown border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Links */}
              <div className="flex-1 overflow-y-auto space-y-6">
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/30 pl-3">Navigasi Utama</p>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/app"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border-none text-left w-full",
                          isActive
                            ? "bg-secondary-brown text-bg-cream shadow-md font-semibold"
                            : "text-secondary-brown/60 hover:bg-secondary-brown/5 hover:text-secondary-brown"
                        )
                      }
                    >
                      <item.icon size={18} />
                      {item.name}
                    </NavLink>
                  ))}
                </div>

                {user?.role === "admin" && (
                  <div className="space-y-2 border-t border-secondary-brown/5 pt-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary-brown/30 pl-3">Pengaturan Admin</p>
                    {adminItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border-none text-left w-full",
                            isActive
                              ? "bg-secondary-brown text-white shadow-md font-semibold"
                              : "text-secondary-brown/60 hover:bg-secondary-brown/5 hover:text-secondary-brown"
                          )
                        }
                      >
                        <item.icon size={18} />
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom cluster inside drawer */}
              <div className="border-t border-secondary-brown/5 pt-6 mt-auto space-y-4">
                <div className="flex items-center gap-4 bg-secondary-brown/5 p-3 rounded-2xl border border-secondary-brown/5">
                  <img
                    src={user?.avatar || "https://ui-avatars.com/api/?name=" + user?.name}
                    className="w-10 h-10 rounded-xl object-cover border border-secondary-brown/10"
                    alt="avatar"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-serif text-sm italic text-secondary-brown truncate">{user?.name}</h4>
                    <p className="text-[8px] font-extrabold uppercase tracking-widest text-[#FF1493]">{user?.role}</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border-none cursor-pointer transition-colors"
                >
                  <LogOut size={16} />
                  Keluar Akun
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* MOBILE HEADER BAR - Perfect layout for headers on small viewports */}
        <header className="lg:hidden fixed top-0 left-0 w-full h-16 bg-white/95 backdrop-blur-xl border-b border-secondary-brown/5 z-[90] flex items-center justify-between px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-10 h-10 bg-secondary-brown/5 text-secondary-brown rounded-xl flex items-center justify-center border-none cursor-pointer transition-colors hover:bg-secondary-brown/10"
            >
              <Menu size={18} />
            </button>
            <Link className="flex items-center gap-2 no-underline" to="/app">
              <span className="font-serif text-lg font-black italic text-secondary-brown">TemuTempat</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Minimal Live Dot */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-lg border border-green-100/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </span>
              <span className="text-[6px] font-black uppercase tracking-wider text-green-700/80">LIVE</span>
            </div>

            <Link to="/app/profile" className="w-9 h-9 border border-secondary-brown/10 rounded-xl overflow-hidden shadow-inner block">
              <img
                src={user?.avatar || "https://ui-avatars.com/api/?name=" + user?.name}
                className="w-full h-full object-cover"
                alt="user avatar"
              />
            </Link>
          </div>
        </header>

        {/* FLOATING CONTROLS OVERLAY - REMOVED TO PREVENT OVERLAPPING SIDEBAR BRAND LOGOS */}

        {/* MINIMALIST TOP CONTROLS CONTAINER - DESKTOP ONLY */}
        <div className="hidden lg:fixed top-6 right-8 z-[110] lg:flex items-center gap-3">
          <div className="bg-white/80 backdrop-blur-2xl border border-secondary-brown/10 rounded-2xl p-1.5 flex items-center gap-2 shadow-xl">
            {/* Live Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1 bg-secondary-brown/5 rounded-xl border border-secondary-brown/5">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </div>
              <span className="text-[7px] font-black uppercase tracking-widest text-secondary-brown/40">Sistem Aktif</span>
            </div>
            
            <div className="w-px h-4 bg-secondary-brown/10 mx-1" />
            
            <button className="w-9 h-9 flex items-center justify-center text-secondary-brown/30 hover:text-secondary-brown transition-all bg-transparent border-none cursor-pointer rounded-xl hover:bg-secondary-brown/5">
              <Bell size={16} />
            </button>
            <div className="w-px h-4 bg-secondary-brown/10 mx-1" />
            <button 
              onClick={() => navigate("/app")}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-secondary-brown text-[#FAF9F6] rounded-xl hover:bg-black transition-all shadow-md font-bold text-[8px] tracking-[0.3em] uppercase border-none cursor-pointer group/home"
            >
              <Home size={14} className="group-hover/home:scale-110 transition-transform" />
              <span className="hidden sm:block">Beranda</span>
            </button>
            <button 
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center bg-secondary-brown text-white rounded-xl hover:bg-black transition-all shadow-md border-none cursor-pointer group/logout-top"
              title="Keluar"
            >
              <LogOut size={14} className="group-hover/logout-top:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* 3. MOBILE & TABLET BOTTOM TAB NAVIGATION */}
        <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-2xl border-t border-secondary-brown/10 z-[100] px-4 py-2.5 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.05)] pb-[calc(env(safe-area-inset-bottom)+10px)]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/app" && location.pathname === "/app/");
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center py-1 mt-0.5 relative flex-1 focus:outline-none transition-transform active:scale-95 no-underline"
              >
                <div
                  className={cn(
                    "p-2 rounded-xl transition-all duration-300 relative z-10",
                    isActive 
                      ? "bg-secondary-brown text-bg-cream shadow-sm scale-110" 
                      : "text-secondary-brown/40"
                  )}
                >
                  <item.icon size={18} className={cn("stroke-[2.5px] transition-colors", isActive ? "text-[#FAF9F6]" : "text-secondary-brown/40")} />
                </div>
                <span 
                  className={cn(
                    "text-[8px] font-black uppercase tracking-widest mt-1.5 transition-colors duration-300 relative z-10",
                    isActive ? "text-secondary-brown" : "text-secondary-brown/40"
                  )}
                >
                  {item.name}
                </span>
                
                {/* Visual glow indicator */}
                {isActive && (
                  <motion.div 
                    layoutId="mobileActiveTabGlow"
                    className="absolute bottom-0 w-5 h-[3px] bg-secondary-brown rounded-full"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* CONTENT AREA - Customized padding to prevent overlap with responsive headers & top navigation */}
        <main className="flex-1 overflow-y-auto pt-20 sm:pt-24 lg:pt-32 px-4 sm:px-10 pb-28 lg:pb-16 custom-scrollbar scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
