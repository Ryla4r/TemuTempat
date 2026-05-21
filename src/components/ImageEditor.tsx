import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { type Point, type Area } from "react-easy-crop";
import { 
  X, Check, RotateCcw, Sliders, Maximize, 
  Sun, Contrast, Aperture, Palette 
} from "lucide-react";

interface ImageEditorProps {
  image: string;
  onSave: (editedImage: string) => void;
  onCancel: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ image, onSave, onCancel }) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  
  // Filters
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    filters: string
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return "";

    canvas.width = image.width;
    canvas.height = image.height;

    ctx.filter = filters;
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height
    );

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.putImageData(data, 0, 0);

    return canvas.toDataURL("image/jpeg");
  };

  const handleSave = async () => {
    if (croppedAreaPixels) {
      const filterStr = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, filterStr);
      onSave(croppedImage);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/95 flex flex-col md:flex-row">
      {/* Cropper Main Area */}
      <div className="relative flex-1 bg-black">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={16 / 9}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          style={{
            containerStyle: { background: "#000" },
            mediaStyle: {
              filter: `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`
            }
          }}
        />
      </div>

      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-white p-6 md:p-8 flex flex-col gap-8 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-serif text-secondary-brown italic">Image Editor</h3>
          <button onClick={onCancel} className="p-2 bg-black/5 rounded-full hover:bg-black/10 border-none cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Basic Controls */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 flex items-center gap-2">
              <Maximize size={12} /> Crop Zoom
            </label>
            <input 
              type="range" 
              min={1} 
              max={3} 
              step={0.1} 
              value={zoom} 
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-accent-gold"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold">Filters</p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 flex items-center gap-2">
                <Sun size={12} /> Brightness
              </label>
              <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-secondary-brown" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 flex items-center gap-2">
                <Contrast size={12} /> Contrast
              </label>
              <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-secondary-brown" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-secondary-brown/40 flex items-center gap-2">
                <Palette size={12} /> Grayscale
              </label>
              <input type="range" min={0} max={100} value={grayscale} onChange={(e) => setGrayscale(Number(e.target.value))} className="w-full accent-secondary-brown" />
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 flex flex-col gap-3">
          <button 
            onClick={handleSave}
            className="w-full bg-secondary-brown text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all border-none cursor-pointer flex items-center justify-center gap-2"
          >
            <Check size={16} /> Save & Crop
          </button>
          <button 
            onClick={onCancel}
            className="w-full bg-black/5 text-secondary-brown py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black/10 transition-all border-none cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

  );
};
