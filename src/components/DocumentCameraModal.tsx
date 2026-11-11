import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  RotateCcw,
  Check,
  RefreshCw,
  SwitchCamera,
  ShieldAlert,
  Upload,
  Plus,
  Trash2,
  Images,
  Smartphone,
  Eye,
  HelpCircle,
} from 'lucide-react';

export interface StagedCapturedItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeKb: number;
}

interface DocumentCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (fileOrFiles: File | File[], previewUrlOrUrls: string | string[]) => void;
  title?: string;
}

export const DocumentCameraModal: React.FC<DocumentCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Scan Medical Document / ADR Report',
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [stagedItems, setStagedItems] = useState<StagedCapturedItem[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [snapFlash, setSnapFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryMultiInputRef = useRef<HTMLInputElement>(null);

  // Stop any active stream tracks
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  }, []);

  // Check available video devices
  useEffect(() => {
    if (!isOpen) return;
    if (navigator?.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoDevs.length > 1);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Start Camera Stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setIsInitializing(true);
    setError(null);
    setPermissionDenied(false);
    stopTracks();

    // Check mediaDevices support
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError(
        'Direct live camera streaming is unavailable in this environment. Use "Take Photo via Native Camera" or "Select Multiple from Gallery" below.'
      );
      setIsInitializing(false);
      return;
    }

    try {
      let activeStream: MediaStream | null = null;

      // 1. Attempt ideal constraints with specified facing mode
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
        });
      } catch (errConstraint) {
        console.warn('High-res camera constraint failed, retrying basic video constraint...', errConstraint);
        // 2. Fallback: basic video request
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      if (!activeStream) {
        throw new Error('No video stream received from device');
      }

      streamRef.current = activeStream;
      setStream(activeStream);

      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => {
            console.error('Video play error:', playErr);
          });
          setIsInitializing(false);
        };
      } else {
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      const isPermission =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.toLowerCase().includes('permission denied');

      if (isPermission) {
        setPermissionDenied(true);
        setError(
          'Camera permission was not granted by the browser. You can still use "Take Photo via Native Camera" or "Select Multiple from Gallery" below.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera device detected. Use "Select Multiple from Gallery / Files" below to upload photos.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another tab or app. Please close other camera apps or use gallery upload.');
      } else {
        setError(`Camera error: ${err.message || 'Could not start video stream'}`);
      }
      setIsInitializing(false);
    }
  }, [stopTracks]);

  // Open camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setStagedItems([]);
      setActivePreviewIndex(null);
      startCamera(facingMode);
    } else {
      stopTracks();
      setStagedItems([]);
      setActivePreviewIndex(null);
      setError(null);
      setPermissionDenied(false);
    }

    return () => {
      stopTracks();
    };
  }, [isOpen, facingMode, startCamera, stopTracks]);

  // Helper to convert dataUrl to File
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    return new File([blob], filename, { type: mimeString, lastModified: Date.now() });
  };

  // Capture snapshot from live video canvas
  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Trigger visual shutter flash
    setSnapFlash(true);
    setTimeout(() => setSnapFlash(false), 200);

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // High quality JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const pageNum = stagedItems.length + 1;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `casesheet_scan_page_${pageNum}_${timestamp}.jpg`;
    const file = dataUrlToFile(dataUrl, filename);

    const newItem: StagedCapturedItem = {
      id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      previewUrl: dataUrl,
      name: `Photo #${pageNum}`,
      sizeKb: Math.round(file.size / 1024),
    };

    setStagedItems((prev) => [...prev, newItem]);
    // Set preview to latest
    setActivePreviewIndex(stagedItems.length);
  };

  // Gallery multi-file picker handler (select multiple photos simultaneously from Android Gallery)
  const handleGalleryBatchPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    fileList.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const previewUrl = reader.result as string;
        const pageNum = stagedItems.length + idx + 1;
        const newItem: StagedCapturedItem = {
          id: `gallery-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          previewUrl,
          name: file.name || `Photo #${pageNum}`,
          sizeKb: Math.round(file.size / 1024),
        };
        setStagedItems((prev) => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
    setError(null);
  };

  // Native device camera single/multiple snap handler
  const handleNativeCameraSnap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    fileList.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const previewUrl = reader.result as string;
        const pageNum = stagedItems.length + idx + 1;
        const newItem: StagedCapturedItem = {
          id: `native-cam-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          previewUrl,
          name: `Camera Photo #${pageNum}`,
          sizeKb: Math.round(file.size / 1024),
        };
        setStagedItems((prev) => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
    setError(null);
  };

  // Remove individual staged photo
  const handleRemoveStaged = (idToRemove: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStagedItems((prev) => {
      const next = prev.filter((item) => item.id !== idToRemove);
      if (activePreviewIndex !== null && activePreviewIndex >= next.length) {
        setActivePreviewIndex(next.length > 0 ? next.length - 1 : null);
      }
      return next;
    });
  };

  // Flip camera (rear/front)
  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Confirm and upload all staged photos
  const handleConfirmAll = () => {
    if (stagedItems.length === 0) return;

    stopTracks();
    const files = stagedItems.map((item) => item.file);
    const previews = stagedItems.map((item) => item.previewUrl);

    // Call onCapture with array of files and previews
    onCapture(files, previews);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-slate-100">
        {/* Hidden File Input for Native Camera (environment back camera trigger) */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraSnap}
          className="hidden"
        />

        {/* Hidden Multi-file Input for Android Photo Gallery (No capture attr = Opens gallery with multi-select) */}
        <input
          ref={galleryMultiInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleGalleryBatchPick}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-slate-800/95 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white">{title}</h3>
                {stagedItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold text-[10px] border border-emerald-500/30">
                    {stagedItems.length} {stagedItems.length === 1 ? 'Photo' : 'Photos'} Captured
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Snap multiple pages continuously or pick multiple photos from gallery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasMultipleCameras && !error && (
              <button
                type="button"
                onClick={handleToggleCamera}
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Switch Camera (Front / Rear)"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-medium">Flip</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopTracks();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black min-h-[260px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
          {/* Shutter Flash Animation */}
          {snapFlash && (
            <div className="absolute inset-0 bg-white/70 z-20 pointer-events-none transition-opacity duration-150" />
          )}

          {/* Active Preview Overlay if user clicked an existing photo thumbnail */}
          {activePreviewIndex !== null && stagedItems[activePreviewIndex] ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 p-2">
              <img
                src={stagedItems[activePreviewIndex].previewUrl}
                alt={stagedItems[activePreviewIndex].name}
                className="w-full h-full max-h-[360px] object-contain rounded-lg"
              />
              <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-slate-700 flex items-center gap-2">
                <span>{stagedItems[activePreviewIndex].name}</span>
                <span className="text-slate-400 font-normal">
                  ({stagedItems[activePreviewIndex].sizeKb} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewIndex(null)}
                className="absolute top-3 right-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold shadow-md cursor-pointer flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Back to Camera</span>
              </button>
            </div>
          ) : (
            <>
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain ${error ? 'hidden' : 'block'}`}
              />

              {/* Hidden Canvas for capture processing */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Document Framing Overlay */}
              {!error && !isInitializing && (
                <div className="absolute inset-4 sm:inset-7 pointer-events-none border-2 border-dashed border-indigo-400/70 rounded-xl flex flex-col justify-between p-3">
                  <div className="flex justify-between items-start">
                    <span className="w-5 h-5 border-t-2 border-l-2 border-indigo-400 rounded-tl-md"></span>
                    <span className="text-[10px] bg-slate-900/80 backdrop-blur-xs text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                      Document Page Target
                    </span>
                    <span className="w-5 h-5 border-t-2 border-r-2 border-indigo-400 rounded-tr-md"></span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] text-white/95 font-medium bg-black/75 px-3 py-1 rounded-full shadow-md">
                      Align prescription, casesheet page, or lab report & click Snap
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="w-5 h-5 border-b-2 border-l-2 border-indigo-400 rounded-bl-md"></span>
                    <span className="w-5 h-5 border-b-2 border-r-2 border-indigo-400 rounded-br-md"></span>
                  </div>
                </div>
              )}

              {/* Initializing Spinner */}
              {isInitializing && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-3 p-4">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                  <div className="text-xs font-bold">Connecting to Camera Feed...</div>
                  <div className="text-[11px] text-slate-400 text-center max-w-xs">
                    Please allow camera access in browser popup if prompted.
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error Message Screen with Instant Native Device Camera Fallback */}
          {error && activePreviewIndex === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-5 text-center text-white gap-3 z-10">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="font-bold text-sm text-amber-200">
                {permissionDenied ? 'Camera Permission Required' : 'Live Camera Not Available'}
              </div>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed">{error}</p>

              {/* Seamless Action Choices */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                {/* 1. Pick Multiple from Android Gallery */}
                <button
                  type="button"
                  onClick={() => galleryMultiInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Images className="w-4 h-4" />
                  <span>Choose Multiple from Gallery</span>
                </button>

                {/* 2. Direct native camera trigger */}
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo via Native Camera</span>
                </button>

                {/* 3. Retry live stream */}
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>

              {permissionDenied && (
                <div className="text-[10px] text-slate-400 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 max-w-md mt-2 flex items-start gap-1.5 text-left">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Mobile tip:</strong> You can select any number of photos directly from your phone gallery or take pictures with your device camera without needing browser camera permission.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filmstrip of Staged Photos (Multiple Photos at a Time Queue) */}
        {stagedItems.length > 0 && (
          <div className="px-3 sm:px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                <Images className="w-3.5 h-3.5 text-indigo-400" />
                <span>Captured Batch ({stagedItems.length} photos ready)</span>
              </span>
              <span className="text-[10px] text-slate-400">Tap thumbnail to inspect</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {stagedItems.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => setActivePreviewIndex(idx)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 overflow-hidden shrink-0 cursor-pointer transition-all ${
                    activePreviewIndex === idx
                      ? 'border-indigo-400 ring-2 ring-indigo-500/50 scale-105'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] sm:text-[9px] font-bold text-center text-white py-0.5">
                    #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveStaged(item.id, e)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow-xs"
                    title="Remove this photo"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

              {/* Quick Add More Tile */}
              <button
                type="button"
                onClick={() => {
                  setActivePreviewIndex(null);
                  if (videoRef.current && streamRef.current) {
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-dashed border-slate-700 hover:border-indigo-400 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors cursor-pointer"
                title="Snap next photo"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                <span className="text-[9px] font-bold">Snap Next</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Controls Footer */}
        <div className="p-3 sm:p-4 bg-slate-800/95 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Left Action Buttons: Select multiple from gallery or Native camera */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => galleryMultiInputRef.current?.click()}
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Pick multiple photos at once from your phone gallery"
            >
              <Images className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] sm:text-xs">Gallery (Multiple)</span>
            </button>

            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Snap photo with Android native camera"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] sm:text-xs">Device Cam</span>
            </button>
          </div>

          {/* Right Action Buttons: Snap Live & Confirm Batch */}
          <div className="flex items-center gap-2">
            {stagedItems.length > 0 ? (
              <>
                {/* User can continue snapping or finish batch */}
                {activePreviewIndex === null && (
                  <button
                    type="button"
                    onClick={handleSnap}
                    disabled={isInitializing || Boolean(error)}
                    className="px-3 sm:px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Page #{stagedItems.length + 1}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmAll}
                  className="px-4 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Use All ({stagedItems.length}) Photos</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    stopTracks();
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSnap}
                  disabled={isInitializing || Boolean(error)}
                  className="px-4 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Photo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
