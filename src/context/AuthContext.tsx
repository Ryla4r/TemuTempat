import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Role } from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  updateUser: (newUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Check active sessions and sets the user
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
          await fetchProfile(session.user.id, session.user.email || "");
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Supabase session error:", err);
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for changes on auth state
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Event: ${event}`);
      setSession(session);
      
      if (session) {
        const isAdmin = session.user.email === 'admin@temutempat.com' || session.user.user_metadata?.role === 'admin';
        fetchProfile(session.user.id, session.user.email || "", isAdmin);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string, email: string, isAdminFromToken?: boolean) => {
    try {
      // Don't re-fetch if we already have the user and it's the right one
      // unless we want to force refresh. For now, let's allow it as onAuthStateChange might trigger it.
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setUser({
          id: data.id,
          email: data.email,
          name: data.name,
          role: (data.role || (isAdminFromToken ? 'admin' : 'user')) as Role,
          phone: data.phone,
          avatar: data.avatar,
          bio: data.bio,
          createdAt: data.created_at || data.createdAt,
        });
      } else {
        // Profile doesn't exist yet
        const role = isAdminFromToken || email === 'admin@temutempat.com' ? 'admin' : 'user';
        const now = new Date().toISOString();
        const newUser: User = {
          id: userId,
          email: email,
          name: email.split('@')[0],
          role: role as Role,
          createdAt: now,
        };
        
        // Try to create it
        const { error: insertError } = await supabase
          .from('users')
          .insert([newUser]);
          
        if (insertError) {
          console.warn("Could not insert user profile (likely RLS), setting locally:", insertError.message);
        }
        setUser(newUser);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const redirectTo = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setIsLoading(false);
      console.error("Google login error:", err);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("SUPABASE AUTH ERROR:", signInError);
        // UX Improvement: Auto-register admin if it doesn't exist yet
        if (signInError.message === "Invalid login credentials" && email === 'admin@temutempat.com') {
          console.log("Admin account not found in Auth. Attempting auto-registration...");
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (signUpError) {
            alert("Registrasi Admin Gagal: " + signUpError.message);
            return { error: signUpError };
          }
          
          if (signUpData.user) {
            return await supabase.auth.signInWithPassword({ email, password });
          }
        }
        return { error: signInError };
      }

      return { error: null };
    } catch (err: any) {
      console.error("SUPABASE AUTH EXCEPTION:", err);
      alert("Terjadi kesalahan sistem: " + (err.message || "Unknown error"));
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) return { error: authError };

    if (authData.user) {
      const role = email === 'admin@temutempat.com' ? 'admin' : 'user';
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email,
            name,
            phone,
            role: role,
          },
        ]);

      if (profileError) return { error: profileError };

      // Force logout after signup so user has to log in manually as requested
      await supabase.auth.signOut();
    }

    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updateUser = async (newUser: User) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: newUser.name,
          bio: newUser.bio,
          avatar: newUser.avatar,
          phone: newUser.phone,
        })
        .eq('id', newUser.id);

      if (error) throw error;
      setUser(newUser);
    } catch (err) {
      console.error("Gagal update profil:", err);
      // Still update local state for UI responsiveness
      setUser(newUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signInWithGoogle, signIn, signUp, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
