import React, { useState, useEffect } from "react";
import { 
  Users, 
  Map as MapIcon, 
  Users2, 
  UserCircle,
  TrendingUp,
  LayoutDashboard,
  LogOut,
  Bell,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import UserManagement from "./UserManagement";
import PlaceManagement from "./PlaceManagement"; // We will use this or a new one for Tab 2
import CommunitiesTrending from "./CommunitiesTrending";
import AdminProfileTab from "./AdminProfileTab";
import AdminOverview from "./AdminOverview";

type AdminTab = "overview" | "users" | "places" | "communities" | "profile";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "User Management", icon: Users },
    { id: "places", label: "Map & Place", icon: MapIcon },
    { id: "communities", label: "Communities & Trending", icon: Users2 },
    { id: "profile", label: "Admin Profile", icon: UserCircle },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleTabChange = (tabId: AdminTab) => {
    setActiveTab(tabId);
    setIsMobileSidebarOpen(false);
  };

  // Reusable Sidebar Menu Content
  const sidebarContent = (
    <div className="h-full flex flex-col justify-between py-8 px-6">
      <div className="space-y-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-green rounded-2xl flex items-center justify-center shadow-lg shadow-primary-green/20 flex-shrink-0">
            <LayoutDashboard size={24} className="text-bg-deep-brown" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-bg-cream tracking-tighter leading-none italic uppercase">Admin</h1>
            <p className="text-[10px] font-black text-bg-cream/30 uppercase tracking-[0.3em]">TemuTempat Hub</p>
          </div>
        </div>

        <nav className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as AdminTab)}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-[2rem] transition-all border-none cursor-pointer group relative overflow-hidden text-left ${
                activeTab === tab.id 
                  ? "bg-bg-cream text-bg-deep-brown shadow-2xl font-bold" 
                  : "text-bg-cream/40 hover:text-bg-cream hover:bg-bg-cream/5"
              }`}
            >
              <tab.icon size={20} className={activeTab === tab.id ? "text-primary-green" : "group-hover:text-primary-green transition-colors"} />
              <span className="text-sm font-black uppercase tracking-widest leading-none">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div layoutId="nav-bg" className="absolute left-0 w-1 h-8 bg-primary-green rounded-r-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-12 space-y-6">
        <div className="p-6 bg-bg-cream/5 rounded-[2.5rem] border border-bg-cream/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-shrink-0">
              <img src={user?.avatar || "https://ui-avatars.com/api/?name=Admin"} className="w-12 h-12 rounded-2xl border-2 border-primary-green/20 object-cover" alt="avatar" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-green border-2 border-bg-deep-brown rounded-full"></div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-bg-cream tracking-tight truncate">{user?.name}</p>
              <p className="text-[10px] text-bg-cream/30 font-bold uppercase tracking-widest truncate">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border-none cursor-pointer"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
        <p className="text-[9px] text-bg-cream/20 font-medium text-center uppercase tracking-[0.4em]">v2.4.0 Kolektif Alpha</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen max-h-screen bg-bg-deep-brown flex flex-col lg:flex-row overflow-hidden font-sans relative">
      {/* Mobile Top Header */}
      <header className="lg:hidden bg-bg-deep-brown border-b border-bg-cream/10 px-6 py-4 flex items-center justify-between z-[90] sticky top-0 left-0 w-full flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="w-10 h-10 bg-bg-cream/10 text-bg-cream rounded-xl flex items-center justify-center border-none cursor-pointer hover:bg-bg-cream/20 active:scale-95 transition-transform"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-serif text-bg-cream italic font-bold">Admin Hub</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <img src={user?.avatar || "https://ui-avatars.com/api/?name=Admin"} className="w-8 h-8 rounded-lg border border-primary-green/20 object-cover" alt="avatar" />
        </div>
      </header>

      {/* Sliding Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black z-[1000]"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="lg:hidden fixed top-0 left-0 h-full w-[300px] bg-bg-deep-brown z-[1001] shadow-2xl flex flex-col border-r border-bg-cream/10 overflow-y-auto no-scrollbar"
            >
              <div className="absolute top-6 right-6 z-[1002]">
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="w-9 h-9 bg-bg-cream/10 text-bg-cream hover:bg-bg-cream/20 rounded-full flex items-center justify-center border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Persistent Sidebar Navigation */}
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="hidden lg:flex w-80 bg-bg-deep-brown border-r border-bg-cream/10 flex-col h-full overflow-y-auto shrink-0"
      >
        {sidebarContent}
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 lg:p-12 relative min-w-0">
        {/* Top Floating bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-12">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-accent-gold rounded-full" />
            <h2 className="text-3xl font-serif text-bg-cream tracking-tighter italic lg:text-5xl uppercase">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-4 self-end sm:self-auto">
            <button className="w-10 h-10 sm:w-12 sm:h-12 bg-bg-cream/5 rounded-2xl flex items-center justify-center text-bg-cream/40 hover:text-primary-green hover:bg-bg-cream/10 transition-all border-none cursor-pointer relative">
              <Bell size={20} />
              <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></div>
            </button>
            <div className="flex flex-col items-end">
              <p className="text-[8px] sm:text-[10px] font-black text-bg-cream/20 uppercase tracking-[0.3em]">Sistem Online</p>
              <p className="text-[10px] sm:text-xs font-bold text-primary-green uppercase tracking-tighter italic">Supabase Live Enabled</p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "overview" && <AdminOverview />}
            {activeTab === "users" && <UserManagement />}
            {activeTab === "places" && <PlaceManagement />}
            {activeTab === "communities" && <CommunitiesTrending />}
            {activeTab === "profile" && <AdminProfileTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
