// ---------- Constants ----------
const PLATFORMS = [
  { id: "sora2", label: "Sora 2 (OpenAI)" },
  { id: "veo3", label: "Google Veo 3" },
  { id: "kling", label: "Kling AI" },
  { id: "runway", label: "Runway Gen-4" },
  { id: "generic", label: "عمومی / همه پلتفرم‌ها" },
];

const ASPECTS = ["16:9", "9:16", "1:1", "21:9"];
const DURATIONS = ["۴ ثانیه", "۸ ثانیه", "۱۰ ثانیه", "۱۵ ثانیه", "۳۰ ثانیه", "نامشخص"];

const STYLE_PRESETS = [
  { id: "cinematic_realistic", label: "Cinematic Realistic", desc: "کاملاً واقعی، مثل فیلم سینمایی", descriptor: "cinematic realistic style, true-to-life live-action film quality, natural realistic detail and lighting" },
  { id: "comedy", label: "Funny / Comedy", desc: "تأکید روی واکنش‌های بامزه و زمان‌بندی کمدی", descriptor: "comedic style, funny exaggerated reactions, sharp comedic timing" },
  { id: "photorealistic", label: "Photorealistic", desc: "محیط و سوژه‌ها بسیار شبیه فیلم واقعی", descriptor: "photorealistic style, hyper-real detail, live-action quality rendering" },
  { id: "3d_animation", label: "3D Animation", desc: "شبیه انیمیشن‌های سه‌بعدی، جذاب و فانتزی", descriptor: "3D animated style, CGI rendered, playful fantastical character design" },
  { id: "pixar", label: "Pixar-like Animation", desc: "حالت انیمیشن خانوادگی و احساسی", descriptor: "Pixar-style 3D animation, warm family-friendly emotional storytelling, soft rounded character design" },
  { id: "cartoon", label: "Cartoon", desc: "رنگارنگ و اغراق‌شده، مناسب محتوای طنز", descriptor: "cartoon style, colorful exaggerated character design, playful comedic visuals" },
  { id: "tiktok", label: "Viral TikTok Style", desc: "کات‌های سریع، زوم و واکنش‌های اغراق‌شده", descriptor: "viral TikTok style, fast quick cuts, snappy zooms, exaggerated reactions, social-media pacing" },
  { id: "mockumentary", label: "Mockumentary", desc: "فیلم‌برداری شبیه مستند، با اتفاقات کمدی", descriptor: "mockumentary style, documentary-style handheld camera with comedic staged events, faux-interview cutaways" },
  { id: "slapstick", label: "Slapstick Comedy", desc: "کمدی فیزیکی و اغراق در حرکات و واکنش‌ها", descriptor: "slapstick physical comedy, exaggerated movements and reactions, comedic physical timing" },
];

// ---------- State ----------
const state = {
  idea: "",
  images: [], // {id, previewUrl, base64, mediaType}
  platform: "sora2",
  aspect: "16:9",
  duration: "۸ ثانیه",
  styleNotes: "",
  outputLang: "en",
  provider: "gemini",
  splitEnabled: false,
  segmentCount: 2,
  preserveFaces: true,
  hasDialogue: false,
  musicEnabled: false,
  musicStyle: "",
  selectedPreset: null,
  loading: false,
  result: "",

  videoFileName: "",
  extractedFrames: [],
  extractingFrames: false,
  videoAnalyzing: false,
  videoResult: "",
  videoError: "",

  lipsyncImage: null,
  lipsyncVideoFrames: [],
  lipsyncMusicFile: null,
  swapVideoFrames: [],
  swapImage: null,
};

// ---------- Helpers ----------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود"));
    reader.readAsDataURL(file);
  });
}

function extractVideoFrames(file, frameCount = 4) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 0;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        const timestamps = Array.from({ length: frameCount }, (_, i) =>
          Math.min(duration * (i / Math.max(frameCount - 1, 1)), Math.max(duration - 0.05, 0))
        );
        const frames = [];
        for (const t of timestamps) {
          await new Promise((res) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              res();
            };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = t;
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          frames.push({
            id: Math.random().toString(36).slice(2),
            dataUrl,
            base64: dataUrl.split(",")[1],
            mediaType: "image/jpeg",
          });
        }
        cleanup();
        resolve(frames);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("خواندن ویدیو ناموفق بود"));
    };
  });
}

async function callAI(system, messages) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: state.provider, system, messages, max_tokens: 1000 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطا در ارتباط با سرور");
  const text = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");
  if (!text.trim()) throw new Error("پاسخی دریافت نشد");
  return text.trim();
}

// ---------- Prompt builders ----------
function buildSystemPrompt() {
  const langInstruction =
    state.outputLang === "en"
      ? "Write the entire output in English, since text-to-video models parse English prompts most reliably."
      : "Write the entire output in Persian (Farsi), matching the user's language, but keep technical camera/lens terminology in English where that is standard industry practice.";

  const sectionList = [
    "LOGLINE — one vivid sentence capturing the whole shot/scene.",
    "SCENE & SETTING — location, time of day, environment detail, set dressing.",
    "SUBJECT(S) — who/what is in frame, appearance, wardrobe, expression, referencing the uploaded images where relevant.",
    "ACTION & TIMELINE — what happens, broken into a beginning/middle/end within the segment duration, described as continuous motion.",
    "CAMERA — shot type, framing, lens feel, camera movement (dolly/pan/handheld/crane/static), depth of field.",
    "LIGHTING & COLOR — light sources, direction, color grade, contrast, mood of the palette.",
    "ATMOSPHERE & STYLE — overall mood, genre/film reference touchstones, texture (film grain, digital clean, anamorphic, etc).",
  ];

  if (state.musicEnabled) {
    sectionList.push("MUSIC — specific genre, instrumentation, tempo/BPM feel, and how the musical energy arcs and syncs to the on-screen action across the clip.");
    sectionList.push("SOUND DESIGN — ambient sound and diegetic sound cues layered under the music.");
  } else {
    sectionList.push("AUDIO NOTES — ambient sound and diegetic sound cues (no music track; describe only environmental/atmospheric sound).");
  }
  sectionList.push("NEGATIVE / AVOID — artifacts, elements, or qualities to avoid (only include if the platform supports negative prompting; otherwise omit this section).");

  const faceInstruction = state.preserveFaces
    ? `\nIDENTITY LOCK: Reference images contain the exact face(s)/character identity that must appear in every scene or segment, unchanged. In the SUBJECT(S) section, explicitly lock the facial features, hairstyle, and distinguishing traits shown in the reference images, and state that identity must remain 100% consistent across the entire video with no drift in facial structure. If multiple reference images show the same person from different angles, treat them as one locked identity reference, not separate characters.`
    : "";

  const dialogueInstruction = !state.hasDialogue
    ? `\nNO DIALOGUE: This video must contain no spoken dialogue, no lip movement implying speech, and no on-screen text or subtitles. Describe the storytelling as purely visual — expression, gesture, and action carry the meaning. Add "no dialogue, no lip-sync, no spoken words, no subtitles" to the NEGATIVE / AVOID section.`
    : `\nDIALOGUE ALLOWED: This video may include spoken dialogue or vocal lines. In the ACTION & TIMELINE section, write short, natural, in-character lines of dialogue exactly as they should be spoken, with clear speaker attribution and timing, so a model with lip-sync/voice capability can use them directly.`;

  const musicInstruction = state.musicEnabled
    ? `\nMUSIC REQUIRED: The user wants an original music track guiding the video.${
        state.musicStyle.trim() ? ` Requested music direction: "${state.musicStyle.trim()}".` : " No specific style was given, so choose music that best fits the mood, genre, and pacing of the scene."
      } Describe the MUSIC section with enough detail (instrumentation, tempo, emotional arc, key sync points with the visual action) that a composer or a music-generation model could realize it.`
    : "";

  const platformLabel = PLATFORMS.find((p) => p.id === state.platform)?.label;

  if (!state.splitEnabled) {
    return `You are an elite AI video-generation prompt engineer. You specialize in translating a rough creative idea and reference images into an extremely detailed, production-ready prompt for text-to-video AI models (such as Sora, Veo, Kling, or Runway).

The user will give you:
- A general idea for a video
- Optional reference images (for style, subject, composition, mood, or face/identity reference)
- Target platform: ${platformLabel}
- Aspect ratio: ${state.aspect}
- Target duration: ${state.duration}
- Optional extra style notes

Your job: produce ONE finished, copy-paste-ready video generation prompt, structured with these labeled sections (use these exact uppercase labels, each on its own line, followed by tightly written descriptive detail — not bullet fragments but flowing cinematic description):

${sectionList.join("\n")}
${faceInstruction}${dialogueInstruction}${musicInstruction}

${langInstruction}

Be maximally specific and sensory — a reader should be able to visualize the exact shot. Do not add any preamble, meta-commentary, or markdown formatting like asterisks or headers with #. Just the labeled plain-text sections as specified. Do not explain your reasoning.`;
  }

  return `You are an elite AI video-generation prompt engineer. You specialize in translating a rough creative idea and reference images into a CHAIN of sequential, production-ready prompts for text-to-video AI models (such as Sora, Veo, Kling, or Runway), designed for platforms that support image-to-video continuation.

The user will give you:
- A general idea for a video (the full story arc, to be split across multiple short clips)
- Optional reference images (for style, subject, composition, mood, or face/identity reference)
- Target platform: ${platformLabel}
- Aspect ratio: ${state.aspect}
- Duration per segment: ${state.duration}
- Number of segments to split the idea into: ${state.segmentCount}
- Optional extra style notes

Your job: break the overall idea into exactly ${state.segmentCount} sequential clips that together tell the full story with zero visual discontinuity. Output each segment starting with a line EXACTLY in this format (nothing else on that line):
### SEGMENT <n> ###

Then, for each segment, write the labeled sections below:

${sectionList.join("\n")}
CONTINUITY — for segment 1, describe the exact opening frame in full detail (this frame will be captured and reused). For every segment after the first, explicitly instruct: "Begin this clip from the final frame of the previous clip (use it as the image-to-video starting reference)" and state precisely which elements must remain pixel-identical to that last frame (character position/identity, wardrobe, environment, lighting, camera framing) before the new motion begins.
${faceInstruction}${dialogueInstruction}${musicInstruction}

${langInstruction}

Be maximally specific and sensory. Each segment must read as a standalone, complete prompt a user can paste directly into a video model, while still connecting seamlessly to its neighbors. Do not add any preamble, meta-commentary, or markdown formatting like asterisks or headers with #, other than the required "### SEGMENT <n> ###" markers. Do not explain your reasoning.`;
}

function buildAnalysisSystemPrompt() {
  const langInstruction =
    state.outputLang === "en"
      ? "Write the entire output in English."
      : "Write the entire output in Persian (Farsi), but keep technical camera/lens terminology in English where that is standard industry practice.";

  const sectionList = [
    "LOGLINE — one vivid sentence capturing the whole shot/scene.",
    "SCENE & SETTING — location, time of day, environment detail, set dressing.",
    "SUBJECT(S) — who/what is in frame, appearance, wardrobe, expression.",
    "ACTION & TIMELINE — what happens across the clip, described as continuous motion inferred from the sequence of frames.",
    "CAMERA — shot type, framing, lens feel, camera movement, depth of field.",
    "LIGHTING & COLOR — light sources, direction, color grade, contrast, mood of the palette.",
    "ATMOSPHERE & STYLE — overall mood, genre/film reference touchstones, texture (film grain, digital clean, anamorphic, etc).",
    state.musicEnabled
      ? "MUSIC — plausible genre, instrumentation, tempo/BPM feel matching the footage's energy."
      : "AUDIO NOTES — plausible ambient/diegetic sound cues matching the footage.",
    "NEGATIVE / AVOID — artifacts or qualities to avoid when regenerating this footage.",
  ];

  const faceInstruction = state.preserveFaces
    ? "\nIDENTITY LOCK: If a person/face appears, describe their exact facial features, hairstyle, and distinguishing traits in the SUBJECT(S) section precisely, and state identity must remain fully consistent if regenerated."
    : "";
  const dialogueInstruction = !state.hasDialogue
    ? '\nNO DIALOGUE: Regardless of what is seen, instruct that the regenerated video must contain no spoken dialogue, no lip-sync, no on-screen text. Add "no dialogue, no lip-sync, no subtitles" to NEGATIVE / AVOID.'
    : "\nDIALOGUE ALLOWED: If any speech or lip movement is visible in the frames, transcribe or plausibly reconstruct short natural dialogue lines with speaker attribution in the ACTION & TIMELINE section, timed to match the footage.";

  const platformLabel = PLATFORMS.find((p) => p.id === state.platform)?.label;

  return `You are an elite AI video-generation prompt engineer specializing in reverse-engineering prompts from real footage. You are given ${state.extractedFrames.length} frames extracted in chronological order (start to end) from an actual video clip. Your job is to write the exact detailed prompt that, if given to a text-to-video AI model (target platform: ${platformLabel}, aspect ratio ${state.aspect}), would regenerate this same footage as closely as possible.

Only describe what is visible or strongly implied by comparing the frames — do not invent unrelated plot details. Infer the motion happening between frames as smooth continuous action.

Structure the output with these exact uppercase section labels, each followed by flowing descriptive detail:

${sectionList.join("\n")}
${faceInstruction}${dialogueInstruction}

${langInstruction}

Do not add any preamble, meta-commentary, or markdown formatting like asterisks or headers with #. Just the labeled plain-text sections. Do not explain your reasoning.`;
}

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const ideaInput = $("ideaInput");
const stylePresetsRow = $("stylePresetsRow");
const styleDesc = $("styleDesc");
const imagesRow = $("imagesRow");
const imageInput = $("imageInput");
const imageCount = $("imageCount");
const platformSelect = $("platformSelect");
const aspectSelect = $("aspectSelect");
const durationSelect = $("durationSelect");
const styleNotesInput = $("styleNotesInput");
const langEnBtn = $("langEnBtn");
const langFaBtn = $("langFaBtn");
const providerClaudeBtn = $("providerClaudeBtn");
const providerGeminiBtn = $("providerGeminiBtn");
const splitToggle = $("splitToggle");
const preserveFacesToggle = $("preserveFacesToggle");
const dialogueToggle = $("dialogueToggle");
const dialogueSub = $("dialogueSub");
const musicToggle = $("musicToggle");
const musicStyleInput = $("musicStyleInput");
const errorBox = $("errorBox");
const generateBtn = $("generateBtn");
const resetBtn = $("resetBtn");
const copyAllBtn = $("copyAllBtn");
const outputContent = $("outputContent");

const moreBtn = $("moreBtn");
const moreModal = $("moreModal");
const closeModalBtn = $("closeModalBtn");
const moreFeatureList = $("moreFeatureList");
const videoFileBtn = $("videoFileBtn");
const videoFileInput = $("videoFileInput");
const extractingIndicator = $("extractingIndicator");
const framesRow = $("framesRow");
const videoErrorBox = $("videoErrorBox");
const analyzeVideoBtn = $("analyzeVideoBtn");
const videoResultBox = $("videoResultBox");
const videoResultText = $("videoResultText");
const videoCopyBtn = $("videoCopyBtn");

const lipsyncImageRow = $("lipsyncImageRow");
const lipsyncImageInput = $("lipsyncImageInput");
const lipsyncVideoBtn = $("lipsyncVideoBtn");
const lipsyncVideoInput = $("lipsyncVideoInput");
const lipsyncVideoExtracting = $("lipsyncVideoExtracting");
const lipsyncVideoFramesRow = $("lipsyncVideoFramesRow");
const lipsyncMusicDesc = $("lipsyncMusicDesc");
const lipsyncMusicFileBtn = $("lipsyncMusicFileBtn");
const lipsyncMusicFileInput = $("lipsyncMusicFileInput");
const lipsyncLyrics = $("lipsyncLyrics");
const lipsyncErrorBox = $("lipsyncErrorBox");
const lipsyncGenerateBtn = $("lipsyncGenerateBtn");
const lipsyncResultBox = $("lipsyncResultBox");
const lipsyncResultText = $("lipsyncResultText");
const lipsyncCopyBtn = $("lipsyncCopyBtn");

const swapVideoBtn = $("swapVideoBtn");
const swapVideoInput = $("swapVideoInput");
const swapExtractingIndicator = $("swapExtractingIndicator");
const swapFramesRow = $("swapFramesRow");
const swapImageRow = $("swapImageRow");
const swapImageInput = $("swapImageInput");
const swapErrorBox = $("swapErrorBox");
const swapGenerateBtn = $("swapGenerateBtn");
const swapResultBox = $("swapResultBox");
const swapResultText = $("swapResultText");
const swapCopyBtn = $("swapCopyBtn");

const titlesTopicInput = $("titlesTopicInput");
const titlesErrorBox = $("titlesErrorBox");
const titlesGenerateBtn = $("titlesGenerateBtn");
const titlesResultBox = $("titlesResultBox");
const titlesResultText = $("titlesResultText");
const titlesCopyBtn = $("titlesCopyBtn");

// ---------- Init static UI ----------
function initSelects() {
  platformSelect.innerHTML = PLATFORMS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  platformSelect.value = state.platform;

  aspectSelect.innerHTML = ASPECTS.map((a) => `<option value="${a}">${a}</option>`).join("");
  aspectSelect.value = state.aspect;

  durationSelect.innerHTML = DURATIONS.map((d) => `<option value="${d}">${d}</option>`).join("");
  durationSelect.value = state.duration;
}

function renderStylePresets() {
  stylePresetsRow.innerHTML = STYLE_PRESETS.map(
    (p) => `<button class="pill${state.selectedPreset === p.id ? " active" : ""}" data-id="${p.id}">${p.label}</button>`
  ).join("");
  styleDesc.textContent = state.selectedPreset
    ? STYLE_PRESETS.find((p) => p.id === state.selectedPreset)?.desc
    : "یک سبک را انتخاب کن تا به پرامت اضافه شود (اختیاری)";
}

function renderImages() {
  imageCount.textContent = `${state.images.length}/4`;
  const thumbs = state.images
    .map(
      (img) => `<div class="thumb" data-id="${img.id}">
        <img src="${img.previewUrl}" alt="" />
        <button class="remove-btn" data-remove="${img.id}">✕</button>
      </div>`
    )
    .join("");
  const addBtn =
    state.images.length < 4 ? `<button class="add-image-btn" id="addImageBtn">⬆<span>افزودن</span></button>` : "";
  imagesRow.innerHTML = thumbs + addBtn;

  const addImageBtn = $("addImageBtn");
  if (addImageBtn) addImageBtn.addEventListener("click", () => imageInput.click());
  imagesRow.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.images = state.images.filter((i) => i.id !== btn.dataset.remove);
      renderImages();
    });
  });
}

function setSwitch(el, active) {
  el.classList.toggle("active", active);
}

// ---------- Event bindings ----------
ideaInput.addEventListener("input", (e) => (state.idea = e.target.value));
styleNotesInput.addEventListener("input", (e) => (state.styleNotes = e.target.value));
musicStyleInput.addEventListener("input", (e) => (state.musicStyle = e.target.value));

platformSelect.addEventListener("change", (e) => (state.platform = e.target.value));
aspectSelect.addEventListener("change", (e) => (state.aspect = e.target.value));
durationSelect.addEventListener("change", (e) => (state.duration = e.target.value));

langEnBtn.addEventListener("click", () => {
  state.outputLang = "en";
  langEnBtn.classList.add("active");
  langFaBtn.classList.remove("active");
});
langFaBtn.addEventListener("click", () => {
  state.outputLang = "fa";
  langFaBtn.classList.add("active");
  langEnBtn.classList.remove("active");
});

providerClaudeBtn.addEventListener("click", () => {
  state.provider = "anthropic";
  providerClaudeBtn.classList.add("active");
  providerGeminiBtn.classList.remove("active");
});
providerGeminiBtn.addEventListener("click", () => {
  state.provider = "gemini";
  providerGeminiBtn.classList.add("active");
  providerClaudeBtn.classList.remove("active");
});

stylePresetsRow.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-id]");
  if (!btn) return;
  state.selectedPreset = state.selectedPreset === btn.dataset.id ? null : btn.dataset.id;
  renderStylePresets();
});

imageInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []).slice(0, 4 - state.images.length);
  e.target.value = "";
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    try {
      const base64 = await fileToBase64(file);
      state.images.push({
        id: Math.random().toString(36).slice(2),
        previewUrl: URL.createObjectURL(file),
        base64,
        mediaType: file.type,
      });
    } catch (err) {
      showError("بارگذاری تصویر با خطا مواجه شد.");
    }
  }
  renderImages();
});

splitToggle.addEventListener("click", () => {
  state.splitEnabled = !state.splitEnabled;
  setSwitch(splitToggle, state.splitEnabled);
});

preserveFacesToggle.addEventListener("click", () => {
  state.preserveFaces = !state.preserveFaces;
  setSwitch(preserveFacesToggle, state.preserveFaces);
});

dialogueToggle.addEventListener("click", () => {
  state.hasDialogue = !state.hasDialogue;
  setSwitch(dialogueToggle, state.hasDialogue);
  dialogueSub.textContent = state.hasDialogue
    ? "روشن — شخصیت‌ها می‌توانند صحبت کنند"
    : "خاموش — ویدیو بدون هیچ صحبت یا لب‌زدنی خواهد بود";
});

musicToggle.addEventListener("click", () => {
  state.musicEnabled = !state.musicEnabled;
  setSwitch(musicToggle, state.musicEnabled);
  musicStyleInput.classList.toggle("hidden", !state.musicEnabled);
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

// ---------- Generate ----------
function parseSegments(text) {
  const parts = text.split(/###\s*SEGMENT\s*(\d+)\s*###/i);
  if (parts.length <= 1) return [{ label: null, text: text.trim() }];
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    const t = (parts[i + 1] || "").trim();
    if (t) out.push({ label: `SEGMENT ${parts[i]}`, text: t });
  }
  return out.length > 0 ? out : [{ label: null, text: text.trim() }];
}

function renderResult() {
  const loadingBar = $("loadingBar");
  loadingBar.classList.toggle("hidden", !state.loading);
  if (state.loading) {
    outputContent.innerHTML = `<div class="loading-state"><div class="spinner">✨</div><p>در حال نگارش پرامت سینمایی...</p></div>`;
    copyAllBtn.classList.add("hidden");
    return;
  }
  if (!state.result) {
    outputContent.innerHTML = `<div class="placeholder"><div class="placeholder-icon">🎞️</div><p>ایده و در صورت تمایل عکس مرجع را وارد کن، پرامت دقیق و کامل اینجا نمایش داده می‌شود.</p></div>`;
    copyAllBtn.classList.add("hidden");
    return;
  }

  const segments = parseSegments(state.result);
  const dir = state.outputLang === "en" ? "ltr" : "rtl";

  outputContent.innerHTML = segments
    .map((seg, i) => {
      if (!seg.label) {
        return `<pre class="output-pre standalone" dir="${dir}">${escapeHtml(seg.text)}</pre>`;
      }
      return `<div class="segment-card">
        <div class="segment-header">
          <span class="segment-title">${seg.label}</span>
          <button class="btn-link" data-copy-seg="${i}">کپی</button>
        </div>
        <pre class="output-pre" dir="${dir}">${escapeHtml(seg.text)}</pre>
      </div>`;
    })
    .join("");

  copyAllBtn.classList.toggle("hidden", segments.length < 1);
  copyAllBtn.textContent = segments.length > 1 ? "کپی همه" : "کپی";

  outputContent.querySelectorAll("[data-copy-seg]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const seg = segments[Number(btn.dataset.copySeg)];
      navigator.clipboard.writeText(seg.text).then(() => flashCopied(btn));
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function flashCopied(btn) {
  const original = btn.textContent;
  btn.textContent = "کپی شد";
  setTimeout(() => (btn.textContent = original), 1500);
}

copyAllBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(state.result).then(() => flashCopied(copyAllBtn));
});

generateBtn.addEventListener("click", async () => {
  if (!state.idea.trim()) {
    showError("لطفاً ابتدا ایده کلی ویدیو را بنویسید.");
    return;
  }
  clearError();
  state.loading = true;
  state.result = "";
  generateBtn.disabled = true;
  renderResult();

  try {
    const contentBlocks = state.images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    }));

    const presetDescriptor = state.selectedPreset
      ? STYLE_PRESETS.find((p) => p.id === state.selectedPreset)?.descriptor
      : "";
    const combinedStyle = [state.styleNotes.trim(), presetDescriptor].filter(Boolean).join(", ");

    let userText = `ایده کلی ویدیو: ${state.idea.trim()}`;
    if (combinedStyle) userText += `\nیادداشت سبک/جزییات اضافه: ${combinedStyle}`;
    if (state.images.length > 0) {
      userText += `\n\n(${state.images.length} تصویر مرجع پیوست شده — از آن‌ها برای الهام گرفتن سبک، موضوع یا ترکیب‌بندی استفاده کن.)`;
      if (state.preserveFaces) userText += " چهره/هویت نشان داده‌شده در تصاویر باید بدون تغییر در تمام خروجی حفظ شود.";
    }
    if (state.splitEnabled) userText += `\n\nخروجی را به ${state.segmentCount} پرامت متوالی تقسیم کن که هرکدام از فریم پایانی قبلی ادامه پیدا کنند.`;
    if (!state.hasDialogue) userText += "\nهیچ دیالوگ یا صحبتی در ویدیو نباشد.";
    else userText += "\nدیالوگ در ویدیو مجاز است.";
    if (state.musicEnabled) userText += `\nموزیک اضافه کن.${state.musicStyle.trim() ? ` سبک موزیک مدنظر: ${state.musicStyle.trim()}` : ""}`;

    contentBlocks.push({ type: "text", text: userText });

    const text = await callAI(buildSystemPrompt(), [{ role: "user", content: contentBlocks }]);
    state.result = text;
  } catch (e) {
    showError("تولید پرامت ناموفق بود. لطفاً دوباره تلاش کنید.");
  } finally {
    state.loading = false;
    generateBtn.disabled = false;
    renderResult();
  }
});

resetBtn.addEventListener("click", () => {
  state.idea = "";
  state.styleNotes = "";
  state.images = [];
  state.result = "";
  state.selectedPreset = null;
  ideaInput.value = "";
  styleNotesInput.value = "";
  clearError();
  renderImages();
  renderStylePresets();
  renderResult();
});

// ---------- More modal: navigation between feature list and panels ----------
function showFeaturePanel(panelId) {
  moreFeatureList.classList.add("hidden");
  document.querySelectorAll(".feature-panel").forEach((p) => p.classList.add("hidden"));
  $(panelId).classList.remove("hidden");
}
function showFeatureList() {
  document.querySelectorAll(".feature-panel").forEach((p) => p.classList.add("hidden"));
  moreFeatureList.classList.remove("hidden");
}
moreFeatureList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-feature]");
  if (!btn) return;
  showFeaturePanel(btn.dataset.feature);
});
document.querySelectorAll(".feature-panel [data-back]").forEach((btn) => {
  btn.addEventListener("click", showFeatureList);
});

// ---------- More modal: video-to-prompt ----------
moreBtn.addEventListener("click", () => moreModal.classList.remove("hidden"));
moreModal.addEventListener("click", (e) => {
  if (e.target === moreModal) closeModal();
});
closeModalBtn.addEventListener("click", closeModal);

function closeModal() {
  moreModal.classList.add("hidden");
  showFeatureList();

  state.videoFileName = "";
  state.extractedFrames = [];
  state.videoResult = "";
  state.videoError = "";
  videoFileBtn.textContent = "⬆ انتخاب فایل ویدیو";
  framesRow.innerHTML = "";
  videoErrorBox.classList.add("hidden");
  videoResultBox.classList.add("hidden");
  analyzeVideoBtn.disabled = true;

  state.lipsyncImage = null;
  renderLipsyncImage();
  state.lipsyncVideoFrames = [];
  lipsyncVideoBtn.textContent = "⬆ انتخاب فایل ویدیو";
  lipsyncVideoFramesRow.innerHTML = "";
  state.lipsyncMusicFile = null;
  lipsyncMusicFileBtn.textContent = "⬆ انتخاب فایل صوتی";
  lipsyncMusicDesc.value = "";
  lipsyncLyrics.value = "";
  lipsyncErrorBox.classList.add("hidden");
  lipsyncResultBox.classList.add("hidden");

  state.swapVideoFrames = [];
  state.swapImage = null;
  swapVideoBtn.textContent = "⬆ انتخاب فایل ویدیو";
  swapFramesRow.innerHTML = "";
  renderSwapImage();
  swapErrorBox.classList.add("hidden");
  swapResultBox.classList.add("hidden");
  swapGenerateBtn.disabled = true;

  titlesTopicInput.value = "";
  titlesErrorBox.classList.add("hidden");
  titlesResultBox.classList.add("hidden");
}

videoFileBtn.addEventListener("click", () => videoFileInput.click());
videoFileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  videoErrorBox.classList.add("hidden");
  videoResultBox.classList.add("hidden");
  state.videoFileName = file.name;
  videoFileBtn.textContent = file.name;
  state.extractedFrames = [];
  framesRow.innerHTML = "";
  extractingIndicator.classList.remove("hidden");
  analyzeVideoBtn.disabled = true;

  try {
    const frames = await extractVideoFrames(file, 4);
    state.extractedFrames = frames;
    framesRow.innerHTML = frames.map((f) => `<img class="frame-thumb" src="${f.dataUrl}" alt="" />`).join("");
    analyzeVideoBtn.disabled = false;
  } catch (err) {
    videoErrorBox.textContent = "استخراج فریم از ویدیو ناموفق بود. فرمت فایل را بررسی کن.";
    videoErrorBox.classList.remove("hidden");
  } finally {
    extractingIndicator.classList.add("hidden");
  }
});

analyzeVideoBtn.addEventListener("click", async () => {
  if (state.extractedFrames.length === 0) return;
  state.videoAnalyzing = true;
  analyzeVideoBtn.disabled = true;
  analyzeVideoBtn.textContent = "در حال تحلیل ویدیو...";
  videoErrorBox.classList.add("hidden");
  videoResultBox.classList.add("hidden");

  try {
    const contentBlocks = state.extractedFrames.map((f) => ({
      type: "image",
      source: { type: "base64", media_type: f.mediaType, data: f.base64 },
    }));
    contentBlocks.push({
      type: "text",
      text: `این ${state.extractedFrames.length} فریم به ترتیب زمانی از یک ویدیوی واقعی استخراج شده‌اند. پرامت کامل و دقیقی بنویس که همین ویدیو را بازتولید کند.`,
    });

    const text = await callAI(buildAnalysisSystemPrompt(), [{ role: "user", content: contentBlocks }]);
    state.videoResult = text;
    videoResultText.textContent = text;
    videoResultBox.classList.remove("hidden");
  } catch (err) {
    videoErrorBox.textContent = "تولید پرامت از ویدیو ناموفق بود. دوباره تلاش کن.";
    videoErrorBox.classList.remove("hidden");
  } finally {
    state.videoAnalyzing = false;
    analyzeVideoBtn.disabled = false;
    analyzeVideoBtn.textContent = "استخراج پرامت کامل";
  }
});

videoCopyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(state.videoResult).then(() => flashCopied(videoCopyBtn));
});

// ---------- More modal: lip-sync & music ----------
function renderLipsyncImage() {
  if (state.lipsyncImage) {
    lipsyncImageRow.innerHTML = `<div class="small-thumb"><img src="${state.lipsyncImage.previewUrl}" alt="" /><button class="remove-btn" id="lipsyncImageRemove">✕</button></div>`;
    $("lipsyncImageRemove").addEventListener("click", () => {
      state.lipsyncImage = null;
      renderLipsyncImage();
    });
  } else {
    lipsyncImageRow.innerHTML = `<button class="add-small-image-btn" id="lipsyncImageAdd">⬆<span>افزودن</span></button>`;
    $("lipsyncImageAdd").addEventListener("click", () => lipsyncImageInput.click());
  }
}
lipsyncImageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const base64 = await fileToBase64(file);
    state.lipsyncImage = { base64, mediaType: file.type, previewUrl: URL.createObjectURL(file) };
    renderLipsyncImage();
  } catch (err) {
    lipsyncErrorBox.textContent = "بارگذاری تصویر ناموفق بود.";
    lipsyncErrorBox.classList.remove("hidden");
  }
});

function buildLipsyncSystemPrompt() {
  const langInstruction =
    state.outputLang === "en"
      ? "Write the entire output in English."
      : "Write the entire output in Persian (Farsi), but keep technical camera/lens terminology in English where that is standard industry practice.";
  const platformLabel = PLATFORMS.find((p) => p.id === state.platform)?.label;

  const hasFaceRef = state.lipsyncImage || state.lipsyncVideoFrames.length > 0;
  const faceInstruction = hasFaceRef
    ? "\nIDENTITY LOCK: A reference image and/or reference video frames of the character are provided. Lock the facial features, hairstyle, and distinguishing traits exactly as shown, consistent throughout the SUBJECT section."
    : "";
  const videoInstruction =
    state.lipsyncVideoFrames.length > 0
      ? "\nREFERENCE VIDEO: Frames from a real reference video are provided (chronological order). Ground the SCENE, SUBJECT, and existing motion/performance style in what is actually shown — don't invent unrelated details."
      : "";
  const musicFileInstruction = state.lipsyncMusicFile
    ? "\nAUDIO FILE PROVIDED: An actual music/audio file is attached. Listen to it and base the MUSIC and LIP-SYNC & TIMING sections on its real tempo, rhythm, mood, and (if vocals are present) the actual words/phrasing — don't just rely on the text description."
    : "";

  return `You are an elite AI video-generation prompt engineer specializing in lip-synced, music-driven videos. Target platform: ${platformLabel}, aspect ratio ${state.aspect}.

Produce ONE finished, copy-paste-ready prompt for a lip-sync/music-video capable video AI model, structured with these exact uppercase section labels:

LOGLINE — one vivid sentence capturing the whole shot.
SCENE & SETTING — location, environment, exactly as seen in any reference video provided, otherwise inferred from context.
SUBJECT — who is performing, appearance, expression, wardrobe.${faceInstruction}
MUSIC — the musical style, tempo, instrumentation, and energy.
LIP-SYNC & TIMING — precise mouth-shape/viseme cues and facial performance timed to the beat and, if provided, to the exact lyrics/words given by the user. Describe this beat-by-beat or line-by-line so a lip-sync model can follow it closely.
CAMERA — shot type, framing, movement.
LIGHTING & COLOR — light sources, grade, mood.
ATMOSPHERE & STYLE — overall visual mood/genre.
NEGATIVE / AVOID — artifacts or qualities to avoid.
${videoInstruction}${musicFileInstruction}

${langInstruction}

Be maximally specific about the timing/synchronization between the audio and the mouth/body movement. Do not add preamble or markdown formatting. Just the labeled plain-text sections.`;
}

lipsyncGenerateBtn.addEventListener("click", async () => {
  const musicDesc = lipsyncMusicDesc.value.trim();
  const lyrics = lipsyncLyrics.value.trim();
  if (!musicDesc) {
    lipsyncErrorBox.textContent = "لطفاً توضیح موزیک را وارد کن.";
    lipsyncErrorBox.classList.remove("hidden");
    return;
  }
  if (state.lipsyncMusicFile && state.provider !== "gemini") {
    lipsyncErrorBox.textContent = "برای تحلیل فایل موزیک باید Gemini انتخاب شده باشد (بالای صفحه). یا فایل را حذف کن یا Gemini را انتخاب کن.";
    lipsyncErrorBox.classList.remove("hidden");
    return;
  }
  lipsyncErrorBox.classList.add("hidden");
  lipsyncResultBox.classList.add("hidden");
  lipsyncGenerateBtn.disabled = true;
  lipsyncGenerateBtn.textContent = "در حال تولید...";

  try {
    const contentBlocks = [];
    if (state.lipsyncImage) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: state.lipsyncImage.mediaType, data: state.lipsyncImage.base64 },
      });
    }
    state.lipsyncVideoFrames.forEach((f) => {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: f.mediaType, data: f.base64 },
      });
    });
    if (state.lipsyncMusicFile) {
      contentBlocks.push({
        type: "audio",
        source: { type: "base64", media_type: state.lipsyncMusicFile.mediaType, data: state.lipsyncMusicFile.base64 },
      });
    }
    let userText = `توضیح موزیک: ${musicDesc}`;
    userText += lyrics
      ? `\nمتن/لیریک برای هماهنگی لب:\n${lyrics}`
      : `\nمتن دقیقی داده نشده؛ حرکات لب را متناسب با ریتم و انرژی موزیک توصیف کن.`;
    if (state.lipsyncVideoFrames.length > 0) userText += `\n\n(${state.lipsyncVideoFrames.length} فریم از یک ویدیوی مرجع پیوست شده.)`;
    if (state.lipsyncMusicFile) userText += `\n\n(یک فایل موزیک واقعی پیوست شده — به تمپو و ریتم واقعیش گوش بده.)`;
    contentBlocks.push({ type: "text", text: userText });

    const text = await callAI(buildLipsyncSystemPrompt(), [{ role: "user", content: contentBlocks }]);
    lipsyncResultText.textContent = text;
    lipsyncResultBox.classList.remove("hidden");
  } catch (err) {
    lipsyncErrorBox.textContent = "تولید پرامت ناموفق بود. دوباره تلاش کن.";
    lipsyncErrorBox.classList.remove("hidden");
  } finally {
    lipsyncGenerateBtn.disabled = false;
    lipsyncGenerateBtn.textContent = "تولید پرامت لیپ‌سینک";
  }
});

lipsyncVideoBtn.addEventListener("click", () => lipsyncVideoInput.click());
lipsyncVideoInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  lipsyncErrorBox.classList.add("hidden");
  lipsyncVideoBtn.textContent = file.name;
  state.lipsyncVideoFrames = [];
  lipsyncVideoFramesRow.innerHTML = "";
  lipsyncVideoExtracting.classList.remove("hidden");

  try {
    const frames = await extractVideoFrames(file, 4);
    state.lipsyncVideoFrames = frames;
    lipsyncVideoFramesRow.innerHTML = frames.map((f) => `<img class="frame-thumb" src="${f.dataUrl}" alt="" />`).join("");
  } catch (err) {
    lipsyncErrorBox.textContent = "استخراج فریم از ویدیو ناموفق بود. فرمت فایل را بررسی کن.";
    lipsyncErrorBox.classList.remove("hidden");
  } finally {
    lipsyncVideoExtracting.classList.add("hidden");
  }
});

lipsyncMusicFileBtn.addEventListener("click", () => lipsyncMusicFileInput.click());
lipsyncMusicFileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  lipsyncErrorBox.classList.add("hidden");
  try {
    const base64 = await fileToBase64(file);
    state.lipsyncMusicFile = { base64, mediaType: file.type, name: file.name };
    lipsyncMusicFileBtn.textContent = file.name;
  } catch (err) {
    lipsyncErrorBox.textContent = "بارگذاری فایل موزیک ناموفق بود.";
    lipsyncErrorBox.classList.remove("hidden");
  }
});

lipsyncCopyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(lipsyncResultText.textContent).then(() => flashCopied(lipsyncCopyBtn));
});

// ---------- More modal: character swap ----------
function renderSwapImage() {
  if (state.swapImage) {
    swapImageRow.innerHTML = `<div class="small-thumb"><img src="${state.swapImage.previewUrl}" alt="" /><button class="remove-btn" id="swapImageRemove">✕</button></div>`;
    $("swapImageRemove").addEventListener("click", () => {
      state.swapImage = null;
      renderSwapImage();
      updateSwapButtonState();
    });
  } else {
    swapImageRow.innerHTML = `<button class="add-small-image-btn" id="swapImageAdd">⬆<span>افزودن</span></button>`;
    $("swapImageAdd").addEventListener("click", () => swapImageInput.click());
  }
}
swapImageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const base64 = await fileToBase64(file);
    state.swapImage = { base64, mediaType: file.type, previewUrl: URL.createObjectURL(file) };
    renderSwapImage();
    updateSwapButtonState();
  } catch (err) {
    swapErrorBox.textContent = "بارگذاری عکس ناموفق بود.";
    swapErrorBox.classList.remove("hidden");
  }
});

function updateSwapButtonState() {
  swapGenerateBtn.disabled = !(state.swapVideoFrames.length > 0 && state.swapImage);
}

swapVideoBtn.addEventListener("click", () => swapVideoInput.click());
swapVideoInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  swapErrorBox.classList.add("hidden");
  swapResultBox.classList.add("hidden");
  swapVideoBtn.textContent = file.name;
  state.swapVideoFrames = [];
  swapFramesRow.innerHTML = "";
  swapExtractingIndicator.classList.remove("hidden");
  updateSwapButtonState();

  try {
    const frames = await extractVideoFrames(file, 4);
    state.swapVideoFrames = frames;
    swapFramesRow.innerHTML = frames.map((f) => `<img class="frame-thumb" src="${f.dataUrl}" alt="" />`).join("");
  } catch (err) {
    swapErrorBox.textContent = "استخراج فریم از ویدیو ناموفق بود. فرمت فایل را بررسی کن.";
    swapErrorBox.classList.remove("hidden");
  } finally {
    swapExtractingIndicator.classList.add("hidden");
    updateSwapButtonState();
  }
});

function buildCharacterSwapSystemPrompt() {
  const langInstruction =
    state.outputLang === "en"
      ? "Write the entire output in English."
      : "Write the entire output in Persian (Farsi), but keep technical camera/lens terminology in English where that is standard industry practice.";
  const platformLabel = PLATFORMS.find((p) => p.id === state.platform)?.label;

  return `You are an elite AI video-generation prompt engineer specializing in character replacement. You are given ${state.swapVideoFrames.length} frames extracted in chronological order from an original video, PLUS one reference photo of a NEW character/person (the final image provided).

Your job: write one finished prompt (target platform: ${platformLabel}, aspect ratio ${state.aspect}) that regenerates the ORIGINAL footage's action, camera work, environment, and lighting EXACTLY as observed in the frames, but with the person in the footage replaced by the individual shown in the reference photo.

Structure the output with these exact uppercase section labels:

LOGLINE — one vivid sentence.
SCENE & SETTING — location, time of day, environment, exactly as seen in the original frames.
SUBJECT — describe the NEW character using the reference photo's facial features, hairstyle, and distinguishing traits in detail. Explicitly state this identity replaces the original person while everything else about the scene stays identical. Include a direct instruction such as: "Use the provided/attached reference photo for this character's face and identity" — phrased so it still makes sense if the person also uploads that same reference photo directly into a video platform's own character/reference-image field, not just as a text description.
ACTION & TIMELINE — the same action/motion observed across the original frames.
CAMERA — shot type, framing, movement, exactly as in the original.
LIGHTING & COLOR — as observed in the original footage.
ATMOSPHERE & STYLE — as observed.
NEGATIVE / AVOID — should explicitly include an instruction not to retain the original person's face/identity.

${langInstruction}

Be maximally specific. Do not add preamble or markdown formatting. Just the labeled plain-text sections.`;
}

swapGenerateBtn.addEventListener("click", async () => {
  if (state.swapVideoFrames.length === 0 || !state.swapImage) return;
  swapErrorBox.classList.add("hidden");
  swapResultBox.classList.add("hidden");
  swapGenerateBtn.disabled = true;
  swapGenerateBtn.textContent = "در حال تولید...";

  try {
    const contentBlocks = state.swapVideoFrames.map((f) => ({
      type: "image",
      source: { type: "base64", media_type: f.mediaType, data: f.base64 },
    }));
    contentBlocks.push({
      type: "image",
      source: { type: "base64", media_type: state.swapImage.mediaType, data: state.swapImage.base64 },
    });
    contentBlocks.push({
      type: "text",
      text: `اولین تصاویر، فریم‌های ویدیوی اصلی هستند (به ترتیب زمانی). آخرین تصویر، عکس مرجع کاراکتر جدیده. پرامتی بساز که همون ویدیوی اصلی رو دقیقاً با این کاراکتر جدید بازتولید کنه.`,
    });

    const text = await callAI(buildCharacterSwapSystemPrompt(), [{ role: "user", content: contentBlocks }]);
    swapResultText.textContent = text;
    swapResultBox.classList.remove("hidden");
  } catch (err) {
    swapErrorBox.textContent = "تولید پرامت ناموفق بود. دوباره تلاش کن.";
    swapErrorBox.classList.remove("hidden");
  } finally {
    swapGenerateBtn.disabled = false;
    swapGenerateBtn.textContent = "تولید پرامت جایگزینی کاراکتر";
    updateSwapButtonState();
  }
});

swapCopyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(swapResultText.textContent).then(() => flashCopied(swapCopyBtn));
});

// ---------- More modal: viral titles & hashtags ----------
function buildTitlesSystemPrompt() {
  return `You are a viral social media strategist specializing in catchy, high-click-through titles/captions and hashtag research for short-form video (TikTok, YouTube Shorts, Instagram Reels).

Given a short description of a video's topic/idea, produce:

TITLES — exactly 8 catchy, scroll-stopping, user-friendly title/caption options in English, each on its own line, numbered 1-8. Vary the style across the list (curiosity-driven, bold claim, funny, relatable, question-based, etc). Keep each under 12 words.
HASHTAGS — a single line of 15-20 relevant, high-traffic English hashtags (mix of broad/popular and niche-specific), space-separated, each starting with #.

Do not add any preamble, explanation, or markdown formatting like asterisks. Just the two labeled sections exactly as specified above.`;
}

titlesGenerateBtn.addEventListener("click", async () => {
  const topic = titlesTopicInput.value.trim() || ideaInput.value.trim();
  if (!topic) {
    titlesErrorBox.textContent = "لطفاً موضوع یا ایده‌ی ویدیو را بنویس.";
    titlesErrorBox.classList.remove("hidden");
    return;
  }
  titlesErrorBox.classList.add("hidden");
  titlesResultBox.classList.add("hidden");
  titlesGenerateBtn.disabled = true;
  titlesGenerateBtn.textContent = "در حال تولید...";

  try {
    const text = await callAI(buildTitlesSystemPrompt(), [
      { role: "user", content: [{ type: "text", text: `موضوع/ایده ویدیو: ${topic}` }] },
    ]);
    titlesResultText.textContent = text;
    titlesResultBox.classList.remove("hidden");
  } catch (err) {
    titlesErrorBox.textContent = "تولید ناموفق بود. دوباره تلاش کن.";
    titlesErrorBox.classList.remove("hidden");
  } finally {
    titlesGenerateBtn.disabled = false;
    titlesGenerateBtn.textContent = "تولید عنوان و هشتگ";
  }
});

titlesCopyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(titlesResultText.textContent).then(() => flashCopied(titlesCopyBtn));
});

// ---------- Init ----------
initSelects();
renderStylePresets();
renderImages();
renderResult();
renderLipsyncImage();
renderSwapImage();
