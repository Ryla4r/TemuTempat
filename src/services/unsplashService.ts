const ACCESS_KEY = (import.meta.env.VITE_UNSPLASH_ACCESS_KEY || "").trim();

/**
 * Encords and hashes a string to secure a deterministic fallback photo from Unsplash.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Predefined collection of premium nature, cafe, cultural, and aesthetic travel images on Unsplash
const fallbackCollections = {
  beach: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1000&auto=format&fit=crop&q=80"
  ],
  mountain: [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1486873249359-2731bd6dafc7?w=1000&auto=format&fit=crop&q=80"
  ],
  cultural: [
    "https://images.unsplash.com/photo-1584810359583-96fc3448beaa?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1544085311-11a028465b03?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1000&auto=format&fit=crop&q=80"
  ],
  cafe: [
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1000&auto=format&fit=crop&q=80"
  ],
  hotel: [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&auto=format&fit=crop&q=80"
  ],
  nature: [
    "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1000&auto=format&fit=crop&q=80"
  ]
};

/**
 * Fetches elegant images matching a location search query.
 */
export async function getUnsplashImage(query: string, category?: string): Promise<string> {
  const cleanQuery = (query || "").trim().split(",")[0].trim();
  
  if (!cleanQuery) {
    return fallbackCollections.nature[0];
  }

  // 1. Unsplash API Request
  if (ACCESS_KEY) {
    try {
      const formattedQuery = category ? `${cleanQuery} ${category}` : cleanQuery;
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(formattedQuery)}&client_id=${ACCESS_KEY}&per_page=5&orientation=landscape`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          // Add a subtle randomizer from the top results for visual richness
          const list = data.results;
          const index = hashString(cleanQuery) % Math.min(list.length, 3);
          return list[index]?.urls?.regular || list[0]?.urls?.regular;
        }
      } else {
        console.warn("Unsplash API rate limit or authenticational error:", response.status);
      }
    } catch (err) {
      console.error("Unsplash integration fetch failed:", err);
    }
  }

  // 2. High-Quality Offline Fallbacks based on category match or query keywords
  const lowerQuery = cleanQuery.toLowerCase();
  const lowerCategory = (category || "").toLowerCase();
  
  const seed = hashString(cleanQuery);

  const selectFromList = (arr: string[]) => {
    return arr[seed % arr.length];
  };

  // Tag validation
  if (lowerQuery.includes("pantai") || lowerQuery.includes("beach") || lowerQuery.includes("pulau") || lowerQuery.includes("island") || lowerQuery.includes("laut") || lowerCategory.includes("pantai") || lowerCategory.includes("bahari")) {
    return selectFromList(fallbackCollections.beach);
  }
  if (lowerQuery.includes("gunung") || lowerQuery.includes("mountain") || lowerQuery.includes("bukit") || lowerQuery.includes("hill") || lowerQuery.includes("bromo") || lowerQuery.includes("camping") || lowerCategory.includes("gunung") || lowerCategory.includes("alam")) {
    return selectFromList(fallbackCollections.mountain);
  }
  if (lowerQuery.includes("candi") || lowerQuery.includes("temple") || lowerQuery.includes("sejarah") || lowerQuery.includes("historical") || lowerQuery.includes("budaya") || lowerCategory.includes("budaya") || lowerCategory.includes("sejarah")) {
    return selectFromList(fallbackCollections.cultural);
  }
  if (lowerQuery.includes("cafe") || lowerQuery.includes("kopi") || lowerQuery.includes("coffee") || lowerQuery.includes("restoran") || lowerQuery.includes("eatery") || lowerQuery.includes("kuliner") || lowerCategory.includes("kuliner") || lowerCategory.includes("cafe")) {
    return selectFromList(fallbackCollections.cafe);
  }
  if (lowerQuery.includes("hotel") || lowerQuery.includes("resort") || lowerQuery.includes("villa") || lowerQuery.includes("staycation") || lowerCategory.includes("penginapan")) {
    return selectFromList(fallbackCollections.hotel);
  }

  // Fallback to beautiful outdoor scenery by default
  const fallbackUniverse = [
    ...fallbackCollections.nature,
    ...fallbackCollections.mountain,
    ...fallbackCollections.beach
  ];
  return fallbackUniverse[seed % fallbackUniverse.length];
}
