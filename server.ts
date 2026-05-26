import Groq from "groq-sdk";
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

const geminiApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ 
  apiKey: geminiApiKey || "",
});

const Type = {
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
};

const aiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

function cleanSchema(schema: any): any {
  if (!schema) return schema;
  if (Array.isArray(schema)) return schema.map(cleanSchema);
  if (typeof schema === 'object') {
    const result: any = {};
    for (const key of Object.keys(schema)) {
      if (key === 'type' && typeof schema[key] === 'string') {
        result[key] = schema[key].toLowerCase();
      } else {
        result[key] = cleanSchema(schema[key]);
      }
    }
    if (result.type === 'object' && !('additionalProperties' in result)) {
      result.additionalProperties = false;
    }
    return result;
  }
  return schema;
}

async function getAIResponse(cacheKey: string, prompt: string, instruction: string, schema: any, modelToUse = "llama-3.3-70b-versatile") {
  const cached = aiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[AI Cache] Hit for: ${cacheKey}`);
    return cached.data;
  }

  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
  let currentModelIndex = models.indexOf(modelToUse);
  if (currentModelIndex === -1) currentModelIndex = 0;
  const modelsToTry = [models[currentModelIndex], ...models.filter((_, idx) => idx !== currentModelIndex)];

  let lastError: any = null;

  for (const activeModel of modelsToTry) {
    try {
      console.log(`[AI Request] Trying Groq model: ${activeModel}`);
      if (lastError) await new Promise(r => setTimeout(r, 1000));
      const cleanedSchema = cleanSchema(schema);
      const chatCompletion = await groq.chat.completions.create({
        model: activeModel,
        messages: [
          { role: "system", content: instruction },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_schema", json_schema: { name: "structured_response", strict: true, schema: cleanedSchema } },
        temperature: 0.1,
      });
      const text = chatCompletion.choices[0]?.message?.content;
      if (!text) throw new Error("Empty response from AI");
      const parsed = JSON.parse(text);
      aiCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
      return parsed;
    } catch (error: any) {
      lastError = error;
      const errorMsg = (error.message || "").toLowerCase();
      const code = error.status || error.error?.code || 500;
      console.warn(`[AI Error] ${activeModel} failed with ${code}: ${errorMsg.slice(0, 100)}...`);
      if (errorMsg.includes("schema") || errorMsg.includes("format") || errorMsg.includes("response_format")) {
        try {
          const chatCompletion = await groq.chat.completions.create({
            model: activeModel,
            messages: [
              { role: "system", content: `${instruction}\n\nCRITICAL: You MUST return a JSON object strictly matching this schema: ${JSON.stringify(cleanSchema(schema))}` },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          });
          const text = chatCompletion.choices[0]?.message?.content;
          if (text) {
            const parsed = JSON.parse(text);
            aiCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
            return parsed;
          }
        } catch (retryErr: any) {
          console.warn(`[AI Error] json_object retry failed: ${retryErr.message}`);
        }
      }
      continue;
    }
  }

  if (lastError && (lastError.status === 429 || lastError.message?.includes("429") || lastError.message?.includes("quota") || lastError.message?.includes("rate limit"))) {
    const quotaErr: any = new Error("Sistem AI sedang mencapai batas penggunaan gratis.");
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
    const dummyPromise = (data: any = null) => {
      const p = Promise.resolve({ data, error: { message: "Supabase not configured" } }) as any;
      p.eq = () => p; p.select = () => p; p.single = () => p;
      p.order = () => p; p.limit = () => p; p.insert = () => p;
      p.upsert = () => p; p.update = () => p; p.delete = () => p;
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

// ============================================================
// HELPER: Map profiles kolom ke format yang dipakai frontend
// profiles: id, email, name, role, avatar_url, bio, created_at
// ============================================================
const mapProfile = (p: any) => {
  if (!p) return p;
  return {
    id: p.id,
    email: p.email,
    name: p.name || p.email?.split("@")[0] || "User",
    role: p.role || "user",
    avatar: p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.name || p.email}`,
    avatar_url: p.avatar_url,
    bio: p.bio,
    created_at: p.created_at,
    // fallback agar frontend tidak crash kalau expect last_seen_at / is_online
    last_seen_at: p.created_at,
    is_online: false,
  };
};

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
    isOnline: "is_online",
    avatarUrl: "avatar_url",
  };
  Object.keys(obj).forEach(key => {
    const newKey = mapping[key] || key;
    result[newKey] = obj[key];
  });
  return result;
};

const initialPlaces = [
  {
    id: "00000000-0000-0000-0000-000000000011",
    name: "Kopi Hutan Pinus",
    description: "Kedai kopi tersembunyi di tengah hutan pinus dengan suasana yang sangat tenang dan udara segar. Cocok untuk healing.",
    category: ["sepi", "aesthetic", "outdoor"],
    address: "Jl. Hutan No. 12, Bandung",
    image_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop",
    rating: 4.8, latitude: -6.8329, longitude: 107.6168, price_level: 2,
    added_by: null, created_at: "2024-01-10T10:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    name: "Perpustakaan Kuno Kota",
    description: "Perpustakaan tua dengan koleksi buku langka. Sangat sepi dan memiliki eksterior bergaya kolonial yang estetik.",
    category: ["sepi", "murah", "indoor"],
    address: "Jl. Merdeka No. 5, Yogyakarta",
    image_url: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=600&fit=crop",
    rating: 4.6, latitude: -7.7956, longitude: 110.3695, price_level: 1,
    added_by: null, created_at: "2024-02-15T14:30:00Z",
  },
];

async function seedDatabase() {
  try {
    const { count: placeCount } = await supabase.from("places").select("*", { count: "exact", head: true });
    if (placeCount === 0) {
      console.log("Seeding initial places...");
      await supabase.from("places").insert(initialPlaces);
    }
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
    const { count: groupCount } = await supabase.from("communities").select("*", { count: "exact", head: true });
    if (groupCount === 0) {
      console.log("Seeding initial communities...");
      await supabase.from("communities").insert([
        { name: "Penjelajah Senja", description: "Kolektif pencari tempat syahdu saat matahari terbenam.", member_count: 12, image_url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&h=600&fit=crop" },
        { name: "Explorer Kota", description: "Komunitas pencari hidden gem di perkotaan.", member_count: 8, image_url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop" }
      ]);
    }
  } catch (err) {
    console.error("Seeding failure:", err);
  }
}

async function startServer() {
  console.log("Starting server...");

  if (supabaseUrl && supabaseKey) {
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (!listError) {
        const hasBucket = buckets?.some((b: any) => b.name === 'travel_media');
        if (!hasBucket) {
          await supabase.storage.createBucket('travel_media', { public: true, allowedMimeTypes: ['image/*', 'video/*'], fileSizeLimit: 10485760 });
        }
      }
    } catch (err) {
      console.warn("Storage auto-init skipped:", err);
    }
  }

  try { await seedDatabase(); } catch (err) { console.error("Initial seeding failed:", err); }

  const app = express();
  app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, abortOnLimit: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use((req, res, next) => { console.log(`${req.method} ${req.url}`); next(); });

  // ============================================================
  // AI ENDPOINTS
  // ============================================================
  app.post("/api/gemini/nearby-trending", async (req, res) => {
    try {
      const { cityName, coords, existingPlaces } = req.body || {};
      if (!cityName || !coords) return res.status(400).json({ error: "Missing required fields" });
      if (!geminiApiKey) return res.status(503).json({ error: "Gemini API key is not configured" });

      const cacheKey = `nearby_${cityName}_${Math.round(coords.lat * 10)}_${Math.round(coords.lng * 10)}`;
      const instruction = "You are a local travel scout. Suggest 4 REAL hidden gems in Indonesia. Be very concise in descriptions (max 10 words). Insight field should be 2-3 impact words.";
      const schema = {
        type: Type.OBJECT,
        properties: {
          recommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, description: { type: Type.STRING }, insight: { type: Type.STRING }, category: { type: Type.ARRAY, items: { type: Type.STRING } }, address: { type: Type.STRING }, latitude: { type: Type.NUMBER }, longitude: { type: Type.NUMBER }, imageUrl: { type: Type.STRING }, priceLevel: { type: Type.NUMBER } }, required: ["id", "name", "description", "insight", "address", "latitude", "longitude", "imageUrl"] } },
          summaryTitle: { type: Type.STRING }
        },
        required: ["recommendations", "summaryTitle"]
      };
      const placesContext = (Array.isArray(existingPlaces) ? existingPlaces : []).slice(0, 30).map((p: any) => ({ name: p.name, category: p.category, address: p.address }));
      const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const prompt = `User in ${cityName} (${coords.lat}, ${coords.lng}). Time: ${currentTime}. Suggest 4 unique REAL-WORLD trending spots in Indonesia near this specific district. Focus on "Hidden Gems". Context: ${JSON.stringify(placesContext)}`;
      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        res.json({ recommendations: initialPlaces.slice(0, 4).map(p => ({ id: p.id, name: p.name, description: p.description, insight: "Lokal Klasik", category: p.category, address: p.address, latitude: p.latitude, longitude: p.longitude, imageUrl: p.image_url, priceLevel: p.price_level })), summaryTitle: "Destinasi Klasik untuk Anda" });
      }
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/gemini/recommendations", async (req, res) => {
    try {
      const { userInput, places } = req.body || {};
      if (!userInput) return res.status(400).json({ error: "Missing required field: userInput" });
      if (!geminiApiKey) return res.status(503).json({ error: "Gemini API key is not configured" });

      const cacheKey = `rec_${userInput.toLowerCase().trim().replace(/\s+/g, '_')}`;
      const instruction = "You are an expert travel scout. Suggest real places in Indonesia. Jangan pernah menyebutkan AI. Tulis seolah-olah Anda adalah seorang kurator manusia yang berpengalaman.";
      const schema = {
        type: Type.OBJECT,
        properties: {
          recommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, insight: { type: Type.STRING }, name: { type: Type.STRING }, description: { type: Type.STRING }, category: { type: Type.ARRAY, items: { type: Type.STRING } }, address: { type: Type.STRING }, latitude: { type: Type.NUMBER }, longitude: { type: Type.NUMBER }, imageUrl: { type: Type.STRING }, priceLevel: { type: Type.NUMBER } }, required: ["id", "insight"] } },
          summaryTitle: { type: Type.STRING }
        },
        required: ["recommendations", "summaryTitle"]
      };
      const placesContext = (Array.isArray(places) ? places : []).slice(0, 50).map((p: any) => ({ id: p.id, name: p.name, description: p.description, category: p.category, rating: p.rating }));
      const prompt = `Analyze the user request: "${userInput}". Current local time: ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}. Review provided places for matches. If not enough, SUGGEST real-world places in Indonesia. For suggested places NOT in the list, use ID: "ai-new-[slug]". Available local places: ${JSON.stringify(placesContext)}`;
      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        const filtered = (Array.isArray(places) ? places : []).filter((p: any) => p.name.toLowerCase().includes(userInput.toLowerCase()) || p.category?.some((c: string) => c.toLowerCase().includes(userInput.toLowerCase()))).slice(0, 5);
        res.json({ recommendations: filtered.length > 0 ? filtered.map((p: any) => ({ id: p.id, name: p.name, insight: "Hasil Pencarian Lokal", description: p.description, category: p.category, address: p.address, latitude: p.latitude, longitude: p.longitude, imageUrl: p.imageUrl, priceLevel: p.priceLevel })) : initialPlaces.slice(0, 3).map(p => ({ id: p.id, name: p.name, insight: "Pilihan Populer", description: p.description, category: p.category, address: p.address, latitude: p.latitude, longitude: p.longitude, imageUrl: p.image_url, priceLevel: p.price_level })), summaryTitle: filtered.length > 0 ? `Menampilkan hasil untuk "${userInput}"` : "Rekomendasi Terpopuler" });
      }
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/gemini/search-keywords", async (req, res) => {
    try {
      const { userInput } = req.body || {};
      if (!userInput) return res.status(400).json({ error: "userInput is required" });
      if (!geminiApiKey) return res.status(503).json({ error: "Gemini API key is not configured" });
      const cacheKey = `keywords_${userInput.toLowerCase().trim().replace(/\s+/g, '_')}`;
      const instruction = "You are a local search expert. Turn vibe-based requests into searchable terms for maps.";
      const schema = { type: Type.OBJECT, properties: { query: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["query", "tags"] };
      const prompt = `Convert the user's vague place request into a clean search query for Google Maps and a list of tags. User request: "${userInput}". Example: "taman sepi buat bengong" -> query: "quiet park garden", tags: ["Park", "Nature"]`;
      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        res.json({ query: userInput, tags: ["Umum", "Eksplorasi"] });
      }
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/gemini/enrichment", async (req, res) => {
    try {
      const { placeName } = req.body || {};
      if (!placeName) return res.status(400).json({ error: "placeName is required" });
      if (!geminiApiKey) return res.status(503).json({ error: "Gemini API key is not configured" });
      const cacheKey = `enrich_${placeName.toLowerCase().trim().replace(/\s+/g, '_')}`;
      const instruction = "You are an expert travel writer for high-end aesthetic magazines. Your writing is evocative, sensory, and Indonesian-native. Do not mention AI.";
      const schema = { type: Type.OBJECT, properties: { description: { type: Type.STRING }, categories: { type: Type.ARRAY, items: { type: Type.STRING } }, priceLevel: { type: Type.NUMBER }, openingHours: { type: Type.STRING }, jamRamai: { type: Type.STRING }, waktuTerbaik: { type: Type.STRING } }, required: ["description", "categories", "priceLevel", "openingHours", "jamRamai", "waktuTerbaik"] };
      const prompt = `Generate a compelling description, 5-7 relevant tags, and visiting time insights for: "${placeName}". Context: Located in Indonesia. Style: "poetic travel curator" tone. Language: Indonesian. Description: 2-3 sentences max. openingHours: "HH:MM - HH:MM" format. jamRamai: most crowded time. waktuTerbaik: best time to visit.`;
      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        res.json({ description: `Temukan keindahan tersembunyi di ${placeName}.`, categories: ["Eksplorasi", "Lokal", "Populer"], priceLevel: 2, openingHours: "09:00 - 21:00", jamRamai: "16:00 - 18:00", waktuTerbaik: "Sore hari saat matahari terbenam" });
      }
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/gemini/bulk-discover", async (req, res) => {
    try {
      const { city, vibe } = req.body || {};
      if (!city) return res.status(400).json({ error: "city is required" });
      if (!geminiApiKey) return res.status(503).json({ error: "Gemini API key is not configured" });
      const cacheKey = `bulk_${city.toLowerCase()}_${(vibe || 'general').toLowerCase().replace(/\s+/g, '_')}`;
      const instruction = "You are a travel scout. Suggest REAL places in Indonesia. Provide precise Lat/Lng and aesthetic descriptions in Indonesian.";
      const schema = { type: Type.OBJECT, properties: { places: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, address: { type: Type.STRING }, latitude: { type: Type.NUMBER }, longitude: { type: Type.NUMBER }, category: { type: Type.ARRAY, items: { type: Type.STRING } }, imageUrl: { type: Type.STRING }, priceLevel: { type: Type.NUMBER } }, required: ["name", "description", "address", "latitude", "longitude", "category", "imageUrl", "priceLevel"] } } }, required: ["places"] };
      const prompt = `Find 10 real-world amazing hidden gems in ${city}, Indonesia that fit the vibe: "${vibe}". Provide full details for each place.`;
      try {
        const data = await getAIResponse(cacheKey, prompt, instruction, schema);
        res.json(data);
      } catch (aiErr: any) {
        res.json({ places: initialPlaces.map(p => ({ name: p.name, description: p.description, address: p.address, latitude: p.latitude, longitude: p.longitude, category: p.category, imageUrl: p.image_url, priceLevel: p.price_level })) });
      }
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/upload", async (req, res) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) return res.status(400).json({ error: "Tidak ada file yang diunggah." });
      const file = req.files.file as any;
      const dataUri = `data:${file.mimetype};base64,${file.data.toString("base64")}`;
      res.json({ url: dataUri });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY), nodeEnv: process.env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  const httpServer = createHttpServer(app);
  const io = new SocketServer(httpServer, { cors: { origin: "*" } });
  const PORT = 3000;

  const notifyAll = (table: string, eventType: string, data: any, oldData?: any) => {
    try {
      if (table === 'community_groups') table = 'communities';
      if (table === 'group_messages') table = 'messages';
      io.emit("change", { table, eventType, new: data, old: oldData });
    } catch (e) { console.error("Socket emit failed:", e); }
  };

  if (supabaseUrl && supabaseKey) {
    supabase.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
        notifyAll(payload.table, payload.eventType, payload.new, payload.old);
      })
      .subscribe();
  }

  io.on("connection", (socket) => {
    socket.on("user_online", async (userId) => {
      socket.data.userId = userId;
    });
    socket.on("disconnect", async () => {
      // no-op: profiles tidak punya is_online/last_seen_at
    });
  });

  // ============================================================
  // USERS API — pakai tabel profiles
  // ============================================================
  app.get("/api/users", async (req, res) => {
    try {
      const { data: users, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json((users || []).map(mapProfile));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/delete", async (req, res) => {
    try {
      const { id } = req.body;
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      notifyAll("users", "DELETE", { id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      // Map avatar -> avatar_url untuk profiles
      const body = { ...req.body };
      if (body.avatar && !body.avatar_url) body.avatar_url = body.avatar;
      delete body.avatar;
      delete body.last_seen_at;
      delete body.is_online;

      const updates = toSnakeCase(body);
      const { data: updated, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      notifyAll("users", "UPDATE", mapProfile(updated));
      res.json(mapProfile(updated));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, name, avatar } = req.body;
    if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
      return res.status(500).json({ error: "Supabase belum dikonfigurasi." });
    }
    try {
      let { data: user, error } = await supabase.from("profiles").select("*").eq("email", email).single();
      if (error && error.message?.includes('does not exist')) {
        return res.status(500).json({ error: "Tabel 'profiles' tidak ditemukan.", hint: "Jalankan SQL schema di Supabase." });
      }
      if (!user) {
        const id = crypto.randomUUID();
        const defaultName = name || email.split("@")[0];
        const defaultAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${defaultName}`;
        const { data: newUser, error: insertError } = await supabase
          .from("profiles")
          .insert([{ id, email, name: defaultName, role: "user", avatar_url: defaultAvatar }])
          .select()
          .single();
        if (insertError) return res.status(500).json({ error: "Gagal membuat pengguna baru.", hint: insertError.message, details: insertError });
        user = newUser;
        notifyAll("users", "INSERT", mapProfile(user));
      } else {
        notifyAll("users", "UPDATE", mapProfile(user));
      }
      res.json(mapProfile(user));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // ADMIN
  // ============================================================
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const { data: places } = await supabase.from("places").select("name, category, created_at");
      const { data: reviews } = await supabase.from("reviews").select("id, created_at");

      const categoryCounts: Record<string, number> = {};
      (places || []).forEach((p: any) => {
        const cat = p.category?.[0] || "Lainnya";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      const recentActions = [
        ...((places || []).map((p: any) => ({ type: "place", title: p.name, createdAt: p.created_at }))),
        ...((reviews || []).map((r: any) => ({ type: "review", title: "Review Baru", createdAt: r.created_at })))
      ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

      res.json({ activity: [], categories: Object.entries(categoryCounts).map(([name, value]) => ({ name, value })), recentActions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/seed", async (req, res) => {
    try {
      const { count } = await supabase.from("places").select("*", { count: "exact", head: true });
      if (count && count > 0) return res.status(400).json({ error: "Database sudah berisi data." });
      const { error } = await supabase.from("places").insert(initialPlaces);
      if (error) throw error;
      initialPlaces.forEach(p => notifyAll("places", "INSERT", p));
      res.json({ success: true, message: "Berhasil menambahkan data awal." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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

  // ============================================================
  // PLACES
  // ============================================================
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

  app.post("/api/places", async (req, res) => {
    try {
      const { name, description, address, imageUrl, category, latitude, longitude, priceLevel, addedBy } = req.body;
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      // Validate addedBy — must exist in profiles
      let finalAddedBy = null;
      if (addedBy) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(addedBy));
        if (isUUID) {
          const { data: userExists } = await supabase.from("profiles").select("id").eq("id", addedBy).single();
          if (userExists) finalAddedBy = addedBy;
        }
      }

      const { data: result, error } = await supabase
        .from("places")
        .insert([{ id, name, description, category, address, image_url: imageUrl, rating: 0, latitude: parseFloat(String(latitude)) || 0, longitude: parseFloat(String(longitude)) || 0, price_level: parseInt(String(priceLevel)) || 1, added_by: finalAddedBy, created_at: createdAt }])
        .select()
        .single();

      if (error) {
        const isRLS = error.message?.toLowerCase().includes("row-level security") || error.code === '42501';
        return res.status(500).json({ error: error.message, code: error.code, hint: isRLS ? "RLS aktif. Jalankan: ALTER TABLE places DISABLE ROW LEVEL SECURITY;" : error.message });
      }

      notifyAll("places", "INSERT", result);
      res.json(result);
    } catch (err: any) {
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

  // ============================================================
  // REVIEWS
  // ============================================================
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
    const { data: result, error: insertError } = await supabase
      .from("reviews")
      .insert([{ id, place_id: placeId, user_id: userId, user_name: userName, user_avatar: userAvatar, rating, comment, likes: 0, replies: [], media_url: mediaUrl, hashtags, created_at: new Date().toISOString() }])
      .select().single();
    if (insertError) return res.status(500).json({ error: insertError.message });
    const { data: reviews } = await supabase.from("reviews").select("rating").eq("place_id", placeId);
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
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
      const avg = reviews && reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length : 0;
      const { data: updatedPlace } = await supabase.from("places").update({ rating: avg }).eq("id", placeId).select().single();
      notifyAll("reviews", "DELETE", { id: req.params.id });
      if (updatedPlace) notifyAll("places", "UPDATE", updatedPlace);
    }
    res.json({ success: true });
  });

  // ============================================================
  // BOOKMARKS
  // ============================================================
  app.get("/api/bookmarks/:userId", async (req, res) => {
    try {
      const { data: bookmarks, error } = await supabase.from("bookmarks").select("place_id").eq("user_id", req.params.userId);
      if (error) return res.status(500).json({ error: error.message });
      res.json((bookmarks || []).map((b: any) => b.place_id));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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

  // ============================================================
  // HASHTAGS
  // ============================================================
  app.get("/api/hashtags", async (req, res) => {
    const { data: hashtags, error } = await supabase.from("trending_hashtags").select("*").order("updates_count", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(hashtags);
  });

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

  // ============================================================
  // COMMUNITIES / GROUPS
  // ============================================================
  app.get("/api/groups", async (req, res) => {
    const { data: groups, error } = await supabase.from("communities").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(groups);
  });

  app.get("/api/groups/:id/members", async (req, res) => {
    try {
      const { data, error } = await supabase.from("group_members").select("joined_at, profiles(*)").eq("community_id", req.params.id);
      if (error) throw error;
      const members = data.map((m: any) => ({ ...mapProfile(m.profiles), joinedAt: m.joined_at }));
      res.json(members);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const groupId = req.params.id;
      const { data: existing } = await supabase.from("group_members").select("*").eq("community_id", groupId).eq("user_id", userId).single();
      if (existing) return res.json({ success: true, message: "Already a member" });
      const { error: joinError } = await supabase.from("group_members").insert([{ community_id: groupId, user_id: userId }]);
      if (joinError) throw joinError;
      const { data: group } = await supabase.from("communities").select("member_count").eq("id", groupId).single();
      const newCount = (group?.member_count || 0) + 1;
      await supabase.from("communities").update({ member_count: newCount }).eq("id", groupId);
      notifyAll("group_members", "INSERT", { groupId, userId });
      notifyAll("communities", "UPDATE", { id: groupId, member_count: newCount });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/groups/:id/messages", async (req, res) => {
    try {
      const { data, error } = await supabase.from("messages").select("id, content, created_at, user_id, profiles(name, avatar_url)").eq("community_id", req.params.id).order("created_at", { ascending: true });
      if (error) throw error;
      const messages = data.map((m: any) => ({ id: m.id, content: m.content, createdAt: m.created_at, userId: m.user_id, userName: m.profiles?.name, userAvatar: m.profiles?.avatar_url }));
      res.json(messages);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/groups/:id/messages", async (req, res) => {
    try {
      const { userId, content } = req.body;
      const groupId = req.params.id;
      const { data: newMessage, error } = await supabase.from("messages").insert([{ community_id: groupId, user_id: userId, content }]).select("id, content, created_at, user_id, profiles(name, avatar_url)").single();
      if (error) throw error;
      const mapped = { id: newMessage.id, groupId, content: newMessage.content, createdAt: newMessage.created_at, userId: newMessage.user_id, userName: newMessage.profiles?.name, userAvatar: newMessage.profiles?.avatar_url };
      notifyAll("messages", "INSERT", mapped);
      res.json(mapped);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/groups/:id/explorations", async (req, res) => {
    try {
      const { data, error } = await supabase.from("community_explorations").select("id, explored_at, notes, places(*)").eq("community_id", req.params.id).order("explored_at", { ascending: false });
      if (error) throw error;
      const explorations = data.map((e: any) => ({ id: e.id, exploredAt: e.explored_at, notes: e.notes, placeId: e.places?.id, placeName: e.places?.name, placeImage: e.places?.image_url }));
      res.json(explorations);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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

  // ============================================================
  // SOCIAL POSTS
  // ============================================================
  app.get("/api/posts", async (req, res) => {
    try {
      const { data: posts, error } = await supabase.from("user_posts").select("*, post_likes(user_id), post_comments(id)").order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      const mapped = posts.map((p: any) => ({ ...p, likes_count: p.post_likes?.length || 0, comments_count: p.post_comments?.length || 0 }));
      res.json(mapped);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const { user_id, username, media_url, caption } = req.body;
      const { data, error } = await supabase.from("user_posts").insert([{ user_id, username, media_url, caption }]).select().single();
      if (error) throw error;
      if (caption) {
        const hashtags = caption.match(/#[\w\u00C0-\u024F]+/g);
        if (hashtags) {
          for (const tag of hashtags) {
            const tagName = tag.substring(1);
            const { data: existing } = await supabase.from("trending_hashtags").select("*").eq("name", tagName).single();
            if (existing) { await supabase.from("trending_hashtags").update({ updates_count: existing.updates_count + 1 }).eq("id", existing.id); }
            else { await supabase.from("trending_hashtags").insert([{ name: tagName, updates_count: 1 }]); }
          }
        }
      }
      notifyAll("user_posts", "INSERT", data);
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/posts/:id/engagement", async (req, res) => {
    try {
      const { id } = req.params;
      const { data: likes } = await supabase.from("post_likes").select("user_id").eq("post_id", id);
      const { data: comments } = await supabase.from("post_comments").select("*").eq("post_id", id).order("created_at", { ascending: true });
      res.json({ likes: likes || [], comments: comments || [] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/posts/:id/like", async (req, res) => {
    try {
      const { id: post_id } = req.params;
      const { userId: user_id } = req.body;
      const { data: existing } = await supabase.from("post_likes").select("*").eq("post_id", post_id).eq("user_id", user_id).maybeSingle();
      if (existing) { await supabase.from("post_likes").delete().eq("id", existing.id); notifyAll("post_likes", "DELETE", { post_id, user_id }); }
      else { await supabase.from("post_likes").insert([{ post_id, user_id }]); notifyAll("post_likes", "INSERT", { post_id, user_id }); }
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/posts/:id/comments", async (req, res) => {
    try {
      const { id: post_id } = req.params;
      const { userId: user_id, username, commentText: comment_text } = req.body;
      const { data, error } = await supabase.from("post_comments").insert([{ post_id, user_id, username, comment_text }]).select().single();
      if (error) throw error;
      notifyAll("post_comments", "INSERT", data);
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ============================================================
  // WEBSITE RATINGS
  // ============================================================
  app.get("/api/website-ratings", async (req, res) => {
    try {
      const { data, error } = await supabase.from("website_ratings").select("*, profiles(name, avatar_url)").order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/website-ratings/average", async (req, res) => {
    try {
      const { data, error } = await supabase.from("website_ratings").select("rating");
      if (error) throw error;
      if (!data || data.length === 0) return res.json({ average: 0 });
      const avg = data.reduce((sum: number, r: any) => sum + r.rating, 0) / data.length;
      res.json({ average: avg });
    } catch (err: any) { res.json({ average: 0 }); }
  });

  app.post("/api/website-ratings", async (req, res) => {
    try {
      const { user_id, rating, review_text } = req.body;
      const { data, error } = await supabase.from("website_ratings").insert([{ user_id, rating, review_text }]).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ============================================================
  // USER STATS
  // ============================================================
  app.get("/api/users/:userId/stats", async (req, res) => {
    try {
      const { userId } = req.params;
      const { count: exploredCount } = await supabase.from("user_views").select("*", { count: 'exact', head: true }).eq("user_id", userId);
      const { count: savedCount } = await supabase.from("bookmarks").select("*", { count: 'exact', head: true }).eq("user_id", userId);
      const { count: reviewCount } = await supabase.from("reviews").select("*", { count: 'exact', head: true }).eq("user_id", userId);
      res.json({ exploredCount: exploredCount || 0, savedCount: savedCount || 0, reviewCount: reviewCount || 0 });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/users/:userId/track-view", async (req, res) => {
    try {
      const { userId } = req.params;
      const { placeId } = req.body;
      if (!userId || !placeId) return res.status(400).json({ error: "Missing userId or placeId" });
      const { error } = await supabase.from("user_views").upsert([{ user_id: userId, place_id: placeId, viewed_at: new Date().toISOString() }], { onConflict: 'user_id,place_id' });
      if (error) throw error;
      notifyAll("user_views", "INSERT", { userId, placeId });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ============================================================
  // GEOCODING PROXY
  // ============================================================
  app.get("/api/geocode", async (req: express.Request, res: express.Response) => {
    const { lat, lng } = req.query;
    const key = process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY;
    try {
      if (key) {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
        const data = await response.json();
        if (data.status === "OK") return res.json(data);
      }
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'id', 'User-Agent': 'TemuTempat-App/1.0' } });
      const nomData = await nomRes.json();
      res.json({ nominatim: nomData, status: nomData.error ? "ERROR" : "OK" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // VITE / STATIC
  // ============================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("EXPRESS ERROR:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  httpServer.listen(PORT, "0.0.0.0", () => { console.log(`Server running on http://localhost:${PORT}`); });
}

startServer().catch(err => { console.error("CRITICAL: startServer failed:", err); });