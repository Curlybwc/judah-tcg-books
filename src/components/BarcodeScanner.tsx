import { useEffect, useRef, useState } from "react";

// In-app barcode scanner (Jen, 2026-11-07 — mined from Card Splitter). Uses
// the BarcodeDetector built into Chrome on Android; browsers without it get
// an honest message instead of a dead camera screen.
export default function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!supported) {
      setError("This browser can't scan barcodes in the app. Type the numbers under the barcode instead — that works just as well.");
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = videoRef.current;
        if (!v || stopped) return;
        v.srcObject = stream;
        await v.play();
        const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (s: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        const det = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await det.detect(v);
            if (codes && codes.length > 0) {
              if (navigator.vibrate) navigator.vibrate(120);
              onCode(codes[0].rawValue);
              return;
            }
          } catch { /* keep trying */ }
          timer = setTimeout(() => void tick(), 150);
        };
        void tick();
      } catch {
        setError("Couldn't open the camera. Check that this site has camera permission, or type the barcode numbers instead.");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-5">
      <p className="text-white font-black text-lg mb-3">Point the camera at the barcode</p>
      {error ? (
        <p className="text-slate-300 text-center max-w-sm">{error}</p>
      ) : (
        <video ref={videoRef} playsInline muted className="w-full max-w-sm rounded-3xl border-4 border-yellow-400 bg-black aspect-[3/4] object-cover" />
      )}
      <button onClick={onClose} className="mt-5 rounded-2xl bg-slate-800 border border-slate-600 text-white px-8 py-3.5 font-bold">Cancel</button>
    </div>
  );
}
