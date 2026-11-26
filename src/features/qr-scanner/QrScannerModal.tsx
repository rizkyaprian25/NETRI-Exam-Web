'use client';

// Pemindai QR Code Soal Ujian via Kamera WebRTC (1:1 dengan qr_scanner_screen.dart)
// Mendukung BarcodeDetector native browser serta fallback jsQR untuk iOS Safari,
// lengkap dengan kontrol senter (torch), ganti kamera depan/belakang, dan unggah gambar QR.

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  Flashlight,
  ImagePlus,
  QrCode,
  SwitchCamera,
  X,
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

export function QrScannerModal({ isOpen, onClose, onDetected }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const detectedRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPermissionIntro, setShowPermissionIntro] = useState(true);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleScanSuccess = useCallback(
    (rawValue: string) => {
      if (detectedRef.current) return;
      const trimmed = rawValue.trim();
      if (!trimmed) return;
      detectedRef.current = true;
      stopCamera();
      onDetected(trimmed);
    },
    [onDetected, stopCamera],
  );

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    detectedRef.current = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Browser Anda tidak mendukung akses kamera langsung. Gunakan tombol unggah gambar QR di bawah.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play();
      }

      const [track] = stream.getVideoTracks();
      if (track && typeof track.getCapabilities === 'function') {
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        setHasTorch(Boolean(caps.torch));
      }
    } catch {
      setCameraError(
        'Izin kamera ditolak atau kamera tidak tersedia. Pastikan izin kamera aktif di browser, atau unggah foto QR Code.',
      );
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setShowPermissionIntro(true);
      setCameraError(null);
      return;
    }

    if (!showPermissionIntro) {
      void startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, showPermissionIntro, startCamera, stopCamera]);

  // Loop pemindaian frame QR setiap 200ms tanpa membebani main thread
  useEffect(() => {
    if (!isOpen || showPermissionIntro || cameraError) return;

    const winWithDetector = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
    const detector = winWithDetector.BarcodeDetector
      ? new winWithDetector.BarcodeDetector({ formats: ['qr_code'] })
      : null;

    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || detectedRef.current) return;

      try {
        if (detector) {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          if (value) {
            handleScanSuccess(value);
            return;
          }
        }

        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width <= 0 || height <= 0) return;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const decoded = jsQR(imageData.data, width, height);
        if (decoded?.data) {
          handleScanSuccess(decoded.data);
        }
      } catch {
        // Abaikan kegagalan pembacaan frame tunggal
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [cameraError, handleScanSuccess, isOpen, showPermissionIntro]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !hasTorch) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // Abaikan jika hardware menolak toggle lampu kilat
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const decoded = jsQR(imageData.data, bitmap.width, bitmap.height);
      if (decoded?.data) {
        handleScanSuccess(decoded.data);
      } else {
        setCameraError('QR Code tidak terbaca pada gambar tersebut. Coba gambar yang lebih jelas.');
      }
    } catch {
      setCameraError('Gagal membaca berkas gambar QR Code.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR Code Ujian"
    >
      {/* Header Modal Scanner */}
      <header className="flex h-14 items-center justify-between border-b border-white/15 px-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-[#7AA2FF]" aria-hidden="true" />
          <h2 className="text-base font-bold">Scan QR Code Ujian</h2>
        </div>

        <div className="flex items-center gap-1">
          {!showPermissionIntro && hasTorch && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-label="Nyalakan atau matikan senter"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors ${
                torchOn ? 'bg-amber-500/20 text-amber-300' : 'text-white hover:bg-white/10'
              }`}
            >
              <Flashlight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {!showPermissionIntro && (
            <button
              type="button"
              onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
              aria-label="Putar kamera depan atau belakang"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-white hover:bg-white/10"
            >
              <SwitchCamera className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Tutup pemindai QR"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Body Pemindai */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {showPermissionIntro ? (
          /* Apple HIG Pre-permission Contextual Sheet sebelum memicu dialog izin kamera browser */
          <div className="w-full max-w-sm rounded-lg border border-white/15 bg-[#171B22] p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A4FD6]/20 text-[#7AA2FF]">
              <Camera className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold">Izin Akses Kamera Diperlukan</h3>
            <p className="mt-2 text-sm text-white/75 leading-relaxed">
              NETRI Exam menggunakan kamera perangkat hanya untuk memindai QR Code tautan Google Form dari pengawas. Tidak ada foto atau video yang disimpan.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowPermissionIntro(false)}
                className="min-h-[48px] w-full rounded-md bg-[#1A4FD6] px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95"
              >
                Aktifkan Kamera &amp; Pindai
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                Unggah Gambar QR dari Galeri
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Frame bidik QR identik dengan versi Mobile */}
            {!cameraError && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute h-[260px] w-[260px] rounded-lg border-[3px] border-[#1A4FD6] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              />
            )}

            {cameraError && (
              <div className="absolute inset-x-4 mx-auto max-w-sm rounded-lg border border-red-400/40 bg-[#171B22]/95 p-5 text-center">
                <p className="text-sm text-red-200 leading-relaxed">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#1A4FD6] px-4 py-2.5 text-sm font-bold text-white"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  Pilih Gambar QR Code
                </button>
              </div>
            )}

            <div className="absolute bottom-8 inset-x-6 mx-auto flex max-w-md items-center justify-between gap-2 rounded-md border border-white/15 bg-black/80 px-4 py-3 text-xs font-medium text-white">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 shrink-0 text-[#7AA2FF]" aria-hidden="true" />
                <span>Arahkan kamera ke QR Code Google Form ujian</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-[#7AA2FF] hover:bg-white/10"
              >
                Galeri
              </button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleImageUpload(e)}
        />
      </div>
    </div>
  );
}
