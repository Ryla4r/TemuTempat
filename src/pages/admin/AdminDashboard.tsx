import React, { useState } from "react";
import { Users, Star, UserCircle, LogOut, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import UserManagement from "./UserManagement";
import AdminProfileTab from "./AdminProfileTab";
import AdminReviewsTab from "./Adminreviewstab";

type AdminTab = "users" | "reviews" | "profile";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const tabs = [
    { id: "users",   label: "Manajemen Akun", icon: Users },
    { id: "reviews", label: "Ulasan Platform", icon: Star },
    { id: "profile", label: "Profil Admin",    icon: UserCircle },
  ];

  const handleLogout = () => { logout(); navigate("/login"); };
  const handleTabChange = (tabId: AdminTab) => {
    setActiveTab(tabId);
    setIsMobileSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between py-8 px-6">
      <div className="space-y-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-secondary-brown rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-white font-serif text-xl font-bold">T</span>
          </div>
          <div>
            <h1 className="text-2xl font-serif text-bg-cream tracking-tighter leading-none italic">Admin</h1>
            <p className="text-[10px] font-black text-bg-cream/30 uppercase tracking-[0.3em]">TemuTempat</p>
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
              <tab.icon size={20} className={activeTab === tab.id ? "text-secondary-brown" : "group-hover:text-bg-cream/80 transition-colors"} />
              <span className="text-sm font-black uppercase tracking-widest leading-none">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div layoutId="admin-nav-indicator" className="absolute left-0 w-1 h-8 bg-secondary-brown rounded-r-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-12 space-y-6">
        <div className="p-6 bg-bg-cream/5 rounded-[2.5rem] border border-bg-cream/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-shrink-0">
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}`}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-secondary-brown/30"
                alt="avatar"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-bg-deep-brown rounded-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-bg-cream tracking-tight truncate">{user?.name}</p>
              <p className="text-[10px] text-secondary-brown font-bold uppercase tracking-widest">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border-none cursor-pointer"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen max-h-screen bg-bg-deep-brown flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* Mobile Header */}
      <header className="lg:hidden bg-bg-deep-brown border-b border-bg-cream/10 px-6 py-4 flex items-center justify-between sticky top-0 z-[90] w-full flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="w-10 h-10 bg-bg-cream/10 text-bg-cream rounded-xl flex items-center justify-center border-none cursor-pointer"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-xl font-serif text-bg-cream italic font-bold">Admin</h1>
        </div>
        <img
          src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}`}
          className="w-8 h-8 rounded-lg object-cover"
          alt="avatar"
        />
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black z-[1000]"
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="lg:hidden fixed top-0 left-0 h-full w-[300px] bg-bg-deep-brown z-[1001] shadow-2xl border-r border-bg-cream/10 overflow-y-auto"
            >
              <div className="absolute top-6 right-6 z-[1002]">
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="w-9 h-9 bg-bg-cream/10 text-bg-cream rounded-full flex items-center justify-center border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className="hidden lg:flex w-80 bg-bg-deep-brown border-r border-bg-cream/10 flex-col h-full overflow-y-auto shrink-0"
      >
        {sidebarContent}
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 min-w-0">
        <div className="flex items-center gap-4 mb-8 sm:mb-12">
          <div className="w-1.5 h-8 bg-secondary-brown rounded-full" />
          <h2 className="text-3xl font-serif text-bg-cream tracking-tighter italic lg:text-5xl uppercase">
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "users"   && <UserManagement />}
            {activeTab === "reviews" && <AdminReviewsTab />}
            {activeTab === "profile" && <AdminProfileTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}