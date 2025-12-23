import { ref, shallowRef } from "vue";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

export type QualityPreset = "low" | "medium" | "high" | "original";

export interface ConversionOptions {
  fps?: number;
  quality?: QualityPreset;
  loop?: number;
}

const QUALITY_SETTINGS: Record<
  QualityPreset,
  { width: number; colors: number; fps: number }
> = {
  low: { width: 320, colors: 64, fps: 10 },
  medium: { width: 480, colors: 128, fps: 12 },
  high: { width: 720, colors: 256, fps: 15 },
  original: { width: 1280, colors: 256, fps: 12 }, // Max 1280px to avoid OOM in browser
};

export interface ConversionResult {
  blob: Blob;
  url: string;
  size: number;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const SUPPORTED_FORMATS = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
];

export function useFFmpeg() {
  const ffmpeg = shallowRef<FFmpeg | null>(null);
  const isLoading = ref(false);
  const isConverting = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);
  const isLoaded = ref(false);

  async function loadFFmpeg(): Promise<void> {
    if (ffmpeg.value && isLoaded.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");

      const instance = new FFmpeg();

      instance.on("log", ({ message }) => {
        console.log("[FFmpeg]", message);
      });

      instance.on("progress", ({ progress: p }) => {
        progress.value = Math.round(p * 100);
      });

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

      await instance.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });

      ffmpeg.value = instance;
      isLoaded.value = true;
    } catch (e) {
      error.value =
        "Nie udało się załadować FFmpeg. Sprawdź połączenie internetowe.";
      console.error("FFmpeg load error:", e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function validateFile(file: File): void {
    if (
      !SUPPORTED_FORMATS.includes(file.type) &&
      !file.name.match(/\.(mov|mp4|avi|webm)$/i)
    ) {
      throw new Error(
        "Nieobsługiwany format pliku. Użyj MP4, MOV, AVI lub WebM."
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `Plik jest za duży. Maksymalny rozmiar to ${
          MAX_FILE_SIZE / 1024 / 1024
        }MB.`
      );
    }
  }

  async function convertToGif(
    file: File,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const { quality = "high", fps: customFps, loop = 0 } = options;
    const settings = QUALITY_SETTINGS[quality];
    const fps = customFps ?? settings.fps;
    const { width, colors } = settings;

    error.value = null;
    progress.value = 0;
    isConverting.value = true;

    try {
      validateFile(file);

      if (!ffmpeg.value || !isLoaded.value) {
        await loadFFmpeg();
      }

      const instance = ffmpeg.value!;
      const inputExt = file.name.split(".").pop() || "mp4";
      const inputName = `input.${inputExt}`;
      const outputName = "output.gif";

      const { fetchFile } = await import("@ffmpeg/util");
      await instance.writeFile(inputName, await fetchFile(file));

      // Build filter with scale - always scale to prevent OOM on large videos
      const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${colors}[p];[s1][p]paletteuse=dither=floyd_steinberg`;

      await instance.exec([
        "-i",
        inputName,
        "-vf",
        vf,
        "-loop",
        String(loop),
        outputName,
      ]);

      const data = await instance.readFile(outputName);
      const blob = new Blob([new Uint8Array(data as Uint8Array)], {
        type: "image/gif",
      });
      const url = URL.createObjectURL(blob);

      // Cleanup
      await instance.deleteFile(inputName);
      await instance.deleteFile(outputName);

      return {
        blob,
        url,
        size: blob.size,
      };
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Wystąpił nieznany błąd podczas konwersji.";
      error.value = message;
      throw e;
    } finally {
      isConverting.value = false;
      progress.value = 0;
    }
  }

  function cleanup(url: string): void {
    URL.revokeObjectURL(url);
  }

  return {
    isLoading,
    isConverting,
    isLoaded,
    progress,
    error,
    loadFFmpeg,
    convertToGif,
    cleanup,
  };
}
