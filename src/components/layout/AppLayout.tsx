import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
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
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/app", icon: LayoutDashboard },
    { name: "Eksplor", path: "/app/explore", icon: Compass },
    { name: "Komunitas", path: "/app/community", icon: MessageSquare },
    { name: "Profil", path: "/app/profile", icon: UserIcon },
  ];

  const adminItems = [
    { name: "Admin Dashboard", path: "/app/admin", icon: Settings },
    { name: "Kelola User", path: "/app/admin/users", icon: Users },
    { name: "Kelola Tempat", path: "/app/admin/places", icon: Map },
  ];

  return (
    <div className="flex h-screen bg-bg-cream overflow-hidden font-sans relative">
      {/* Dynamic Sidebar / Floating Dock - Ultra-slim and Pink theme */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 64 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className={cn(
          "h-[calc(100vh-12rem)] my-24 ml-8 bg-white/70 backdrop-blur-3xl border border-secondary-brown/5 rounded-[2.5rem] shadow-[10px_0_40px_-15px_rgba(0,0,0,0.02)] flex flex-col items-center py-8 z-[100] relative group transition-all duration-700 overflow-hidden",
          !isSidebarOpen && "ml-0 border-none px-0"
        )}
      >
        {/* Minimalist Brand Symbol */}
        <div className="mb-10">
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
        <nav className="flex-1 flex flex-col gap-5 w-full items-center">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/app"}
              className={({ isActive }) =>
                cn(
                  "relative transition-all duration-500 group/nav flex items-center justify-center border-none cursor-pointer",
                  isActive 
                    ? "p-1.5 rounded-lg bg-[#FFB6C1] text-white shadow-[0_8px_16px_-4px_rgba(255,182,193,0.4)]" 
                    : "p-2.5 text-secondary-brown/20 hover:bg-secondary-brown/5 hover:text-secondary-brown"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={16} className={cn("stroke-[2.5px] transition-colors", isActive ? "text-white" : "text-secondary-brown/40 group-hover/nav:text-secondary-brown")} />
                  
                  {/* Minimalist Tooltip */}
                  <div className="absolute left-[calc(100%+1.5rem)] bg-secondary-brown text-white text-[7px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-xl opacity-0 translate-x-4 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-x-0 transition-all duration-500 whitespace-nowrap shadow-2xl z-[200]">
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
                  "relative transition-all duration-500 group/nav flex items-center justify-center border-none cursor-pointer",
                  isActive 
                    ? "p-1.5 rounded-lg bg-[#FFB6C1] text-white shadow-md" 
                    : "p-2.5 text-secondary-brown/20 hover:bg-secondary-brown/5 hover:text-secondary-brown"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={16} className={cn("stroke-[2.5px] transition-colors", isActive ? "text-white" : "text-secondary-brown/40 group-hover/nav:text-secondary-brown")} />
                  <div className="absolute left-[calc(100%+1.5rem)] bg-secondary-brown text-white text-[7px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-xl opacity-0 translate-x-4 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-x-0 transition-all duration-500 whitespace-nowrap shadow-2xl z-[200]">
                    {item.name}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Minimalist Profile / Logout Section */}
        <div className="mt-auto flex flex-col items-center gap-5">
          <button 
             onClick={handleLogout}
             className="w-8 h-8 bg-secondary-brown/5 hover:bg-black hover:text-white text-secondary-brown/20 flex items-center justify-center rounded-lg transition-all duration-500 border-none cursor-pointer group/logout relative"
          >
            <LogOut size={14} className="transition-colors group-hover/logout:text-white" />
            <div className="absolute left-[calc(100%+1.5rem)] bg-black text-white text-[7px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-xl opacity-0 translate-x-4 pointer-events-none group-hover/logout:opacity-100 group-hover/logout:translate-x-0 transition-all duration-500 whitespace-nowrap shadow-2xl z-[200]">
              Keluar
            </div>
          </button>
          
          <Link to="/app/profile" className="relative group/profile p-0 border-none focus:outline-none">
            <div className="w-9 h-9 p-0.5 bg-white border border-secondary-brown/5 rounded-[1.2rem] shadow-md hover:border-[#FFB6C1] transition-all duration-500 overflow-hidden">
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Floating Controls Overlay */}
        <div className="absolute top-6 left-8 z-50 flex items-center gap-4">
           {!isSidebarOpen && (
             <motion.button 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               onClick={() => setSidebarOpen(true)}
               className="w-10 h-10 bg-white text-secondary-brown rounded-xl shadow-lg hover:bg-secondary-brown hover:text-white transition-all border-none cursor-pointer flex items-center justify-center p-0"
             >
               <Menu size={16} />
             </motion.button>
           )}
           {isSidebarOpen && (
             <button 
               onClick={() => setSidebarOpen(false)}
               className="w-10 h-10 bg-white/20 backdrop-blur-md text-secondary-brown/40 hover:text-secondary-brown rounded-xl transition-all border-none cursor-pointer flex items-center justify-center p-0"
             >
               <X size={16} />
             </button>
           )}
        </div>

        {/* Minimalist Top Controls Container */}
        <div className="fixed top-6 right-8 z-[110] flex items-center gap-3">
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
              className="flex items-center gap-2.5 px-4 py-2.5 bg-[#FFB6C1] text-white rounded-xl hover:bg-black transition-all shadow-md font-bold text-[8px] tracking-[0.3em] uppercase border-none cursor-pointer group/home"
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

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto pt-32 px-10 pb-16 custom-scrollbar scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
