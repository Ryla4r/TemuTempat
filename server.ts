import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import fileUpload from "express-fileupload";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { createServer as createHttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ 
  apiKey: geminiApiKey || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// AI Cache and Fallback Helper
const aiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours for static-ish info

async function getAIResponse(cacheKey: string, prompt: string, instruction: string, schema: any, modelToUse = "gemini-2.0-flash") {
  const cached = aiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[AI Cache] Hit for: ${cacheKey}`);
    return cached.data;
  }

  const models = [
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-3.1-pro-preview"
  ];
  let currentModelIndex = models.indexOf(modelToUse);
  if (currentModelIndex === -1) currentModelIndex = 0;

  let lastError: any = null;

  for (let i = 0; i < models.length; i++) {
    // Try in order of priority
    const activeModel = models[i];
    try {
      console.log(`[AI Request] Trying model: ${activeModel}`);
      
      // Add a tiny delay if we hit a previous error to avoid rate limits
      if (lastError) await new Promise(r => setTimeout(r, 1000));

      const response = await ai.models.generateContent({
        model: activeModel,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: instruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.1,
        }
      });

      const text = response.text;

      if (!text) throw new Error("Empty response from AI");

      const parsed = JSON.parse(text);
      aiCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
      return parsed;
    } catch (error: any) {
      lastError = error;
      const errorMsg = (error.message || "").toLowerCase();
      const code = error.status || error.error?.code || 500;
      
      console.warn(`[AI Error] ${activeModel} failed with ${code}: ${errorMsg.slice(0, 100)}...`);
      
      const isQuota = code === 429 || errorMsg.includes("429") || errorMsg.includes("resource_exhausted") || errorMsg.includes("quota");
      const isNotFound = code === 404 || errorMsg.includes("404") || errorMsg.includes("not found");
      
      if (isQuota || isNotFound || errorMsg.includes("not supported")) {
        continue;
      }
      
      if (error instanceof SyntaxError) continue;
      
      // For other errors, still try next model
      continue;
    }
  }

  // If all models failed with quota, throw a specific error that the frontend can handle
  if (lastError && (lastError.status === 429 || lastError.message?.includes("429") || lastError.message?.includes("quota"))) {
    const quotaErr: any = new Error("Sistem AI sedang mencapai batas penggunaan gratis. Kami menggunakan data kurasi lokal untuk Anda.");
    quotaErr.status = 429;
    throw quotaErr;
  }

  throw lastError || new Error("All AI models failed");
}

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    console.warn("WARNING: SUPABASE_URL or SUPABASE_KEY missing in environment.");
    // Create a dummy client to avoid crashes, but API calls will fail with a clear error
    const dummyPromise = (data: any = null) => {
      const p = Promise.resolve({ data, error: { message: "Supabase not configured" } }) as any;
      p.eq = () => p;
      p.select = () => p;
      p.single = () => p;
      p.order = () => p;
      p.limit = () => p;
      p.insert = () => p;
      p.upsert = () => p;
      p.update = () => p;
      p.delete = () => p;
      p.channel = () => ({ on: () => ({ subscribe: () => ({}) }) });
      return p;
    };

    supabase = {
      from: () => dummyPromise([]),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      }
    };
  }
} catch (err) {
  console.error("CRITICAL: Failed to initialize Supabase client:", err);
  supabase = { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ error: err }) }) }) }) };
}

// Helper to convert frontend camelCase to backend snake_case
const toSnakeCase = (obj: any) => {
  const result: any = {};
  const mapping: Record<string, string> = {
    imageUrl: "image_url",
    priceLevel: "price_level",
    addedBy: "added_by",
    isFeatured: "is_featured",
    isVerified: "is_verified",
    createdAt: "created_at",
    placeId: "place_id",
    userId: "user_id",
    userName: "user_name",
    userAvatar: "user_avatar",
    mediaUrl: "media_url",
    lastSeenAt: "last_seen_at",
    isOnline: "is_online"
  };
  
  Object.keys(obj).forEach(key => {
    const newKey = mapping[key] || key;
    result[newKey] = obj[key];
  });
  return result;
};

// Initial Data for Seeding
const initialPlaces = [
  {
    id: "00000000-0000-0000-0000-000000000011",
    name: "Kopi Hutan Pinus",
    description: "Kedai kopi tersembunyi di tengah hutan pinus dengan suasana yang sangat tenang dan udara segar. Cocok untuk healing.",
    category: ["sepi", "aesthetic", "outdoor"],
    address: "Jl. Hutan No. 12, Bandung",
    image_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop",
    rating: 4.8,
    latitude: -6.8329,
    longitude: 107.6168,
    price_level: 2,
    added_by: "00000000-0000-0000-0000-000000000000",
    created_at: "2024-01-10T10:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    name: "Perpustakaan Kuno Kota",
    description: "Perpustakaan tua dengan koleksi buku langka. Sangat sepi dan memiliki eksterior bergaya kolonial yang estetik.",
    category: ["sepi", "murah", "indoor"],
    address: "Jl. Merdeka No. 5, Yogyakarta",
    image_url: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=600&fit=crop",
    rating: 4.6,
    latitude: -7.7956,
    longitude: 110.3695,
    price_level: 1,
    added_by: "00000000-0000-0000-0000-000000000000",
    created_at: "2024-02-15T14:30:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000013",
    name: "Taman Suropati",
    description: "Taman rindang di pusat Jakarta yang sangat tenang di pagi hari. Cocok untuk lari pagi atau membaca buku.",
    category: ["sepi", "outdoor", "murah"],
    address: "Jl. Taman Suropati No.5, Menteng, Jakarta Pusat",
    image_url: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?w=800&h=600&fit=crop",
    rating: 4.7,
    latitude: -6.1994,
    longitude: 106.8326,
    price_level: 1,
    added_by: "00000000-0000-0000-0000-000000000000",
    created_at: "2024-03-01T08:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000014",
    name: "Kopi Nako Bogor",
    description: "Kedai kopi ikonik di Bogor dengan desain rumah kaca yang sangat aesthetic. Menawarkan berbagai varian kopi nusantara.",
    category: ["aesthetic", "outdoor", "ramai"],
    address: "Jl. Pajajaran Indah V No.7, Bogor",
    image_url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=600&fit=crop",
    rating: 4.5,
    latitude: -6.6052,
    longitude: 106.8080,
    price_level: 2,
    added_by: "00000000-0000-0000-0000-000000000000",
    created_at: "2024-03-10T10:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000015",
    name: "Kopi Nako Pondok Jati",
    description: "Cabang Kopi Nako dengan konsep industrial yang luas. Cocok untuk kumpul bersama teman atau nugas santai.",
    category: ["aesthetic", "outdoor", "nugas"],
    address: "Jl. Pondok Jati, Jakarta Timur",
    image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop",
    rating: 4.4,
    latitude: -6.2300,
    longitude: 106.9100,
    price_level: 2,
    added_by: "00000000-0000-0000-0000-000000000000",
    created_at: "2024-03-12T10:00:00Z",
  }
];

async function seedDatabase() {
  try {
    // 1. Ensure a System/Visitor user exists to avoid FK violations
    const systemUserId = "00000000-0000-0000-0000-000000000000";
    const { data: existingSystemUser } = await supabase.from("users").select("id").eq("id", systemUserId).single();
    
    if (!existingSystemUser) {
      console.log("Creating mandatory system user for database integrity...");
      await supabase.from("users").insert([{
        id: systemUserId,
        email: "system@temutempat.id",
        name: "Arsiparis Pusat",
        role: "admin",
        avatar: "https://api.dicebear.com/7.x/initials/svg?seed=Arsiparis",
        is_online: false
      }]);
    }

    // 2. Seed Places if empty
    const { count: placeCount } = await supabase.from("places").select("*", { count: "exact", head: true });
    if (placeCount === 0) {
      console.log("Seeding initial places...");
      await supabase.from("places").insert(initialPlaces);
    }

    // 3. Seed Trending Hashtags if empty
    const { count: hashCount } = await supabase.from("trending_hashtags").select("*", { count: "exact", head: true });
    if (hashCount === 0) {
      console.log("Seeding initial trending hashtags...");
      await supabase.from("trending_hashtags").insert([
        { name: "CoffeeHealing", updates_count: 124 },
        { name: "HiddenGemJakarta", updates_count: 89 },
        { name: "QuietLuxury", updates_count: 56 },
        { name: "IndustrialOasis", updates_count: 42 }
      ]);
    }

    // 4. Seed Communities if empty
    const { count: groupCount } = await supabase.from("communities").select("*", { count: "exact", head: true });
    if (groupCount === 0) {
      console.log("Seeding initial communities...");
      await supabase.from("communities").insert([
        { 
          name: "Penjelajah Senja", 
          description: "Kolektif pencari tempat syahdu saat matahari terbenam.", 
          member_count: 12,
          image_url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&h=600&fit=crop"
        },
        { 
          name: "Quiet Library Society", 
          description: "Komunitas pecinta ruang baca dan ketenangan absolut.", 
          member_count: 8,
          image_url: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=600&fit=crop"
        }
      ]);
    }
  } catch (err) {
    console.error("Critical seeding failure:", err);
  }
}

async function startServer() {
  console.log("Starting server...");
  
  // Storage Bucket Initialization
  if (supabaseUrl && supabaseKey) {
    try {
      console.log("Checking storage buckets...");
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.warn("Could not list buckets (maybe insufficient permissions):", listError.message);
      } else {
        const hasBucket = buckets?.some((b: any) => b.name === 'travel_media');
        if (!hasBucket) {
          console.log("Bucket 'travel_media' not found. Trying to create or verify...");
          const { error: createError } = await supabase.storage.createBucket('travel_media', {
            public: true,
            allowedMimeTypes: ['image/*', 'video/*'],
            fileSizeLimit: 10485760 // 10MB
          });
          
          if (createError) {
            console.info("Bucket auto-creation skipped or handled by policy:", createError.message);
            console.log("INFO: App is fully operational using automatic server data-fallback for media storage.");
          } else {
            console.log("Successfully created bucket 'travel_media'");
          }
        } else {
          console.log("Bucket 'travel_media' verified.");
        }
      }
    } catch (err) {
      console.warn("Storage auto-init skipped due to error:", err);
    }
  }

  // Initial seeding to ensure base data exists
  try {
    await seedDatabase();
  } catch (err) {
    console.error("Initial seeding failed, continuing anyway:", err);
  }

  const app = express();
  
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    abortOnLimit: true
  }));

  // Basic middlewares first
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Request logging for diagnostics
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
  
  app.post("/api/gemini/nearby-trending", async (req, res) => {
    try {
      const { cityName, coords, existingPlaces } = req.body || {};
      
      if (!cityName || !coords) {
        return res.status(400).json({ error: "Missing required fields: cityName or coords" });
      }
      
      if (!geminiApiKey) {
        return res.status(503).json({ error: "Gemini API key is not configured" });
      }

      const cacheKey = `nearby_${cityName}_${Math.round(coords.lat * 10)}_${Math.round(coords.lng * 10)}`;
      const instruction = "You are a local travel scout. Suggest 4 REAL hidden gems in Indonesia. Be very concise in descriptions (max 10 words). Insight field should be 2-3 impact words.";
      const schema = {
        type: Type.OBJECT,
        properties: {
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                insight: { type: Type.STRING },
                category: { type: Type.ARRAY, items: { type: Type.STRING } },
                address: { type: Type.STRING },
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER },
                imageUrl: { type: Type.STRING },
                priceLevel: { type: Type.NUMBER }
              },
              required: ["id", "name", "description", "insight", "address", "latitude", "longitude", "imageUrl"]
            }
          },
          summaryTitle: { type: Type.STRING }
        },
        required: ["recommendations", "summaryTitle"]
      };

      const placesContext = (Array.isArray(existingPlaces) ? existingPlaces : []).slice(0, 30).map((p: any) => ({
        name: p.name,
        category: p.category,
        address: p.address
      }));

      const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const prompt = `User in ${cityName} (${coords.lat}, ${coords.lng}). Time: ${currentTime}.
      Suggest 4 unique REAL-WORLD trending spots in Indonesia near this specific district. 
      Focus on "Hidden Gems". 
      Context: ${JSON.stringify(placesContext)}`;

      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        // Fallback for Quota or Error
        console.warn("AI Nearby failed, using fallback:", aiErr.message);
        res.json({
          recommendations: initialPlaces.slice(0, 4).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            insight: "Lokal Klasik",
            category: p.category,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
            imageUrl: p.image_url,
            priceLevel: p.price_level
          })),
          summaryTitle: "Destinasi Klasik untuk Anda"
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/recommendations", async (req, res) => {
    try {
      const { userInput, places } = req.body || {};
      
      if (!userInput) {
        return res.status(400).json({ error: "Missing required field: userInput" });
      }

      if (!geminiApiKey) {
        return res.status(503).json({ error: "Gemini API key is not configured" });
      }

      const cacheKey = `rec_${userInput.toLowerCase().trim().replace(/\s+/g, '_')}`;
      const instruction = "You are an expert travel scout. Suggest real places in Indonesia. If suggesting a NEW place, provide full details (name, address, lat/lng, etc). Jangan pernah menyebutkan AI atau kecerdasan buatan. Tulis seolah-olah Anda adalah seorang kurator manusia yang berpengalaman.";
      const schema = {
        type: Type.OBJECT,
        properties: {
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                insight: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.ARRAY, items: { type: Type.STRING } },
                address: { type: Type.STRING },
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER },
                imageUrl: { type: Type.STRING },
                priceLevel: { type: Type.NUMBER }
              },
              required: ["id", "insight"]
            }
          },
          summaryTitle: { type: Type.STRING }
        },
        required: ["recommendations", "summaryTitle"]
      };

      const placesContext = (Array.isArray(places) ? places : []).slice(0, 50).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        rating: p.rating,
        addedBy: p.addedBy
      }));

      const prompt = `Analyze the user request: "${userInput}".
      Current local time: ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.
      
      TASK:
      1. Review the provided list of local places for matches.
      2. If not enough matches, SUGGEST real-world places in Indonesia that fit the request perfectly.
      3. CRITICAL: Only suggest places that are likely to be OPEN or RELEVANT at this current hour.
      
      For suggested places NOT in the list, use ID: "ai-new-[slug]".
      For existing places, use their original ID.
      
      Available local places: ${JSON.stringify(placesContext)}`;

      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        console.warn("AI Recommendations failed, using local search:", aiErr.message);
        // Local Filter Fallback
        const filtered = (Array.isArray(places) ? places : []).filter(p => 
          p.name.toLowerCase().includes(userInput.toLowerCase()) || 
          p.category?.some((c: string) => c.toLowerCase().includes(userInput.toLowerCase()))
        ).slice(0, 5);

        res.json({
          recommendations: filtered.length > 0 ? filtered.map(p => ({
            id: p.id,
            name: p.name,
            insight: "Hasil Pencarian Lokal",
            description: p.description,
            category: p.category,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
            imageUrl: p.imageUrl,
            priceLevel: p.priceLevel
          })) : initialPlaces.slice(0, 3).map(p => ({
            id: p.id,
            name: p.name,
            insight: "Pilihan Populer",
            description: p.description,
            category: p.category,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
            imageUrl: p.image_url,
            priceLevel: p.price_level
          })),
          summaryTitle: filtered.length > 0 ? `Menampilkan hasil untuk "${userInput}"` : "Rekomendasi Terpopuler"
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/search-keywords", async (req, res) => {
    try {
      const { userInput } = req.body || {};
      if (!userInput) return res.status(400).json({ error: "userInput is required" });

      if (!geminiApiKey) {
        return res.status(503).json({ error: "Gemini API key is not configured" });
      }

      const cacheKey = `keywords_${userInput.toLowerCase().trim().replace(/\s+/g, '_')}`;
      const instruction = "You are a local search expert. Your job is to turn vibe-based requests into searchable terms for maps.";
      const schema = {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "The optimized search string" },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Categories like Cafe, Park, etc" }
        },
        required: ["query", "tags"]
      };

      const prompt = `Convert the user's vague place request into a clean search query for Google Maps and a list of tags.
      User request: "${userInput}"
      
      Example: "taman sepi buat bengong" -> query: "quiet park garden", tags: ["Park", "Nature"]`;

      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        console.warn("AI Keywords failed, using fallback");
        res.json({
          query: userInput,
          tags: ["Umum", "Eksplorasi"]
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/enrichment", async (req, res) => {
    try {
      const { placeName } = req.body || {};
      if (!placeName) return res.status(400).json({ error: "placeName is required" });

      if (!geminiApiKey) {
        return res.status(503).json({ error: "Gemini API key is not configured" });
      }

      const cacheKey = `enrich_${placeName.toLowerCase().trim().replace(/\s+/g, '_')}`;
      const instruction = "You are an expert travel writer for high-end aesthetic magazines. Your writing is evocative, sensory, and Indonesian-native. Do not mention AI in your output.";
      const schema = {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          categories: { type: Type.ARRAY, items: { type: Type.STRING } },
          priceLevel: { type: Type.NUMBER, description: "1-4" },
          openingHours: { type: Type.STRING },
          jamRamai: { type: Type.STRING },
          waktuTerbaik: { type: Type.STRING }
        },
        required: ["description", "categories", "priceLevel", "openingHours", "jamRamai", "waktuTerbaik"]
      };

      const prompt = `Generate a compelling, aesthetic description, 5-7 relevant tags, and visiting time insights for a place named: "${placeName}".
      Context: The place is located in Indonesia. 
      Style: Use a "poetic travel curator" tone. Make it sound like a "must-visit" hidden gem.
      Language: Indonesian.
      
      The description should be 2-3 sentences max, capturing the vibe and soul of the place.
      The categories should be descriptive (e.g., "Senja Syahdu", "Vintage Vibes", "Industrial Minimalist", "Deep Conversation").
      
      Provide specific timing insights:
      - openingHours: Operational hours in "HH:MM - HH:MM" format. Be realistic! Not every place opens 08:00-22:00. Coffee shops usually 07:00-20:00, bars 16:00-01:00, etc.
      - jamRamai: When the place is most crowded (e.g., "19:00 - 21:00").
      - waktuTerbaik: Your recommendation for the absolute best time to enjoy the atmosphere (e.g., "07:00 pagi saat udara masih publik").`;

      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        console.warn("AI Enrichment failed, using fallback");
        res.json({
          description: `Temukan keindahan tersembunyi di ${placeName}. Tempat yang menawarkan ketenangan dan atmosfer yang unik untuk setiap pengunjungnya.`,
          categories: ["Eksplorasi", "Lokal", "Populer"],
          priceLevel: 2,
          openingHours: "09:00 - 21:00",
          jamRamai: "16:00 - 18:00",
          waktuTerbaik: "Sore hari saat matahari terbenam"
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/bulk-discover", async (req, res) => {
    try {
      const { city, vibe } = req.body || {};
      if (!city) return res.status(400).json({ error: "city is required" });

      if (!geminiApiKey) {
        return res.status(503).json({ error: "Gemini API key is not configured" });
      }

      const cacheKey = `bulk_${city.toLowerCase()}_${(vibe || 'general').toLowerCase().replace(/\s+/g, '_')}`;
      const instruction = "You are a travel scout. Suggest REAL places in Indonesia. Provide precise Lat/Lng and aesthetic descriptions in Indonesian.";
      const schema = {
        type: Type.OBJECT,
        properties: {
          places: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                address: { type: Type.STRING },
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER },
                category: { type: Type.ARRAY, items: { type: Type.STRING } },
                imageUrl: { type: Type.STRING },
                priceLevel: { type: Type.NUMBER }
              },
              required: ["name", "description", "address", "latitude", "longitude", "category", "imageUrl", "priceLevel"]
            }
          }
        },
        required: ["places"]
      };

      const prompt = `Find 10 real-world amazing hidden gems in ${city}, Indonesia that fit the vibe: "${vibe}".
      Provide full details for each place so they can be added to a community map.`;

      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        console.warn("AI Bulk Discover failed, using fallback");
        res.json({
          places: initialPlaces.map(p => ({
            name: p.name,
            description: p.description,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
            category: p.category,
            imageUrl: p.image_url,
            priceLevel: p.price_level
          }))
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  app.post("/api/upload", async (req, res) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: "Tidak ada file yang diunggah." });
      }
      
      const file = req.files.file as any;
      
      // For images and videos, we can use Data URI as a ultra-safe fallback 
      // in ephemeral containers while explaining how to set up real storage.
      const dataUri = `data:${file.mimetype};base64,${file.data.toString("base64")}`;
      
      // If the file is too large for Data URI (vaguely 2MB limit for some DBs/APIs), 
      // we should warn, but for now we return it.
      if (file.size > 2 * 1024 * 1024) {
        console.warn(`File heavy detected (${(file.size/1024/1024).toFixed(2)}MB). Data URI might be slow.`);
      }

      res.json({ url: dataUri });
    } catch (err: any) {
      console.error("Internal upload storage error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Health check endpoint for diagnostic
  app.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createHttpServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: "*" }
  });
  const PORT = 3000;

  // Real-time synchronization helper
  const notifyAll = (table: string, eventType: string, data: any, oldData?: any) => {
    try {
      if (table === 'community_groups') table = 'communities';
      if (table === 'group_messages') table = 'messages';
      io.emit("change", { table, eventType, new: data, old: oldData });
    } catch (e) {
      console.error("Socket emit failed:", e);
    }
  };

  // BROAD BRIDGE: Listen to Supabase Realtime and broadcast to Socket.io
  if (supabaseUrl && supabaseKey) {
    console.log("Setting up Supabase Realtime Bridge...");
    supabase
      .channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
        console.log(`[Supabase Realtime] ${payload.table} ${payload.eventType}`);
        // De-duplicate: If the change was already emitted by our API routes, 
        // the client's de-duplication logic (by ID) will handle it, 
        // but we broadcast here to catch direct DB changes too.
        notifyAll(payload.table, payload.eventType, payload.new, payload.old);
      })
      .subscribe();
  }

  io.on("connection", (socket) => {
    socket.on("user_online", async (userId) => {
      socket.data.userId = userId;
      await supabase.from("users").update({ is_online: true, last_seen_at: new Date().toISOString() }).eq("id", userId);
      const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
      if (user) notifyAll("users", "UPDATE", user);
    });

    socket.on("disconnect", async () => {
      const userId = socket.data.userId;
      if (userId) {
        await supabase.from("users").update({ is_online: false, last_seen_at: new Date().toISOString() }).eq("id", userId);
        const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
        if (user) notifyAll("users", "UPDATE", user);
      }
    });
  });

  // API Routes
  app.get("/api/users", async (req, res) => {
    const { data: users, error } = await supabase.from("users").select("*").order("last_seen_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(users);
  });

  app.post("/api/users/delete", async (req, res) => {
    const { id } = req.body;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("users", "DELETE", { id });
    res.json({ success: true });
  });

  app.put("/api/users/:id", async (req, res) => {
    const updates = toSnakeCase(req.body);
    const { data: updated, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("users", "UPDATE", updated);
    res.json(updated);
  });

  app.post("/api/login", async (req, res) => {
    const { email, name, avatar } = req.body;
    
    // Test Supabase connection
    if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
      return res.status(500).json({ 
        error: "Supabase belum dikonfigurasi.", 
        hint: "Silakan masukkan SUPABASE_URL dan SUPABASE_KEY di platform settings." 
      });
    }

    try {
      let { data: user, error } = await supabase.from("users").select("*").eq("email", email).single();
      
      // Handle the case where the table might not exist
      if (error && (error.code === 'PGRST116' || error.message.includes('does not exist'))) {
        if (error.message.includes('does not exist')) {
          return res.status(500).json({ 
            error: "Tabel 'users' tidak ditemukan di database.",
            hint: "Buka 'supabase_schema.sql' dan jalankan isinya di SQL Editor Supabase Anda.",
            details: error
          });
        }
        // single() returning error but no data usually means not found for that specific query
        // we'll proceed to create the user
      } else if (error) {
        return res.status(500).json({ error: error.message, details: error });
      }
      
      if (!user) {
        const id = crypto.randomUUID();
        const defaultName = name || email.split("@")[0];
        const defaultAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${defaultName}`;
        
        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert([{ id, email, name: defaultName, role: "user", avatar: defaultAvatar, last_seen_at: new Date().toISOString(), is_online: false }])
          .select()
          .single();
        
        if (insertError) {
          console.error("Login Insert Error:", insertError);
          return res.status(500).json({ 
            error: "Gagal membuat pengguna baru.", 
            hint: insertError.message.includes("row-level security") 
              ? "RLS menghalangi pendaftaran. Jalankan policy di 'supabase_schema.sql'." 
              : insertError.message,
            details: insertError 
          });
        }
        user = newUser;
        notifyAll("users", "INSERT", user);
      } else {
        const { data: updatedUser, error: updateError } = await supabase
          .from("users")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", user.id)
          .select()
          .single();
        
        if (updateError) {
           console.error("Login Update Error:", updateError);
        }
        user = updatedUser || user;
        notifyAll("users", "UPDATE", user);
      }
      res.json(user);
    } catch (err: any) {
      console.error("Critical Login Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/seed", async (req, res) => {
     try {
       const { count } = await supabase.from("places").select("*", { count: "exact", head: true });
       if (count && count > 0) {
         return res.status(400).json({ error: "Database sudah berisi data." });
       }
       
       const { error } = await supabase.from("places").insert(initialPlaces);
       if (error) throw error;
       
       initialPlaces.forEach(p => notifyAll("places", "INSERT", p));
       res.json({ success: true, message: "Berhasil menambahkan data awal." });
     } catch (err: any) {
       res.status(500).json({ error: err.message });
     }
  });

  app.get("/api/places", async (req, res) => {
    const { data: places, error } = await supabase.from("places").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(places);
  });

  app.get("/api/places/:id", async (req, res) => {
    const { data: place, error } = await supabase.from("places").select("*").eq("id", req.params.id).single();
    if (error) return res.status(404).json({ error: "Place not found" });
    res.json(place);
  });

  app.get("/api/admin/stats", async (req, res) => {
    // Basic stats simulation with Supabase
    const { data: places } = await supabase.from("places").select("name, category, created_at");
    const { data: reviews } = await supabase.from("reviews").select("id, created_at");

    // Aggregate stats in code for simplicity
    const categoryCounts: Record<string, number> = {};
    places?.forEach(p => {
      const cat = p.category?.[0] || "Lainnya";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const recentActions = [
      ...(places?.map(p => ({ type: "place", title: p.name, createdAt: p.created_at })) || []),
      ...(reviews?.map(r => ({ type: "review", title: "Review Baru", createdAt: r.created_at })) || [])
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    res.json({
      activity: [], // Could be calculated from created_at
      categories: Object.entries(categoryCounts).map(([name, value]) => ({ name, value })),
      recentActions
    });
  });

  app.post("/api/admin/feature-place", async (req, res) => {
    const { id, isFeatured } = req.body;
    const { data: updated, error } = await supabase.from("places").update({ is_featured: isFeatured }).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("places", "UPDATE", updated);
    res.json({ success: true });
  });

  app.post("/api/admin/verify-place", async (req, res) => {
    const { id, isVerified } = req.body;
    const { data: updated, error } = await supabase.from("places").update({ is_verified: isVerified }).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("places", "UPDATE", updated);
    res.json({ success: true });
  });

  app.post("/api/places", async (req, res) => {
    try {
      const { name, description, address, imageUrl, category, latitude, longitude, priceLevel, addedBy } = req.body;
      
      // Safety check for table existence
      const { error: tableCheck } = await supabase.from("places").select("id").limit(1);
      if (tableCheck && tableCheck.message.includes("does not exist")) {
        return res.status(500).json({
          error: "Tabel 'places' tidak ditemukan.",
          hint: "Pastikan Anda sudah menjalankan SQL di 'supabase_schema.sql' di SQL Editor Supabase Anda."
        });
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      
      console.log(`Inserting place: ${name}, addedBy: ${addedBy}`);
      
      // Ensure addedBy is a valid UUID in the users table
      let finalAddedBy = addedBy;
      const systemId = "00000000-0000-0000-0000-000000000000";
      
      // Check if the provided ID is a valid UUID and exists
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(addedBy));
      let userRecordFound = false;

      if (isUUID && addedBy !== systemId) {
        const { data: userExists } = await supabase.from("users").select("id").eq("id", addedBy).single();
        if (userExists) userRecordFound = true;
      }

      // If provided user not found or invalid, use system user
      if (!userRecordFound) {
        const { data: systemUser } = await supabase.from("users").select("id").eq("id", systemId).single();
        if (systemUser) {
          finalAddedBy = systemId;
          userRecordFound = true;
        } else {
          // Attempt to create system user on-the-fly if missing
          const { error: createErr } = await supabase.from("users").insert([{
            id: systemId,
            email: "system@temutempat.id",
            name: "Arsiparis Pusat",
            role: "admin",
            avatar: "https://api.dicebear.com/7.x/initials/svg?seed=Arsiparis"
          }]);
          
          if (!createErr) {
            finalAddedBy = systemId;
            userRecordFound = true;
          } else {
            // Last resort: find ANY user
            const { data: firstUser } = await supabase.from("users").select("id").limit(1).single();
            if (firstUser) {
              finalAddedBy = firstUser.id;
              userRecordFound = true;
            } else {
              // If NO users at all, set to null to avoid FK violation if the DB allows it
              finalAddedBy = null;
            }
          }
        }
      }

      // If we still didn't find or create a user, it means the table might be empty and RLS is active.
      // We proceed, but the FK error check in the error handler will catch it and give a better hint.

      const { data: result, error } = await supabase
        .from("places")
        .insert([{ 
          id, 
          name, 
          description, 
          category, 
          address, 
          image_url: imageUrl, 
          rating: 0, 
          latitude: parseFloat(String(latitude)) || 0, 
          longitude: parseFloat(String(longitude)) || 0, 
          price_level: parseInt(String(priceLevel)) || 1, 
          added_by: finalAddedBy, 
          created_at: createdAt 
        }])
        .select()
        .single();

      if (error) {
        console.error("SUPABASE ERROR:", error);
        
        const isRLS = error.message?.toLowerCase().includes("row-level security") || error.code === '42501';
        const isFK = error.code === '23503';
        
        let hint = isRLS 
          ? "PENTING: RLS di Supabase aktif tapi policy INSERT ditolak. Jalankan perintah SQL di 'supabase_schema.sql' atau matikan RLS untuk tabel 'places' sementara (ALTER TABLE places DISABLE ROW LEVEL SECURITY;)." 
          : `Gagal menyimpan ke Supabase: ${error.message || 'Unknown error'}.`;

        if (isFK) {
          hint = "Error Integritas Data (FK Violation): User penambah tidak ditemukan di tabel 'users'. Pastikan Anda sudah menjalankan SQL pendaftaran user di Supabase.";
        }
        
        return res.status(500).json({ 
          error: error.message, 
          code: error.code,
          hint,
          sqlFix: isRLS ? "ALTER TABLE places DISABLE ROW LEVEL SECURITY;" : null,
          details: error 
        });
      }

      if (!result) {
        // Fallback if single() returns null but no error
        const { data: fallback } = await supabase.from("places").select("*").eq("id", id).single();
        if (fallback) {
          notifyAll("places", "INSERT", fallback);
          return res.json(fallback);
        }
        return res.status(500).json({ error: "Failed to retrieve inserted record" });
      }

      notifyAll("places", "INSERT", result);
      res.json(result);
    } catch (err: any) {
      console.error("Critical error in POST /api/places:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/places/:id", async (req, res) => {
    const updates = toSnakeCase(req.body);
    const { data: updated, error } = await supabase.from("places").update(updates).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("places", "UPDATE", updated);
    res.json(updated);
  });

  app.patch("/api/places/:id", async (req, res) => {
    const updates = toSnakeCase(req.body);
    const { data: updated, error } = await supabase.from("places").update(updates).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("places", "UPDATE", updated);
    res.json(updated);
  });

  app.delete("/api/places/:id", async (req, res) => {
    const { error } = await supabase.from("places").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("places", "DELETE", { id: req.params.id });
    res.json({ success: true });
  });

  app.get("/api/reviews", async (req, res) => {
    const { placeId } = req.query;
    let query = supabase.from("reviews").select("*").order("created_at", { ascending: false });
    if (placeId) query = query.eq("place_id", placeId);
    
    const { data: reviews, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(reviews);
  });

  app.post("/api/reviews", async (req, res) => {
    const { placeId, userId, userName, userAvatar, rating, comment, mediaUrl, hashtags } = req.body;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    const { data: result, error: insertError } = await supabase
      .from("reviews")
      .insert([{ id, place_id: placeId, user_id: userId, user_name: userName, user_avatar: userAvatar, rating, comment, likes: 0, replies: [], media_url: mediaUrl, hashtags, created_at: createdAt }])
      .select()
      .single();

    if (insertError) return res.status(500).json({ error: insertError.message });

    // Update place average rating
    const { data: reviews } = await supabase.from("reviews").select("rating").eq("place_id", placeId);
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      const { data: updatedPlace } = await supabase.from("places").update({ rating: avg }).eq("id", placeId).select().single();
      if (updatedPlace) notifyAll("places", "UPDATE", updatedPlace);
    }

    notifyAll("reviews", "INSERT", result);
    res.json(result);
  });

  app.delete("/api/reviews/:id", async (req, res) => {
    const { data: review } = await supabase.from("reviews").select("place_id").eq("id", req.params.id).single();
    if (review) {
      const placeId = review.place_id;
      await supabase.from("reviews").delete().eq("id", req.params.id);
      
      const { data: reviews } = await supabase.from("reviews").select("rating").eq("place_id", placeId);
      const avg = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
      const { data: updatedPlace } = await supabase.from("places").update({ rating: avg }).eq("id", placeId).select().single();
      
      notifyAll("reviews", "DELETE", { id: req.params.id });
      if (updatedPlace) notifyAll("places", "UPDATE", updatedPlace);
    }
    res.json({ success: true });
  });

  app.get("/api/bookmarks/:userId", async (req, res) => {
    const { data: bookmarks, error } = await supabase.from("bookmarks").select("place_id").eq("user_id", req.params.userId);
    if (error) return res.status(500).json({ error: error.message });
    res.json((bookmarks || []).map((b: any) => b.place_id));
  });

  app.post("/api/bookmarks", async (req, res) => {
    const { userId, placeId } = req.body;
    const { data: result, error } = await supabase.from("bookmarks").insert([{ user_id: userId, place_id: placeId }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("bookmarks", "INSERT", { userId, placeId });
    res.json({ success: true, data: result });
  });

  app.delete("/api/bookmarks", async (req, res) => {
    const { userId, placeId } = req.body;
    const { error } = await supabase.from("bookmarks").delete().match({ user_id: userId, place_id: placeId });
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("bookmarks", "DELETE", { userId, placeId });
    res.json({ success: true });
  });

  app.get("/api/hashtags", async (req, res) => {
    const { data: hashtags, error } = await supabase.from("trending_hashtags").select("*").order("updates_count", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(hashtags);
  });

  // Community Groups API
  app.get("/api/groups", async (req, res) => {
    const { data: groups, error } = await supabase.from("communities").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(groups);
  });

  app.get("/api/groups/:id/members", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select("joined_at, users(*)")
        .eq("community_id", req.params.id);
      
      if (error) throw error;
      
      // Flatten the result
      const members = data.map((m: any) => ({
        ...m.users,
        joinedAt: m.joined_at
      }));
      
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      
      const groupId = req.params.id;
      
      const { data: existing } = await supabase
        .from("group_members")
        .select("*")
        .eq("community_id", groupId)
        .eq("user_id", userId)
        .single();
        
      if (existing) {
        return res.json({ success: true, message: "Already a member" });
      }
      
      const { error: joinError } = await supabase
        .from("group_members")
        .insert([{ community_id: groupId, user_id: userId }]);
        
      if (joinError) throw joinError;
      
      // Update member count
      const { data: group } = await supabase
        .from("communities")
        .select("member_count")
        .eq("id", groupId)
        .single();
        
      const newCount = (group?.member_count || 0) + 1;
      await supabase
        .from("communities")
        .update({ member_count: newCount })
        .eq("id", groupId);
        
      notifyAll("group_members", "INSERT", { groupId, userId });
      notifyAll("communities", "UPDATE", { id: groupId, member_count: newCount });
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/groups/:id/messages", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, created_at, user_id, users(name, avatar)")
        .eq("community_id", req.params.id)
        .order("created_at", { ascending: true });
        
      if (error) throw error;
      
      const messages = data.map((m: any) => ({
        id: m.id,
        content: m.content,
        createdAt: m.created_at,
        userId: m.user_id,
        userName: m.users?.name,
        userAvatar: m.users?.avatar
      }));
      
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/groups/:id/messages", async (req, res) => {
    try {
      const { userId, content } = req.body;
      const groupId = req.params.id;
      
      const { data: newMessage, error } = await supabase
        .from("messages")
        .insert([{ 
          community_id: groupId, 
          user_id: userId, 
          content 
        }])
        .select("id, content, created_at, user_id, users(name, avatar)")
        .single();
        
      if (error) throw error;
      
      const mapped = {
        id: newMessage.id,
        groupId,
        content: newMessage.content,
        createdAt: newMessage.created_at,
        userId: newMessage.user_id,
        userName: newMessage.users?.name,
        userAvatar: newMessage.users?.avatar
      };
      
      notifyAll("messages", "INSERT", mapped);
      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/groups/:id/explorations", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("community_explorations")
        .select("id, explored_at, notes, places(*)")
        .eq("community_id", req.params.id)
        .order("explored_at", { ascending: false });
        
      if (error) throw error;
      
      const explorations = data.map((e: any) => ({
        id: e.id,
          exploredAt: e.explored_at,
          notes: e.notes,
          placeId: e.places?.id,
          placeName: e.places?.name,
          placeImage: e.places?.image_url
      }));
      
      res.json(explorations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/groups", async (req, res) => {
    const group = toSnakeCase(req.body);
    const { data: result, error } = await supabase.from("communities").insert([group]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("communities", "INSERT", result);
    res.json(result);
  });

  app.put("/api/groups/:id", async (req, res) => {
    const updates = toSnakeCase(req.body);
    const { data: updated, error } = await supabase.from("communities").update(updates).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("communities", "UPDATE", updated);
    res.json(updated);
  });

  app.delete("/api/groups/:id", async (req, res) => {
    const { error } = await supabase.from("communities").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("communities", "DELETE", { id: req.params.id });
    res.json({ success: true });
  });

  // Social Feed & Social Pulse API
  app.get("/api/posts", async (req, res) => {
    try {
      const { data: posts, error } = await supabase
        .from("user_posts")
        .select("*, post_likes(user_id), post_comments(id)")
        .order("created_at", { ascending: false });
      
      if (error) return res.status(500).json({ error: error.message });
      
      const mapped = posts.map((p: any) => ({
        ...p,
        likes_count: p.post_likes?.length || 0,
        comments_count: p.post_comments?.length || 0
      }));
      
      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const { user_id, username, media_url, caption } = req.body;
      const { data, error } = await supabase
        .from("user_posts")
        .insert([{ user_id, username, media_url, caption }])
        .select()
        .single();
      
      if (error) throw error;
      
      if (caption) {
        const hashtags = caption.match(/#[\w\u00C0-\u024F]+/g);
        if (hashtags) {
          for (const tag of hashtags) {
            const tagName = tag.substring(1);
            const { data: existing } = await supabase.from("trending_hashtags").select("*").eq("name", tagName).single();
            if (existing) {
              await supabase.from("trending_hashtags").update({ updates_count: existing.updates_count + 1 }).eq("id", existing.id);
            } else {
              await supabase.from("trending_hashtags").insert([{ name: tagName, updates_count: 1 }]);
            }
          }
        }
      }

      notifyAll("user_posts", "INSERT", data);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/posts/:id/engagement", async (req, res) => {
    try {
      const { id } = req.params;
      const { data: likes } = await supabase.from("post_likes").select("user_id").eq("post_id", id);
      const { data: comments } = await supabase.from("post_comments").select("*").eq("post_id", id).order("created_at", { ascending: true });
      
      res.json({
        likes: likes || [],
        comments: comments || []
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/posts/:id/like", async (req, res) => {
    try {
      const { id: post_id } = req.params;
      const { userId: user_id } = req.body;
      
      const { data: existing } = await supabase
        .from("post_likes")
        .select("*")
        .eq("post_id", post_id)
        .eq("user_id", user_id)
        .maybeSingle();
        
      if (existing) {
        await supabase.from("post_likes").delete().eq("id", existing.id);
        notifyAll("post_likes", "DELETE", { post_id, user_id });
      } else {
        await supabase.from("post_likes").insert([{ post_id, user_id }]);
        notifyAll("post_likes", "INSERT", { post_id, user_id });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/posts/:id/comments", async (req, res) => {
    try {
      const { id: post_id } = req.params;
      const { userId: user_id, username, commentText: comment_text } = req.body;
      
      const { data, error } = await supabase
        .from("post_comments")
        .insert([{ post_id, user_id, username, comment_text }])
        .select()
        .single();
        
      if (error) throw error;
      notifyAll("post_comments", "INSERT", data);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/website-ratings", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("website_ratings")
        .select("*, users(name, avatar)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/website-ratings/average", async (req, res) => {
    try {
      const { data, error } = await supabase.from("website_ratings").select("rating");
      if (error) throw error;
      if (!data || data.length === 0) return res.json({ average: 0 });
      
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      res.json({ average: avg });
    } catch (err: any) {
      res.json({ average: 0 });
    }
  });

  app.post("/api/website-ratings", async (req, res) => {
    try {
      const { user_id, rating, review_text } = req.body;
      const { data, error } = await supabase
        .from("website_ratings")
        .insert([{ user_id, rating, review_text }])
        .select()
        .single();
        
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trending Hashtags Edit API (for Admin)
  app.put("/api/hashtags/:id", async (req, res) => {
    const updates = toSnakeCase(req.body);
    const { data: updated, error } = await supabase.from("trending_hashtags").update(updates).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("trending_hashtags", "UPDATE", updated);
    res.json(updated);
  });

  app.post("/api/hashtags", async (req, res) => {
    const hashtag = toSnakeCase(req.body);
    const { data: result, error } = await supabase.from("trending_hashtags").insert([hashtag]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("trending_hashtags", "INSERT", result);
    res.json(result);
  });

  app.delete("/api/hashtags/:id", async (req, res) => {
    const { error } = await supabase.from("trending_hashtags").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    notifyAll("trending_hashtags", "DELETE", { id: req.params.id });
    res.json({ success: true });
  });

  // User Stats & Activity Tracker
  app.get("/api/users/:userId/stats", async (req, res) => {
    try {
      const { userId } = req.params;

      // 1. Places Found (Unique views)
      const { count: exploredCount, error: exploredErr } = await supabase
        .from("user_views")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId);

      // 2. Saved Collections (Bookmarks)
      const { count: savedCount, error: savedErr } = await supabase
        .from("bookmarks")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId);

      // 3. Collective Reviews
      const { count: reviewCount, error: reviewErr } = await supabase
        .from("reviews")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId);

      if (exploredErr || savedErr || reviewErr) {
        throw exploredErr || savedErr || reviewErr;
      }

      res.json({
        exploredCount: exploredCount || 0,
        savedCount: savedCount || 0,
        reviewCount: reviewCount || 0
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/:userId/track-view", async (req, res) => {
    try {
      const { userId } = req.params;
      const { placeId } = req.body;

      if (!userId || !placeId) return res.status(400).json({ error: "Missing userId or placeId" });

      // Using upsert logic: if exists, viewed_at will be updated or just ignored since PK is (user_id, place_id)
      const { error } = await supabase
        .from("user_views")
        .upsert([{ user_id: userId, place_id: placeId, viewed_at: new Date().toISOString() }], { onConflict: 'user_id,place_id' });

      if (error) throw error;
      
      notifyAll("user_views", "INSERT", { userId, placeId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Geocoding Proxy
  app.get("/api/geocode", async (req: express.Request, res: express.Response) => {
    const { lat, lng } = req.query;
    const key = process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY;
    
    try {
      if (key) {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
        const data = await response.json();
        if (data.status === "OK") {
          return res.json(data);
        }
        console.warn("Google Maps Geocode returned non-OK status:", data.status);
      } else {
        console.warn("Google Maps API Key not available for geocoding proxy.");
      }

      // Fallback to Nominatim on the server side to avoid CORS/Headers issues on client
      console.log("Falling back to Nominatim for geocoding...");
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const nomRes = await fetch(nominatimUrl, {
        headers: {
          'Accept-Language': 'id',
          'User-Agent': 'TemuTempat-App/1.0' // Required by Nominatim policy
        }
      });
      const nomData = await nomRes.json();
      
      // Adapt Nominatim format to something similar to Google for easiest migration or just return as is
      // For now, let's return a unified structure or just let the client handle either
      res.json({
        nominatim: nomData,
        status: nomData.error ? "ERROR" : "OK"
      });
    } catch (error: any) {
      console.error("Geocoding proxy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("EXPRESS ERROR:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  try {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (listenErr) {
    console.error("CRITICAL: Server failed to listen:", listenErr);
  }
}

startServer().catch(err => {
  console.error("CRITICAL: startServer failed:", err);
});
