import { useState, useEffect, useCallback } from "react";
import { 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useMap, 
  useMapsLibrary,
  useAdvancedMarkerRef,
  useApiIsLoaded
} from "@vis.gl/react-google-maps";
import { Place } from "../types";
import { Search, Sparkles, MapPin, Plus, ShieldCheck, Navigation } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateDistance } from "../lib/utils";

const API_KEY = 
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || 
  (typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_PLATFORM_KEY : "") || 
  "";

const MAP_ID = 
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
  (typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_MAP_ID : "") ||
  null;

const REQUIRED_PLACE_FIELDS = ["displayName", "location", "formattedAddress", "rating", "types", "id", "photos", "priceLevel"];

const hasValidKey = Boolean(API_KEY) && API_KEY.length > 5 && !API_KEY.includes("your_api_key");

interface MapProps {
  places: Place[];
  center?: [number, number];
  zoom?: number;
  userLocation?: [number, number] | null;
  selectedPlaceId?: string | null;
  polylinePath?: google.maps.LatLngLiteral[];
  onSelectPlace?: (id: string | null) => void;
  onNavigateToDetail?: (place: Place) => void;
  onAddFromMap?: (place: Partial<Place>) => void;
  onSearchResults?: (results: Place[]) => void;
}

function Polyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !path || path.length === 0) return;

    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: "#D4AF37",
      strokeOpacity: 0.8,
      strokeWeight: 6,
      map: map
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, { top: 100, bottom: 100, left: 100, right: 100 });

    return () => {
      polyline.setMap(null);
    };
  }, [map, path]);

  return null;
}

function DiscoveryLayer({ onAddFromMap }: { onAddFromMap?: (place: Partial<Place>) => void }) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const [nearbyPlaces, setNearbyPlaces] = useState<google.maps.places.Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.Place | null>(null);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const [searchError, setSearchError] = useState<string | null>(null);

  const scanArea = useCallback(async () => {
    if (!placesLib || !map) return;
    setLoading(true);
    setSearchError(null);
    
    try {
      const currentCenter = map.getCenter();
      if (!currentCenter) {
        setSearchError("Gagal mendapatkan lokasi pusat peta.");
        return;
      }

      const centerLiteral = { 
        lat: typeof currentCenter.lat === 'function' ? currentCenter.lat() : (currentCenter as any).lat, 
        lng: typeof currentCenter.lng === 'function' ? currentCenter.lng() : (currentCenter as any).lng 
      };

      const fields = ["displayName", "location", "formattedAddress", "rating", "types", "id"];
      const { places } = await placesLib.Place.searchNearby({
        fields: REQUIRED_PLACE_FIELDS,
        locationRestriction: {
          center: centerLiteral,
          radius: 1000
        },
        maxResultCount: 20,
        includedPrimaryTypes: ["cafe", "park", "restaurant", "tourist_attraction"]
      });
      
      if (!places || places.length === 0) {
        setSearchError("Tidak ditemukan tempat di area ini.");
      }
      setNearbyPlaces(places || []);
    } catch (error: any) {
      console.error("Nearby search failed:", error);
      if (error?.message?.includes('ApiNotActivatedMapError') || error?.message?.includes('ApiNotEnabledMapError')) {
        setSearchError("Layanan 'Places API (New)' belum aktif. Pastikan Billing/Pembayaran sudah diaktifkan di Google Cloud Console.");
      } else {
        setSearchError("Gagal mencari tempat. Periksa koneksi atau kunci API Anda.");
      }
    } finally {
      setLoading(false);
    }
  }, [placesLib, map]);

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
        <button 
          onClick={scanArea}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-secondary-brown text-white rounded-full shadow-2xl hover:bg-black transition-all font-bold text-[10px] tracking-[0.2em] uppercase border-none cursor-pointer group"
        >
          {loading ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Sparkles size={14} className="text-accent-gold group-hover:scale-110 transition-transform" />
          )}
          {loading ? "Mencari..." : "Scan Area Ini"}
        </button>

        {searchError && (
          <div className="px-4 py-2 bg-white/90 backdrop-blur-sm border border-accent-gold/20 text-secondary-brown text-[9px] font-bold rounded-full shadow-lg animate-bounce">
            ⚠️ {searchError}
          </div>
        )}
      </div>

      {nearbyPlaces.map((p) => (
        <AdvancedMarker 
          key={p.id} 
          position={p.location}
          onClick={() => setSelectedPlace(p)}
        >
          <Pin background="#D4AF37" glyphColor="#fff" borderColor="#fff" scale={0.8} />
        </AdvancedMarker>
      ))}

      {selectedPlace && (
        <InfoWindow
          position={selectedPlace.location}
          onCloseClick={() => setSelectedPlace(null)}
          headerDisabled
        >
          <div className="p-3 max-w-[200px] space-y-2">
            <h4 className="font-serif italic text-secondary-brown font-bold text-sm leading-tight">{selectedPlace.displayName}</h4>
            <p className="text-[10px] text-secondary-brown/60 leading-tight">{selectedPlace.formattedAddress}</p>
            <div className="flex items-center justify-between pt-2 border-t border-secondary-brown/5">
              <span className="text-[10px] font-bold text-accent-gold">★ {selectedPlace.rating || "N/A"}</span>
              {onAddFromMap && (
                <button 
                  onClick={() => onAddFromMap({
                    name: selectedPlace.displayName as string,
                    address: selectedPlace.formattedAddress as string,
                    latitude: selectedPlace.location?.lat(),
                    longitude: selectedPlace.location?.lng(),
                    rating: selectedPlace.rating || 4.5,
                    category: selectedPlace.types as string[]
                  })}
                  className="flex items-center gap-1 bg-accent-gold text-white px-2 py-1 rounded-md text-[8px] font-bold uppercase border-none cursor-pointer hover:bg-secondary-brown transition-colors"
                >
                  <Plus size={8} /> Simpan
                </button>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapHandler({ 
  center, 
  zoom, 
  onSearchResults 
}: { 
  center: [number, number], 
  zoom: number,
  onSearchResults?: (results: Place[]) => void
}) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");

  useEffect(() => {
    if (!map) return;
    map.setCenter({ lat: center[0], lng: center[1] });
  }, [map, center]);

  useEffect(() => {
    if (!map) return;
    map.setZoom(zoom);
  }, [map, zoom]);

  useEffect(() => {
    if (!map || !placesLib) return;

    const handleSmartSearch = async (e: any) => {
      const { query, tags } = e.detail;
      try {
        const request = {
          textQuery: query,
          fields: REQUIRED_PLACE_FIELDS,
          locationBias: map.getBounds() || { center: map.getCenter()!, radius: 3000 },
          maxResultCount: 15,
        };

        const { places } = await (placesLib as any).Place.searchByText(request);
        
        if (places && onSearchResults) {
          const formattedResults: Place[] = (Array.isArray(places) ? places : []).map((p: any) => ({
            id: p.id,
            name: p.displayName || p.name,
            address: p.formattedAddress || "",
            description: `Ditemukan untuk vibe: "${query}"`,
            imageUrl: p.photos?.[0]?.getURI?.({ maxWidth: 800 }) || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
            latitude: p.location.lat(),
            longitude: p.location.lng(),
            category: tags.length > 0 ? tags : ["Rekomendasi"],
            rating: p.rating || 0,
            priceLevel: p.priceLevel || 1,
            addedBy: "Google AI",
            createdAt: new Date().toISOString()
          }));
          onSearchResults(formattedResults);
        }
      } catch (error) {
        console.error("Smart Search failed:", error);
      }
    };

    window.addEventListener('google-maps-smart-search', handleSmartSearch);
    return () => window.removeEventListener('google-maps-smart-search', handleSmartSearch);
  }, [map, placesLib, onSearchResults]);

  return null;
}

export default function MapComponent({ 
  places, 
  center = [-6.200000, 106.816666], 
  zoom = 12, 
  userLocation,
  selectedPlaceId,
  polylinePath,
  onSelectPlace,
  onNavigateToDetail,
  onAddFromMap,
  onSearchResults
}: MapProps) {
  const map = useMap();
  const apiIsLoaded = useApiIsLoaded();
  const [infoWindowOpen, setInfoWindowOpen] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);

  useEffect(() => {
    if (!apiIsLoaded) {
      const timer = setTimeout(() => setSlowLoading(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setSlowLoading(false);
    }
  }, [apiIsLoaded]);
  const selectedPlace = places.find(p => p.id === selectedPlaceId);

  useEffect(() => {
    const handleAuthFailure = () => {
      setAuthFailed(true);
    };
    window.addEventListener("google-maps-auth-failure", handleAuthFailure);
    return () => window.removeEventListener("google-maps-auth-failure", handleAuthFailure);
  }, []);

  useEffect(() => {
    if (selectedPlaceId) {
      setInfoWindowOpen(true);
    }
  }, [selectedPlaceId]);

  useEffect(() => {
    if (map && selectedPlace) {
      map.panTo({ lat: selectedPlace.latitude, lng: selectedPlace.longitude });
      if (map.getZoom()! < 15) map.setZoom(15);
    }
  }, [map, selectedPlace]);
  if (!hasValidKey || authFailed) {
    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden bg-secondary-brown/5 flex items-center justify-center border border-dashed border-secondary-brown/20 p-8 min-h-[400px]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl text-accent-gold">
             <MapPin size={32} />
          </div>
          <h3 className="text-xl font-serif italic text-secondary-brown mb-2 font-bold">Google Maps API Error</h3>
          <p className="text-[11px] text-secondary-brown/60 mb-6 leading-relaxed font-medium">
            Peta tidak bisa tampil karena ada masalah pada akun Google Cloud kamu. Tenang, ini masalah umum dan bisa diperbaiki! 🛠️
          </p>

          <div className="bg-accent-gold/10 p-5 rounded-2xl mb-8 border-l-4 border-accent-gold">
            <p className="text-[10px] font-black text-secondary-brown uppercase tracking-widest flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-accent-gold" /> Diagnosis Kamu:
            </p>
            <p className="text-[11px] font-bold text-secondary-brown leading-tight">
              Error <code>ApiNotActivatedMapError</code> biasanya berarti <strong>Billing (Kartu Pembayaran)</strong> belum dihubungkan ke project Google Cloud kamu, atau API belum diaktifkan.
            </p>
          </div>
          
          <div className="text-left bg-white p-6 rounded-2xl shadow-lg border border-secondary-brown/5 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
            <p className="text-[10px] font-black text-secondary-brown uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={12} className="text-primary-green" /> Langkah Perbaikan:
            </p>
            <ol className="text-[10px] text-secondary-brown/70 space-y-3 list-decimal pl-4 font-medium">
              <li>
                <strong>Aktifkan Billing:</strong> Di Google Cloud Console, pastikan menu <strong>Billing</strong> sudah aktif untuk project ini.
              </li>
              <li>
                <strong>Aktifkan API:</strong> Pergi ke <strong>APIs & Services {">"} Library</strong>, cari dan aktifkan:
                <br /><code className="text-accent-gold opacity-80">- Maps JavaScript API</code>
                <br /><code className="text-accent-gold opacity-80">- Places API (New)</code>
              </li>
              <li>
                <strong>Cek Kunci API:</strong> Klik ikon <strong>Settings</strong> (⚙️) di kiri bawah AI Studio, pastikan <code>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> berisi kode valid.
              </li>
              <li>
                <strong>Refresh:</strong> Setelah aktifkan API di Google Cloud, tunggu 1-2 menit lalu muat ulang halaman ini.
              </li>
            </ol>
          </div>
          <div className="mt-8 text-[10px] text-secondary-brown/40 italic flex flex-col gap-1">
            <span>Error Status: Authentication Failed / ApiNotActivatedMapError</span>
            <a 
              href="https://console.cloud.google.com/google/maps-apis/overview" 
              target="_blank" 
              rel="noreferrer"
              className="text-accent-gold hover:underline"
            >
              Buka Google Cloud Console →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container-fix w-full h-full rounded-[3rem] overflow-hidden border border-secondary-brown/10 shadow-2xl relative z-10 bg-bg-cream">
      {!apiIsLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-cream/80 backdrop-blur-sm z-[2000]">
          <div className="w-12 h-12 border-4 border-secondary-brown/10 border-t-accent-gold rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary-brown/40">Memuat Peta...</p>
          {slowLoading && (
            <p className="mt-4 text-[9px] text-accent-gold font-bold px-8 text-center animate-pulse">
              Memuat agak lama. Pastikan Kunci API Google Maps sudah benar dan Billing aktif.
            </p>
          )}
        </div>
      )}
      <Map
        defaultCenter={{ lat: center[0], lng: center[1] }}
        defaultZoom={zoom}
        mapId={
          (MAP_ID && !MAP_ID.includes("your_map_id") && MAP_ID.length > 5) 
          ? MAP_ID 
          : null
        }
        internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        style={{ width: "100%", height: "100%" }}
        disableDefaultUI
      >
          <MapHandler 
            center={center} 
            zoom={zoom} 
            onSearchResults={onSearchResults} 
          />
          <DiscoveryLayer onAddFromMap={onAddFromMap} />
          {polylinePath && <Polyline path={polylinePath} />}

          {userLocation && (
            <AdvancedMarker position={{ lat: userLocation[0], lng: userLocation[1] }}>
              <div className="relative">
                <div className="absolute inset-0 bg-primary-green/30 rounded-full animate-ping scale-150"></div>
                <Pin background="#22c55e" glyphColor="#fff" borderColor="#fff" />
              </div>
            </AdvancedMarker>
          )}

          {places.map((place) => (
            <AdvancedMarker 
              key={place.id} 
              position={{ lat: place.latitude, lng: place.longitude }}
              title={place.name}
              onClick={() => onSelectPlace?.(place.id)}
            >
              <Pin 
                background={selectedPlaceId === place.id ? "#D4AF37" : "#8B4513"} 
                glyphColor="#fff" 
                scale={selectedPlaceId === place.id ? 1.2 : 1}
              />
            </AdvancedMarker>
          ))}

          {selectedPlace && infoWindowOpen && (
            <InfoWindow
              position={{ lat: selectedPlace.latitude, lng: selectedPlace.longitude }}
              onCloseClick={() => {
                setInfoWindowOpen(false);
                onSelectPlace?.(null);
              }}
              headerDisabled
            >
              <div className="p-3 max-w-[220px] space-y-2">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={selectedPlace.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-serif italic text-secondary-brown font-bold text-sm truncate leading-tight">{selectedPlace.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] font-bold text-accent-gold">★ {selectedPlace.rating}</span>
                      <span className="text-[9px] text-secondary-brown/40">• {selectedPlace.category[0]}</span>
                    </div>
                    {userLocation && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-secondary-brown/60">
                          <Navigation size={8} className="text-accent-gold" />
                          {(() => {
                            const d = calculateDistance(userLocation[0], userLocation[1], selectedPlace.latitude, selectedPlace.longitude);
                            return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
                          })()}
                        </div>
                        <div className="text-[8px] font-black text-secondary-brown/20 uppercase tracking-tight">
                          {(() => {
                            const d = calculateDistance(userLocation[0], userLocation[1], selectedPlace.latitude, selectedPlace.longitude);
                            const time = Math.round(d * 4 + 2);
                            return `±${time} mnt`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-secondary-brown/70 leading-tight line-clamp-2">{selectedPlace.description}</p>
                <div className="flex items-center justify-between pt-2 border-t border-secondary-brown/5">
                  <button 
                    onClick={() => {
                      if (onNavigateToDetail) {
                        onNavigateToDetail(selectedPlace);
                      }
                    }}
                    className="text-[9px] font-black text-accent-gold uppercase tracking-widest no-underline hover:text-secondary-brown transition-colors bg-transparent border-none cursor-pointer p-0"
                  >
                    Lihat Detail →
                  </button>
                  {onAddFromMap && selectedPlace.addedBy === "Google AI" && (
                    <button 
                      onClick={() => onAddFromMap(selectedPlace)}
                      className="flex items-center gap-1 bg-accent-gold text-white px-2 py-1 rounded-md text-[8px] font-bold uppercase border-none cursor-pointer hover:bg-secondary-brown transition-colors"
                    >
                      <Plus size={8} /> Simpan
                    </button>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
    </div>
  );
}
