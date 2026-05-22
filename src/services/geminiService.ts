import { Place } from "../types";

const MOCK_RECOMMENDATIONS = {
  recommendations: [
    {
      id: "ai-new-m-bloc-space",
      name: "m Bloc Space",
      description: "Creative hub di jantung Melawai yang menempati bekas perumahan Perum Peruri. Tempat nongkrong lintas generasi dengan vibe retro.",
      insight: "Pusat budaya populer Jakarta dengan deretan cafe dan toko rilisan fisik yang estetik.",
      category: ["Creative Hub", "Cafe"],
      address: "Melawai, Jakarta Selatan",
      latitude: -6.244,
      longitude: 106.802,
      imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800",
      priceLevel: 2,
      openingHours: "10:00 - 22:00"
    },
    {
      id: "ai-new-urban-forest",
      name: "Urban Forest Cipete",
      description: "Oasis hijau di Jakarta Selatan dengan area outdoor yang luas dan deretan tenant kuliner premium.",
      insight: "Tempat terbaik untuk 'healing' tipis-tipis di tengah kota tanpa harus keluar Jakarta.",
      category: ["Park", "Lifestyle"],
      address: "Cipete, Jakarta Selatan",
      latitude: -6.271,
      longitude: 106.806,
      imageUrl: "https://images.unsplash.com/photo-1582142306909-195724d33927?auto=format&fit=crop&q=80&w=800",
      priceLevel: 3,
      openingHours: "07:00 - 21:00"
    }
  ],
  summaryTitle: "Kurasi Kolektif Terpilih"
};

export const geminiService = {
  async getPlaceRecommendations(userInput: string, places: Place[]) {
    try {
      const response = await fetch("/api/gemini/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput, places }),
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Received HTML instead of JSON from /api/gemini/recommendations");
      }
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("QUOTA_EXHAUSTED");
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      if (error.message === "QUOTA_EXHAUSTED") throw error;
      console.error("Gemini recommendation error:", error);
      return MOCK_RECOMMENDATIONS;
    }
  },

  async getSearchKeywords(userInput: string) {
    try {
      const response = await fetch("/api/gemini/search-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput }),
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Received HTML instead of JSON from /api/gemini/search-keywords");
      }
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("QUOTA_EXHAUSTED");
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      if (error.message === "QUOTA_EXHAUSTED") throw error;
      console.error("Gemini search keywords error:", error);
      return { 
        query: userInput, 
        tags: userInput.split(' ').filter(v => v.length > 3).map(v => v.charAt(0).toUpperCase() + v.slice(1)) 
      };
    }
  },

  async getPlaceEnrichment(placeName: string) {
    try {
      const response = await fetch("/api/gemini/enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeName }),
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Received HTML instead of JSON from /api/gemini/enrichment");
      }
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("QUOTA_EXHAUSTED");
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      if (error.message === "QUOTA_EXHAUSTED") throw error;
      console.error("Gemini enrichment error:", error);
      return {
        description: `Sebuah tempat menarik di Indonesia yang patut dikunjungi untuk ${placeName}.`,
        categories: ["Lokal", "Populer"],
        priceLevel: 2
      };
    }
  },

  async bulkDiscover(city: string, vibe: string) {
    try {
      const response = await fetch("/api/gemini/bulk-discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, vibe }),
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Received HTML instead of JSON from /api/gemini/bulk-discover");
      }
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("QUOTA_EXHAUSTED");
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      if (error.message === "QUOTA_EXHAUSTED") throw error;
      console.error("Gemini bulk discover error:", error);
      return { places: MOCK_RECOMMENDATIONS.recommendations.map(({insight, id, ...rest}) => ({ id, ...rest })) };
    }
  },

  async getNearbyTrending(cityName: string, coords: { lat: number, lng: number }, existingPlaces: Place[]) {
    try {
      const response = await fetch("/api/gemini/nearby-trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityName, coords, existingPlaces }),
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Received HTML instead of JSON from /api/gemini/nearby-trending");
      }
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("QUOTA_EXHAUSTED");
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      if (error.message === "QUOTA_EXHAUSTED") throw error;
      console.error("Gemini nearby trending error:", error);
      return MOCK_RECOMMENDATIONS;
    }
  }
};
