<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import {
  useFFmpeg,
  type ConversionResult,
  type QualityPreset,
} from "./composables/useFFmpeg";

const {
  isLoading,
  isConverting,
  progress,
  error: ffmpegError,
  convertToGif,
  cleanup,
} = useFFmpeg();

const selectedFile = ref<File | null>(null);
const isDragOver = ref(false);
const result = ref<ConversionResult | null>(null);
const toast = ref<{ message: string; type: "success" | "error" } | null>(null);
const selectedQuality = ref<QualityPreset>("high");

const qualityOptions: { value: QualityPreset; label: string; desc: string }[] =
  [
    { value: "low", label: "Niska", desc: "320px • mały plik" },
    { value: "medium", label: "Średnia", desc: "480px • balans" },
    { value: "high", label: "Wysoka", desc: "720px • dobra jakość" },
    { value: "original", label: "Max", desc: "1280px • duży plik" },
  ];

const isProcessing = computed(() => isLoading.value || isConverting.value);
const canConvert = computed(() => selectedFile.value && !isProcessing.value);

const fileInfo = computed(() => {
  if (!selectedFile.value) return null;
  const size = selectedFile.value.size;
  const sizeStr =
    size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / 1024 / 1024).toFixed(1)} MB`;
  return {
    name: selectedFile.value.name,
    size: sizeStr,
  };
});

const resultInfo = computed(() => {
  if (!result.value) return null;
  const size = result.value.size;
  const sizeStr =
    size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / 1024 / 1024).toFixed(1)} MB`;
  return { size: sizeStr };
});

function showToast(message: string, type: "success" | "error") {
  toast.value = { message, type };
  setTimeout(() => {
    toast.value = null;
  }, 4000);
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;

  const file = e.dataTransfer?.files[0];
  if (file && isVideoFile(file)) {
    selectFile(file);
  } else {
    showToast("Wybierz plik wideo (MP4, MOV, AVI, WebM)", "error");
  }
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    selectFile(file);
  }
  input.value = "";
}

function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") || /\.(mov|mp4|avi|webm)$/i.test(file.name)
  );
}

function selectFile(file: File) {
  if (result.value) {
    cleanup(result.value.url);
    result.value = null;
  }
  selectedFile.value = file;
}

function clearFile() {
  selectedFile.value = null;
  if (result.value) {
    cleanup(result.value.url);
    result.value = null;
  }
}

async function handleConvert() {
  if (!selectedFile.value) return;

  try {
    result.value = await convertToGif(selectedFile.value, {
      quality: selectedQuality.value,
    });
    showToast("Konwersja zakończona pomyślnie!", "success");
  } catch {
    showToast(ffmpegError.value || "Wystąpił błąd podczas konwersji", "error");
  }
}

function downloadGif() {
  if (!result.value || !selectedFile.value) return;

  const a = document.createElement("a");
  a.href = result.value.url;
  a.download = selectedFile.value.name.replace(/\.[^.]+$/, ".gif");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

onUnmounted(() => {
  if (result.value) {
    cleanup(result.value.url);
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6">
    <div class="w-full max-w-xl">
      <!-- Header -->
      <header class="text-center mb-10">
        <div class="inline-flex items-center gap-3 mb-4">
          <div
            class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center"
          >
            <svg
              class="w-7 h-7 text-zinc-950"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 class="text-3xl font-bold tracking-tight">Video to GIF</h1>
        </div>
        <p class="text-zinc-400 text-sm">
          Konwertuj pliki wideo na animowane GIFy w przeglądarce
        </p>
      </header>

      <!-- Main Card -->
      <div
        class="bg-zinc-900/60 backdrop-blur-sm rounded-3xl border border-zinc-800 p-8"
      >
        <!-- Drop Zone -->
        <div
          v-if="!result"
          class="drop-zone"
          :class="{ active: isDragOver }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @click="($refs.fileInput as HTMLInputElement).click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mov,.mp4,.avi,.webm"
            class="hidden"
            @change="handleFileInput"
          />

          <div class="text-center">
            <div
              class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center"
            >
              <svg
                class="w-8 h-8 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p class="text-zinc-200 font-medium mb-1">
              Przeciągnij plik wideo tutaj
            </p>
            <p class="text-zinc-500 text-sm">lub kliknij, aby wybrać</p>
            <p class="text-zinc-600 text-xs mt-3">
              MP4, MOV, AVI, WebM • max 100MB
            </p>
          </div>
        </div>

        <!-- File Info -->
        <div
          v-if="fileInfo && !result"
          class="mt-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0"
              >
                <svg
                  class="w-5 h-5 text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-zinc-100 font-medium truncate">
                  {{ fileInfo.name }}
                </p>
                <p class="text-zinc-500 text-sm">{{ fileInfo.size }}</p>
              </div>
            </div>
            <button
              @click.stop="clearFile"
              class="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
              :disabled="isProcessing"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Quality Selector -->
        <div v-if="fileInfo && !result" class="mt-4">
          <label class="block text-sm text-zinc-400 mb-2">Jakość GIF</label>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="option in qualityOptions"
              :key="option.value"
              @click="selectedQuality = option.value"
              :disabled="isProcessing"
              :class="[
                'p-3 rounded-xl border text-left transition-all duration-200',
                selectedQuality === option.value
                  ? 'border-orange-500 bg-orange-500/10 text-zinc-100'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300',
                isProcessing && 'opacity-50 cursor-not-allowed',
              ]"
            >
              <span class="block text-sm font-medium">{{ option.label }}</span>
              <span class="block text-xs opacity-70 mt-0.5">{{
                option.desc
              }}</span>
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="isProcessing" class="mt-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-zinc-400">
              {{ isLoading ? "Ładowanie FFmpeg..." : "Konwertowanie..." }}
            </span>
            <span class="text-sm font-mono text-orange-400"
              >{{ progress }}%</span
            >
          </div>
          <div class="progress-bar">
            <div
              class="progress-bar-fill"
              :class="{ 'animate-pulse-glow': isLoading }"
              :style="{ width: isLoading ? '100%' : `${progress}%` }"
            />
          </div>
        </div>

        <!-- Convert Button -->
        <button
          v-if="selectedFile && !result"
          @click="handleConvert"
          :disabled="!canConvert"
          class="btn-primary w-full mt-6"
        >
          <span v-if="isLoading">Ładowanie FFmpeg...</span>
          <span v-else-if="isConverting">Konwertowanie...</span>
          <span v-else>Konwertuj na GIF</span>
        </button>

        <!-- Result Preview -->
        <div v-if="result" class="space-y-6">
          <div
            class="relative rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700"
          >
            <img
              :src="result.url"
              alt="Wygenerowany GIF"
              class="w-full max-h-80 object-contain"
            />
          </div>

          <div
            class="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p class="text-zinc-100 font-medium">GIF gotowy!</p>
                <p class="text-zinc-500 text-sm">{{ resultInfo?.size }}</p>
              </div>
            </div>
          </div>

          <div class="flex gap-3">
            <button
              @click="downloadGif"
              class="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Pobierz GIF
            </button>
            <button @click="clearFile" class="btn-secondary">Nowy plik</button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="mt-8 text-center">
        <p class="text-zinc-600 text-xs">
          Wszystko działa lokalnie w przeglądarce • Twoje pliki nie są
          przesyłane na serwer
        </p>
      </footer>
    </div>

    <!-- Toast -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-4"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="toast"
        :class="[
          'toast',
          toast.type === 'success' ? 'toast-success' : 'toast-error',
        ]"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>
