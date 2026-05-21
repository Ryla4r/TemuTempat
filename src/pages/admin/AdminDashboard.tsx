import React, { useState, useEffect } from "react";
import { 
  Users, 
  Map as MapIcon, 
  Users2, 
  UserCircle,
  TrendingUp,
  LayoutDashboard,
  LogOut,
  Bell
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

  return (
    <div className="min-h-screen bg-bg-deep-brown flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-full lg:w-80 bg-bg-deep-brown border-r border-bg-cream/10 p-8 flex flex-col justify-between z-50 overflow-y-auto"
      >
        <div className="space-y-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-green rounded-2xl flex items-center justify-center shadow-lg shadow-primary-green/20">
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
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`w-full flex items-center gap-4 px-6 py-5 rounded-[2rem] transition-all border-none cursor-pointer group relative overflow-hidden ${
                  activeTab === tab.id 
                    ? "bg-bg-cream text-bg-deep-brown shadow-2xl" 
                    : "text-bg-cream/40 hover:text-bg-cream hover:bg-bg-cream/5"
                }`}
              >
                <tab.icon size={20} className={activeTab === tab.id ? "text-primary-green" : "group-hover:text-primary-green transition-colors"} />
                <span className="text-sm font-black uppercase tracking-widest">{tab.label}</span>
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
              <div className="relative">
                <img src={user?.avatar} className="w-12 h-12 rounded-2xl border-2 border-primary-green/20" alt="avatar" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-green border-2 border-bg-deep-brown rounded-full"></div>
              </div>
              <div className="min-w-0">
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
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-12 relative">
        {/* Top Floating bar */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-accent-gold rounded-full" />
            <h2 className="text-3xl font-serif text-bg-cream tracking-tighter italic lg:text-5xl uppercase">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="w-12 h-12 bg-bg-cream/5 rounded-2xl flex items-center justify-center text-bg-cream/40 hover:text-primary-green hover:bg-bg-cream/10 transition-all border-none cursor-pointer relative">
              <Bell size={20} />
              <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></div>
            </button>
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-[10px] font-black text-bg-cream/20 uppercase tracking-[0.3em]">Sistem Online</p>
              <p className="text-xs font-bold text-primary-green uppercase tracking-tighter italic">Supabase Connected</p>
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
