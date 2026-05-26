import React, { useState, useMemo, useEffect } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { dataService } from "../../services/dataService";
import { motion } from "motion/react";
import { Place } from "../../types";

export default function PlaceManagement() {
  const [search, setSearch] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = dataService.subscribeToPlaces((data) => {
      setPlaces(Array.isArray(data) ? data : []);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredPlaces = useMemo(() => {
    return places.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.category.some(c => c.toLowerCase().includes(search.toLowerCase()))
    );
  }, [places, search]);

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="bg-bg-cream p-6 rounded-[2.5rem] border border-bg-deep-brown/5 shadow-sm">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-bg-deep-brown/40" size={20} />
          <input
            type="text"
            placeholder="Cari tempat berdasarkan nama, alamat, atau kategori..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-bg-deep-brown/5 rounded-2xl outline-none font-bold text-bg-deep-brown border-0"
          />
        </div>
      </div>

      {/* Results */}
      <div className="bg-bg-cream rounded-[3rem] border border-bg-deep-brown/5 shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 opacity-30">
            <Loader2 size={32} className="animate-spin text-secondary-brown mb-4" />
            <p className="font-serif italic text-sm">Memuat tempat...</p>
          </div>
        ) : filteredPlaces.length === 0 ? (
          <div className="text-center py-24 opacity-20">
            <MapPin size={48} className="mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-xs">Tidak ada tempat ditemukan</p>
          </div>
        ) : (
          <div className="divide-y divide-bg-deep-brown/5">
            {filteredPlaces.map((place, idx) => (
              <motion.div
                key={place.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-6 px-8 py-5 hover:bg-bg-deep-brown/[0.02] transition-colors group"
              >
                <img
                  src={place.imageUrl}
                  alt={place.name}
                  className="w-14 h-14 rounded-2xl object-cover grayscale group-hover:grayscale-0 transition-all shadow-md shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-bg-deep-brown text-sm truncate">{place.name}</p>
                  <p className="text-[10px] text-bg-deep-brown/40 font-serif italic truncate flex items-center gap-1 mt-0.5">
                    <MapPin size={9} /> {place.address}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 shrink-0 max-w-[160px] justify-end">
                  {place.category.slice(0, 2).map((cat, i) => (
                    <span key={i} className="text-[8px] px-2.5 py-1 bg-secondary-brown/10 text-secondary-brown rounded-full font-black uppercase tracking-wider">
                      {cat}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="p-8 bg-bg-deep-brown/5 border-t border-bg-deep-brown/5">
          <p className="text-[10px] font-black text-bg-deep-brown/30 uppercase tracking-widest italic">
            {filteredPlaces.length} tempat ditemukan
          </p>
        </div>
      </div>
    </div>
  );
}