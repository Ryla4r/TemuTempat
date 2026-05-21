import { supabase } from "../lib/supabase";

export const storageService = {
  async uploadMedia(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
    const filePath = `user_posts/${fileName}`;
    
    // Primary bucket name
    const bucketName = 'travel_media';

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);

    if (uploadError) {
      console.warn("Supabase Storage upload failed, attempting internal fallback...", uploadError);
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.url) {
            console.info("Internal fallback successful.");
            return result.url;
          }
        } else {
          console.error(`Internal fallback failed with status ${response.status}`);
        }
      } catch (fallbackErr) {
        console.error("Internal fallback fetch error:", fallbackErr);
      }

      // ULTIMATE FALLBACK: Local Data URI (Ensures the app doesn't crash/block the user)
      console.warn("All remote storage options failed. Using local Data URI as last resort.");
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Gagal memproses file secara lokal."));
        reader.readAsDataURL(file);
      });
    }

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
