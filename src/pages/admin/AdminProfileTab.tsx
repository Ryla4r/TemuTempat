import React from "react";
import { Mail, Shield, Clock, UserCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AdminProfileTab() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl">
      <div className="bg-bg-cream rounded-[4rem] border border-bg-deep-brown/5 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-48 bg-gradient-to-br from-secondary-brown via-bg-deep-brown to-bg-deep-brown relative overflow-hidden">
          <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-8 left-10 flex items-center gap-6">
            <div className="relative">
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}`}
                className="w-20 h-20 rounded-[1.5rem] border-4 border-white shadow-2xl object-cover"
                alt="admin"
              />
              <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-secondary-brown rounded-xl flex items-center justify-center shadow-xl border-2 border-white">
                <Shield size={12} className="text-white" />
              </div>
            </div>
            <div className="space-y-1 text-white">
              <h1 className="text-3xl font-serif tracking-tighter leading-none italic">{user?.name}</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50">Administrator</p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-10 space-y-6">
          <div className="flex items-center gap-4 p-5 bg-bg-deep-brown/5 rounded-2xl border border-bg-deep-brown/5">
            <div className="w-10 h-10 bg-secondary-brown/10 rounded-xl flex items-center justify-center">
              <Mail size={18} className="text-secondary-brown" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-bg-deep-brown/30 mb-0.5">Email</p>
              <p className="text-sm font-bold text-bg-deep-brown">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-bg-deep-brown/5 rounded-2xl border border-bg-deep-brown/5">
            <div className="w-10 h-10 bg-secondary-brown/10 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-secondary-brown" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-bg-deep-brown/30 mb-0.5">Role</p>
              <p className="text-sm font-bold text-bg-deep-brown capitalize">{user?.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-bg-deep-brown/5 rounded-2xl border border-bg-deep-brown/5">
            <div className="w-10 h-10 bg-secondary-brown/10 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-secondary-brown" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-bg-deep-brown/30 mb-0.5">Terdaftar Sejak</p>
              <p className="text-sm font-bold text-bg-deep-brown">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}