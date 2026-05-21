/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { User } from "./types";
import { dataService } from "./services/dataService";

// Components
import AppLayout from "./components/layout/AppLayout";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/app/Dashboard";
import Explore from "./pages/app/Explore";
import PlaceDetails from "./pages/app/PlaceDetails";
import Community from "./pages/app/Community";
import Profile from "./pages/app/Profile";
import GroupChatRoom from "./pages/app/GroupChatRoom";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import PlaceManagement from "./pages/admin/PlaceManagement";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { APIProvider } from "@vis.gl/react-google-maps";

// Global handler for Google Maps authentication failures
if (typeof window !== "undefined") {
  (window as any).gm_authFailure = () => {
    console.error("Google Maps authentication failed.");
    window.dispatchEvent(new CustomEvent("google-maps-auth-failure"));
  };
}

const API_KEY = 
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || 
  (typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_PLATFORM_KEY : "") || 
  "";

if (!API_KEY && typeof window !== "undefined") {
  console.warn("VITE_GOOGLE_MAPS_PLATFORM_KEY is missing. Map will not load.");
}

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-secondary-brown border-t-accent-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === "admin" || user.email === 'admin@temutempat.com';
  
  if (adminOnly && !isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  React.useEffect(() => {
    dataService.init();
  }, []);

  return (
    <AuthProvider>
      <APIProvider apiKey={API_KEY} version="weekly" libraries={["geometry", "routes", "places"]}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="explore" element={<Explore />} />
              <Route path="place/:id" element={<PlaceDetails />} />
              <Route path="community" element={<Community />} />
              <Route path="community/:id/chat" element={<GroupChatRoom />} />
              <Route path="profile" element={<Profile />} />
              
              <Route path="admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
              <Route path="admin/users" element={<ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>} />
              <Route path="admin/places" element={<ProtectedRoute adminOnly><PlaceManagement /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </APIProvider>
    </AuthProvider>
  );
}
