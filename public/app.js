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

const CAMERA_MOVEMENTS = [
  "ثابت (Static)",
  "پن به چپ (Pan Left)",
  "پن به راست (Pan Right)",
  "تیلت به بالا (Tilt Up)",
  "تیلت به پایین (Tilt Down)",
  "زوم به داخل (Zoom In)",
  "زوم به بیرون (Zoom Out)",
  "دالی به جلو (Dolly In)",
  "دالی به عقب (Dolly Out)",
  "تعقیب/دنبال‌کردن (Tracking Shot)",
  "دوربین روی دست (Handheld)",
  "چرخش مداری (Orbit/Arc)",
  "کرین/هوایی (Crane/Aerial)",
];
const MOTION_SPEEDS = ["آهسته (Slow)", "متوسط (Medium)", "سریع (Fast)", "شتاب‌گیرنده (Accelerating)", "کندشونده (Decelerating)"];

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
  segmentCount: 3,
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
  motionImage: null,
  characterRoster: [],
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

async function callAI(system, messages, maxTokens = 2000) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: state.provider, system, messages, max_tokens: maxTokens }),
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
    "SUBJECT(S) — who/what is in frame: appearance, wardrobe, expression, referencing the uploaded images where relevant. Include only characteristics that are visible in the reference or explicitly requested by the user — do not invent unnecessary personal details.",
    "ACTION & TIMELINE — describe the shot as four clear stages: OPENING (the first moment/frame), DEVELOPMENT (how the action builds), MAIN MOMENT (the strongest/most important visual beat), and ENDING (the final position/frame) — with exact starting position, movement direction/speed, and ending position for every important action. Never write vague lines like \"the subject moves beautifully\" — describe precisely how. REALISTIC PHYSICS: unless the user's idea explicitly asks for slow-motion, flight, or an exaggerated/stylized movement, describe all motion at normal, real-world speed and under normal gravity — e.g. a jump or fall must read as a quick, natural jump/fall, not a graceful glide, hover, or float. Avoid words like \"soars\", \"floats\", \"glides\", or \"drifts\" for grounded actions, since video models can misread them as flight or slow-motion.",
    "CAMERA — shot type, framing, lens feel, camera movement (dolly/pan/handheld/crane/static), movement speed, depth of field. Give ONE clear, coherent camera instruction — do not stack multiple conflicting movements into the same shot.",
    "LIGHTING & COLOR — light sources, direction, color grade, contrast, mood of the palette.",
    "ATMOSPHERE & STYLE — overall mood, genre/film reference touchstones, texture (film grain, digital clean, anamorphic, etc).",
  ];

  if (state.musicEnabled) {
    sectionList.push("MUSIC — specific genre, instrumentation, tempo/BPM feel, and how the musical energy arcs and syncs to the on-screen action across the clip.");
    sectionList.push("SOUND DESIGN — ambient sound and diegetic sound cues layered under the music.");
  } else {
    sectionList.push("AUDIO NOTES — ambient sound and diegetic sound cues (no music track; describe only environmental/atmospheric sound).");
  }
  sectionList.push(
    "NEGATIVE / AVOID — a concise but powerful avoidance list covering whichever categories are relevant: IDENTITY (different face, face-swap, identity drift, facial morphing), BODY (proportion changes, distorted anatomy, duplicated/missing limbs), CLOTHING (wardrobe changes, color/design changes, disappearing accessories), ANIMAL (different animal, species/fur/marking changes) if applicable, MOTION (unintended slow-motion, unintended floating/flying/hovering, unnatural gravity, inconsistent speed) unless those effects were explicitly requested, and VIDEO artifacts (flickering, temporal inconsistency, object morphing, unstable background, unwanted text/subtitles/logos)."
  );

  const hasImages = state.images.length > 0;
  const consistencyLocks = hasImages
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL REFERENCE CONSISTENCY LOCK — HIGHEST PRIORITY, NEVER IGNORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The provided reference image(s) are the PRIMARY and AUTHORITATIVE source for the visual identity of the subject(s). Their visible characteristics must be preserved throughout the entire video. Never randomly redesign, replace, or reinterpret the referenced subject. If there is ever a conflict between an inferred/creative detail and what the reference image actually shows, always prioritize the reference image unless the user explicitly requests a change.

First identify the subject's actual species/type exactly as shown (human, cat, dog, or any other creature/object) — never assume human by default.

IDENTITY LOCK (human subjects): preserve facial structure, proportions, eye/nose/mouth/jawline shape, skin tone, hairstyle, hair color, facial hair, and any recognizable characteristics. The SAME PERSON must appear from the first frame to the last — never face-swap, morph, age-shift, or drift the identity.

IDENTITY LOCK (animal subjects): treat the referenced animal as a unique individual — preserve species, breed characteristics, body proportions, size, fur/feather/scale color and pattern, markings, ear/tail shape, and distinctive features. The SAME ANIMAL must appear throughout — never change species, breed characteristics, or body proportions, and never let an animal gain human limbs, posture, or a human face.

BODY CONSISTENCY LOCK: preserve body proportions, build, and posture characteristics for the locked subject throughout. Never stretch/shrink body parts, duplicate or remove limbs, or distort anatomy between frames or segments — all movement must follow believable, natural biomechanics for that subject's species.

CLOTHING & ACCESSORY LOCK: once wardrobe is described in SUBJECT(S), that exact outfit (garment types, colors, fit, accessories, jewelry, shoes) must stay visually IDENTICAL for the entire video and across every segment if the output is split — no outfit changes, no color shifts, no swapping between similar items (e.g. shorts must not turn into pants) — unless the user's idea explicitly describes a costume change as part of the story.

If multiple subjects appear, keep each one's identity, body, and wardrobe separately locked and never mix faces, swap identities, or transfer clothing between them.
`
    : "";

  const dialogueInstruction = !state.hasDialogue
    ? `\nNO DIALOGUE: This video must contain no spoken dialogue, no lip movement implying speech, and no on-screen text or subtitles. Describe the storytelling as purely visual — expression, gesture, and action carry the meaning. Add "no dialogue, no lip-sync, no spoken words, no subtitles" to the NEGATIVE / AVOID section.`
    : `\nDIALOGUE ALLOWED: This video may include spoken dialogue or vocal lines. In the ACTION & TIMELINE section, write short, natural, in-character lines of dialogue exactly as they should be spoken, with clear speaker attribution and timing, so a model with lip-sync/voice capability can use them directly. Do not invent dialogue beyond what naturally fits the described action.`;

  const musicInstruction = state.musicEnabled
    ? `\nMUSIC REQUIRED: The user wants an original music track guiding the video.${
        state.musicStyle.trim() ? ` Requested music direction: "${state.musicStyle.trim()}".` : " No specific style was given, so choose music that best fits the mood, genre, and pacing of the scene."
      } Describe the MUSIC section with enough detail (instrumentation, tempo, emotional arc, key sync points with the visual action) that a composer or a music-generation model could realize it.`
    : "";

  const qualityCheck = `\nSILENT SELF-CHECK (do not print this): before answering, verify — is the locked identity/body/clothing/species preserved throughout? Is every action physically believable and precisely described (not vague)? Is the camera movement clear? Does the prompt stay true to the user's original idea without secondary detail burying it? Is it free of contradictions and directly ready to paste into a video platform? If any check fails, silently revise before responding.`;

  const platformLabel = PLATFORMS.find((p) => p.id === state.platform)?.label;

  if (!state.splitEnabled) {
    return `You are an elite AI Video Prompt Director, Cinematographer, and Prompt Engineer. You specialize in translating a rough creative idea and reference images into an extremely detailed, accurate, cinematic, production-ready prompt for text-to-video AI models (such as Sora, Veo, Kling, or Runway).

The user will give you:
- A general idea for a video
- Optional reference images (for style, subject, composition, mood, or identity reference)
- Target platform: ${platformLabel}
- Aspect ratio: ${state.aspect}
- Target duration: ${state.duration}
- Optional extra style notes
${consistencyLocks}
Your job: produce ONE finished, copy-paste-ready video generation prompt, structured with these labeled sections (use these exact uppercase labels, each on its own line, followed by tightly written descriptive detail — not bullet fragments but flowing cinematic description):

${sectionList.join("\n")}
${dialogueInstruction}${musicInstruction}
${qualityCheck}

${langInstruction}

LENGTH & FOCUS: Keep the total prompt practical for real video-generation platforms — most enforce a prompt length limit and work best with a focused, prioritized description, not an exhaustive list of every possible detail. Prioritize whatever most defines the shot (the core subject, action, and mood the user described) over secondary embellishments. Aim for roughly 150-250 words total across all sections combined — do not pad sections just to sound thorough, and never let consistency-lock detail turn into unnecessary keyword spam. The user's original idea must stay the clear, unmistakable center of the prompt.

Be maximally specific and sensory within that length — a reader should be able to visualize the exact shot. Do not add any preamble, meta-commentary, or markdown formatting like asterisks or headers with #. Just the labeled plain-text sections as specified. Do not explain your reasoning.`;
  }

  return `You are an elite AI Video Prompt Director, Cinematographer, and Prompt Engineer. You specialize in translating a rough creative idea and reference images into a CHAIN of sequential, production-ready prompts for text-to-video AI models (such as Sora, Veo, Kling, or Runway), designed for platforms that support image-to-video continuation.

The user will give you:
- A general idea for a video (the full story arc, to be split across multiple short clips)
- Optional reference images (for style, subject, composition, mood, or identity reference)
- Target platform: ${platformLabel}
- Aspect ratio: ${state.aspect}
- Duration per segment: ${state.duration}
- Number of segments to split the idea into: ${state.segmentCount}
- Optional extra style notes
${consistencyLocks}
Your job: break the overall idea into exactly ${state.segmentCount} sequential clips that together tell the full story with zero visual discontinuity. Output each segment starting with a line EXACTLY in this format (nothing else on that line):
### SEGMENT <n> ###

Then, for each segment, write the labeled sections below:

${sectionList.join("\n")}
CONTINUITY — for segment 1, describe the exact opening frame in full detail (this frame will be captured and reused). For every segment after the first, explicitly instruct: "Begin this clip from the final frame of the previous clip (use it as the image-to-video starting reference)" and state precisely which elements must remain pixel-identical to that last frame (identity, body, wardrobe, environment, lighting, camera framing) before the new motion begins.
${dialogueInstruction}${musicInstruction}
${qualityCheck}

${langInstruction}

LENGTH & FOCUS: Keep each segment practical for real video-generation platforms — most enforce a prompt length limit and work best with a focused, prioritized description, not an exhaustive list of every possible detail. Aim for roughly 120-180 words per segment — do not pad sections just to sound thorough. The user's original idea must stay the clear, unmistakable center of every segment; never let secondary detail bury or distort it.

Be maximally specific and sensory within that length. Each segment must read as a standalone, complete prompt a user can paste directly into a video model, while still connecting seamlessly to its neighbors. Do not add any preamble, meta-commentary, or markdown formatting like asterisks or headers with #, other than the required "### SEGMENT <n> ###" markers. Do not explain your reasoning.`;
}

function buildAnalysisSystemPrompt() {
  const langInstruction =
    state.outputLang === "en"
      ? "Write the entire output in English."
      : "Write the entire output in Persian (Farsi), but keep technical camera/lens terminology in English where that is standard industry practice.";

  const sectionList = [
    "LOGLINE — one vivid sentence capturing the whole shot/scene.",
    "SCENE & SETTING — location type, time of day, key background elements, set dressing.",
    "SUBJECT(S) — who/what is in frame: distinguishing physical description, clothing, pose, expression, and how these change frame-to-frame.",
    "ACTION & TIMELINE — describe as four stages inferred from the frames: OPENING (first frame), DEVELOPMENT (how it builds across the middle frames), MAIN MOMENT (the strongest visual beat), ENDING (final frame) — with exact position/direction/speed for every movement.",
    "CAMERA — shot type, framing, apparent lens feel, any camera movement inferred from framing shifts across frames, depth of field. Describe it as ONE coherent movement, not several conflicting ones.",
    "LIGHTING & COLOR — light direction/hardness, key sources, color grade, contrast.",
    "ATMOSPHERE & STYLE — overall mood, genre touchstones, texture (film grain, digital clean, etc).",
    "EDITING & EFFECTS — only if visible across the frames: cuts, speed changes, slow motion, motion blur, particles, fog, or other visible effects. Omit this section if nothing of the sort is apparent.",
    state.musicEnabled
      ? "MUSIC — plausible genre, instrumentation, tempo/BPM feel matching the footage's energy."
      : "AUDIO NOTES — plausible ambient/diegetic sound cues matching what is visually happening.",
    "NEGATIVE / AVOID — artifacts or qualities to avoid when regenerating this footage.",
  ];

  const faceInstruction = "\nIDENTITY LOCK: If a person, animal, or character appears, first identify its actual species/type exactly as seen (human, cat, dog, other creature, etc.) — never assume human by default. Describe its exact distinguishing features appropriate to that species (facial features and hairstyle for a human; exact fur/coloring/body proportions for an animal) in the SUBJECT(S) section precisely, and state that this identity — including species and body type — must remain fully consistent if regenerated, with no drift into a different anatomy.";
  const wardrobeInstruction = "\nWARDROBE LOCK: Describe the subject's exact clothing/wardrobe as seen in the frames, and state this exact outfit must stay identical throughout the regenerated video with no changes partway through (no swapping between similar items, e.g. shorts must not turn into pants), unless a costume change is clearly visible across the frames themselves.";
  const dialogueInstruction = !state.hasDialogue
    ? '\nNO DIALOGUE: Regardless of what is seen, instruct that the regenerated video must contain no spoken dialogue, no lip-sync, no on-screen text. Add "no dialogue, no lip-sync, no subtitles" to NEGATIVE / AVOID.'
    : "\nDIALOGUE ALLOWED: If any speech or lip movement is visible in the frames, transcribe or plausibly reconstruct short natural dialogue lines with speaker attribution in the ACTION & TIMELINE section, timed to match the footage.";

  const platformLabel = PLATFORMS.find((p) => p.id === state.platform)?.label;

  return `You are an elite AI video-generation prompt engineer specializing in reverse-engineering accurate, high-fidelity prompts from real footage. You are given ${state.extractedFrames.length} frames extracted in chronological order (start to end) from an actual video clip. Your job is to write the exact prompt that, if given to a text-to-video AI model (target platform: ${platformLabel}, aspect ratio ${state.aspect}), would regenerate this same footage as closely as possible.

CRITICAL — examine every single one of the ${state.extractedFrames.length} frames individually and compare each to its neighbors before writing anything. Do not summarize only the first frame or write generic filler. Every section must contain specific, concrete, visually-grounded detail pulled directly from what is actually visible — never vague placeholders like "a person walks" without saying exactly how, wearing what, where.

LENGTH & FOCUS: Keep the total prompt practical for real video-generation platforms — most enforce a prompt length limit and work best with a focused, prioritized description, not an exhaustive list of every possible detail. Aim for roughly 150-250 words total across all sections combined. Prioritize whatever most defines the shot (the core subject and action actually seen in the frames) over secondary embellishments — never let secondary detail bury or distort what the footage is actually about.

Only describe what is visible or strongly implied by comparing the frames — do not invent unrelated plot details. Infer the motion happening between frames as smooth continuous action.

Structure the output with these exact uppercase section labels, each followed by flowing, concrete descriptive text:

${sectionList.join("\n")}
${faceInstruction}${wardrobeInstruction}${dialogueInstruction}

${langInstruction}

Do not add any preamble, meta-commentary, or markdown formatting like asterisks or headers with #. Just the labeled plain-text sections. Do not explain your reasoning.`;
}

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const ideaInput = $("ideaInput");
const stylePresetSelect = $("stylePresetSelect");
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
const providerZaiBtn = $("providerZaiBtn");
const splitToggle = $("splitToggle");
const segmentCountRow = $("segmentCountRow");
const segmentCountButtons = $("segmentCountButtons");
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

const motionImageRow = $("motionImageRow");
const motionImageInput = $("motionImageInput");
const motionCameraSelect = $("motionCameraSelect");
const motionSpeedSelect = $("motionSpeedSelect");
const motionSubjectInput = $("motionSubjectInput");
const motionFramingInput = $("motionFramingInput");
const motionErrorBox = $("motionErrorBox");
const motionGenerateBtn = $("motionGenerateBtn");
const motionResultBox = $("motionResultBox");
const motionResultText = $("motionResultText");
const motionCopyBtn = $("motionCopyBtn");

const rosterImageRow = $("rosterImageRow");
const rosterImageInput = $("rosterImageInput");
const rosterNameInput = $("rosterNameInput");
const rosterEpisodeInput = $("rosterEpisodeInput");
const rosterErrorBox = $("rosterErrorBox");
const rosterAddBtn = $("rosterAddBtn");
const rosterList = $("rosterList");

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

  segmentCountButtons.innerHTML = [2, 3, 4, 5, 6]
    .map((n) => `<button class="segment-btn${n === state.segmentCount ? " active" : ""}" data-n="${n}">${n}</button>`)
    .join("");

  motionCameraSelect.innerHTML = CAMERA_MOVEMENTS.map((c) => `<option value="${c}">${c}</option>`).join("");
  motionSpeedSelect.innerHTML = MOTION_SPEEDS.map((s) => `<option value="${s}">${s}</option>`).join("");
}

function renderStylePresets() {
  stylePresetSelect.innerHTML =
    `<option value="">بدون سبک خاص</option>` +
    STYLE_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  stylePresetSelect.value = state.selectedPreset || "";
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
  providerZaiBtn.classList.remove("active");
});
providerGeminiBtn.addEventListener("click", () => {
  state.provider = "gemini";
  providerGeminiBtn.classList.add("active");
  providerClaudeBtn.classList.remove("active");
  providerZaiBtn.classList.remove("active");
});
providerZaiBtn.addEventListener("click", () => {
  state.provider = "zai";
  providerZaiBtn.classList.add("active");
  providerClaudeBtn.classList.remove("active");
  providerGeminiBtn.classList.remove("active");
});

stylePresetSelect.addEventListener("change", (e) => {
  state.selectedPreset = e.target.value || null;
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
  segmentCountRow.classList.toggle("hidden", !state.splitEnabled);
});
segmentCountButtons.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-n]");
  if (!btn) return;
  state.segmentCount = Number(btn.dataset.n);
  [...segmentCountButtons.children].forEach((b) => b.classList.toggle("active", Number(b.dataset.n) === state.segmentCount));
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
  if (state.provider === "zai" && state.images.length > 0) {
    showError("Z.ai از عکس مرجع پشتیبانی نمی‌کند. عکس‌ها را حذف کن یا Gemini/Claude را انتخاب کن.");
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
      userText += " چهره/هویت نشان داده‌شده در تصاویر باید بدون تغییر در تمام خروجی حفظ شود.";
    }
    if (state.splitEnabled) userText += `\n\nخروجی را به ${state.segmentCount} پرامت متوالی تقسیم کن که هرکدام از فریم پایانی قبلی ادامه پیدا کنند.`;
    if (!state.hasDialogue) userText += "\nهیچ دیالوگ یا صحبتی در ویدیو نباشد.";
    else userText += "\nدیالوگ در ویدیو مجاز است.";
    if (state.musicEnabled) userText += `\nموزیک اضافه کن.${state.musicStyle.trim() ? ` سبک موزیک مدنظر: ${state.musicStyle.trim()}` : ""}`;

    contentBlocks.push({ type: "text", text: userText });

    const maxTokens = state.splitEnabled ? 900 * state.segmentCount + 700 : 2000;
    const text = await callAI(buildSystemPrompt(), [{ role: "user", content: contentBlocks }], maxTokens);
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
  saveDraft();
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
    const frames = await extractVideoFrames(file, 8);
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

    const text = await callAI(buildAnalysisSystemPrompt(), [{ role: "user", content: contentBlocks }], 2800);
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
    ? "\nIDENTITY LOCK: A reference image and/or reference video frames of the character are provided. First identify the actual species/type exactly as shown (human, animal, or otherwise) — never assume human by default. Lock the distinguishing features appropriate to that species (facial features/hairstyle for a human; fur/coloring/body shape for an animal) exactly as shown, consistent throughout the SUBJECT section, with no drift into a different anatomy."
    : "";
  const videoInstruction =
    state.lipsyncVideoFrames.length > 0
      ? "\nREFERENCE VIDEO: Frames from a real reference video are provided (chronological order). Ground the SCENE, SUBJECT, and existing motion/performance style in what is actually shown — don't invent unrelated details."
      : "";
  const musicFileInstruction = state.lipsyncMusicFile
    ? "\nAUDIO FILE PROVIDED: An actual music/audio file is attached. Listen to it and base the MUSIC and LIP-SYNC & TIMING sections on its real tempo, rhythm, mood, and (if vocals are present) the actual words/phrasing — don't just rely on the text description."
    : "";
  const wardrobeInstruction = "\nWARDROBE LOCK: Once wardrobe is described in the SUBJECT section, it must stay identical for the entire clip — no outfit changes, color shifts, or swapped garments unless explicitly part of the requested idea.";

  return `You are an elite AI video-generation prompt engineer specializing in lip-synced, music-driven videos. Target platform: ${platformLabel}, aspect ratio ${state.aspect}.

LENGTH & FOCUS: Keep the total prompt practical for real video-generation platforms — aim for roughly 150-250 words total across all sections combined. Prioritize the core performance and lip-sync timing over secondary embellishments.

Produce ONE finished, copy-paste-ready prompt for a lip-sync/music-video capable video AI model, structured with these exact uppercase section labels:

LOGLINE — one vivid sentence capturing the whole shot.
SCENE & SETTING — location, environment, exactly as seen in any reference video provided, otherwise inferred from context.
SUBJECT — who is performing, appearance, expression, wardrobe.${faceInstruction}
MUSIC — the musical style, tempo, instrumentation, and energy.
LIP-SYNC & TIMING — describe as staged beats (OPENING, BUILD, PEAK, ENDING) with precise mouth-shape/viseme cues and facial performance timed to the beat and, if provided, to the exact lyrics/words given by the user.
CAMERA — shot type, framing, movement. Give ONE coherent camera movement, not several conflicting ones.
LIGHTING & COLOR — light sources, grade, mood.
ATMOSPHERE & STYLE — overall visual mood/genre.
NEGATIVE / AVOID — artifacts or qualities to avoid.
${videoInstruction}${musicFileInstruction}${wardrobeInstruction}

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

    const text = await callAI(buildLipsyncSystemPrompt(), [{ role: "user", content: contentBlocks }], 2400);
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
    const frames = await extractVideoFrames(file, 8);
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

// ---------- More modal: motion control ----------
function renderMotionImage() {
  if (state.motionImage) {
    motionImageRow.innerHTML = `<div class="small-thumb"><img src="${state.motionImage.previewUrl}" alt="" /><button class="remove-btn" id="motionImageRemove">✕</button></div>`;
    $("motionImageRemove").addEventListener("click", () => {
      state.motionImage = null;
      renderMotionImage();
    });
  } else {
    motionImageRow.innerHTML = `<button class="add-small-image-btn" id="motionImageAdd">⬆<span>افزودن</span></button>`;
    $("motionImageAdd").addEventListener("click", () => motionImageInput.click());
  }
}

motionImageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  motionErrorBox.classList.add("hidden");
  try {
    const base64 = await fileToBase64(file);
    state.motionImage = { base64, mediaType: file.type, previewUrl: URL.createObjectURL(file) };
    renderMotionImage();
  } catch (err) {
    motionErrorBox.textContent = "بارگذاری تصویر ناموفق بود.";
    motionErrorBox.classList.remove("hidden");
  }
});

function buildMotionControlSystemPrompt() {
  const langInstruction =
    state.outputLang === "en"
      ? "Write the entire output in English, since text-to-video models parse English prompts most reliably."
      : "Write the entire output in Persian (Farsi), matching the user's language, but keep technical camera/lens terminology in English where that is standard industry practice.";
  const platformLabel = PLATFORMS.find((p) => p.id === state.platform)?.label;
  const cameraMovement = motionCameraSelect.value;
  const speed = motionSpeedSelect.value;
  const faceInstruction = state.motionImage
    ? "\nIDENTITY LOCK: A reference image is provided. First identify the actual species/type of the subject shown (human, animal, or otherwise) — never assume human by default. Lock its distinguishing features exactly as shown in the SUBJECT section, with no drift into a different anatomy."
    : "";
  const wardrobeInstruction = "\nWARDROBE LOCK: Once wardrobe is described in the SUBJECT section, it must stay identical for the entire clip — no outfit changes, color shifts, or swapped garments.";

  return `You are an elite AI video-generation prompt engineer specializing in EXTREMELY PRECISE camera and subject motion control, for platforms that support explicit motion/camera-path instructions (such as Kling, Runway Gen-4, Luma Dream Machine).

Target platform: ${platformLabel}, aspect ratio: ${state.aspect}.
Requested camera movement: ${cameraMovement}.
Requested movement speed: ${speed}.

LENGTH & FOCUS: Keep the total prompt practical for real video-generation platforms — aim for roughly 150-250 words total across all sections combined. The precision of the motion description matters far more than overall length.

Produce ONE finished, copy-paste-ready motion-control prompt structured with these exact uppercase section labels:

LOGLINE — one vivid sentence.
SCENE & SETTING — brief scene context grounding the shot.
SUBJECT — who/what is in frame, appearance, wardrobe.${faceInstruction}${wardrobeInstruction}
CAMERA MOTION — describe the "${cameraMovement}" movement at "${speed}" speed as three precise stages — START (exact camera position), PATH (the trajectory it travels), END (exact ending position) — using precise cinematography terminology. Give ONE coherent camera movement, not several conflicting ones stacked together.
SUBJECT MOTION — precise description of how the subject moves, exactly synced in timing with the camera motion described above. Unless the user's description explicitly implies flight, floating, or slow-motion, keep the motion at normal real-world speed and under normal gravity (e.g. a jump or fall must read as quick and natural, not a graceful glide or hover). Avoid words like "soars", "floats", or "glides" for grounded actions.
FRAMING — starting composition/framing and ending composition/framing (what's in frame, headroom, lead room).
LIGHTING & COLOR — brief.
NEGATIVE / AVOID — motion artifacts to avoid (e.g., jitter, warped anatomy, inconsistent speed, motion blur errors).

${langInstruction}

Be maximally precise about timing, direction, and speed of motion — this is the single most important part of this prompt, more important than visual flourish. Do not add preamble or markdown formatting. Just the labeled plain-text sections.`;
}

motionGenerateBtn.addEventListener("click", async () => {
  const subjectMotion = motionSubjectInput.value.trim();
  if (!subjectMotion) {
    motionErrorBox.textContent = "لطفاً حرکت سوژه را توضیح بده.";
    motionErrorBox.classList.remove("hidden");
    return;
  }
  motionErrorBox.classList.add("hidden");
  motionResultBox.classList.add("hidden");
  motionGenerateBtn.disabled = true;
  motionGenerateBtn.textContent = "در حال تولید...";

  try {
    const contentBlocks = [];
    if (state.motionImage) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: state.motionImage.mediaType, data: state.motionImage.base64 },
      });
    }
    let userText = `حرکت سوژه: ${subjectMotion}`;
    const framing = motionFramingInput.value.trim();
    if (framing) userText += `\nقاب شروع و پایان: ${framing}`;
    contentBlocks.push({ type: "text", text: userText });

    const text = await callAI(buildMotionControlSystemPrompt(), [{ role: "user", content: contentBlocks }], 1800);
    motionResultText.textContent = text;
    motionResultBox.classList.remove("hidden");
  } catch (err) {
    motionErrorBox.textContent = "تولید پرامت ناموفق بود. دوباره تلاش کن.";
    motionErrorBox.classList.remove("hidden");
  } finally {
    motionGenerateBtn.disabled = false;
    motionGenerateBtn.textContent = "تولید پرامت کنترل حرکت";
  }
});

motionCopyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(motionResultText.textContent).then(() => flashCopied(motionCopyBtn));
});

// ---------- More modal: character roster ----------
let pendingRosterImage = null;

function renderRosterImage() {
  if (pendingRosterImage) {
    rosterImageRow.innerHTML = `<div class="small-thumb"><img src="${pendingRosterImage.previewUrl}" alt="" /><button class="remove-btn" id="rosterImageRemove">✕</button></div>`;
    $("rosterImageRemove").addEventListener("click", () => {
      pendingRosterImage = null;
      renderRosterImage();
    });
  } else {
    rosterImageRow.innerHTML = `<button class="add-small-image-btn" id="rosterImageAdd">⬆<span>افزودن</span></button>`;
    $("rosterImageAdd").addEventListener("click", () => rosterImageInput.click());
  }
}

rosterImageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  rosterErrorBox.classList.add("hidden");
  try {
    const base64 = await fileToBase64(file);
    pendingRosterImage = { base64, mediaType: file.type, previewUrl: URL.createObjectURL(file) };
    renderRosterImage();
  } catch (err) {
    rosterErrorBox.textContent = "بارگذاری تصویر ناموفق بود.";
    rosterErrorBox.classList.remove("hidden");
  }
});

function renderRosterList() {
  if (state.characterRoster.length === 0) {
    rosterList.innerHTML = `<p class="hint-text small">هنوز کاراکتری ثبت نشده.</p>`;
    return;
  }
  rosterList.innerHTML = state.characterRoster
    .map(
      (c, i) => `<div class="segment-card">
        <div class="segment-header">
          <span class="segment-title cyan">${escapeHtml(c.name)} — ${escapeHtml(c.episode || "بدون اپیزود")}</span>
          <div style="display:flex; gap:10px;">
            <button class="btn-link" data-roster-copy="${i}">کپی</button>
            <button class="btn-link" data-roster-remove="${i}">حذف</button>
          </div>
        </div>
        <div style="display:flex; gap:10px; padding:10px;">
          <img src="${c.previewUrl}" alt="" class="small-thumb" style="flex-shrink:0" />
          <pre class="output-pre" dir="${state.outputLang === "en" ? "ltr" : "rtl"}" style="padding:0">${escapeHtml(c.description)}</pre>
        </div>
      </div>`
    )
    .join("");

  rosterList.querySelectorAll("[data-roster-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = state.characterRoster[Number(btn.dataset.rosterCopy)];
      navigator.clipboard.writeText(`${c.name} (${c.episode || "بدون اپیزود"}): ${c.description}`).then(() => flashCopied(btn));
    });
  });
  rosterList.querySelectorAll("[data-roster-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.characterRoster.splice(Number(btn.dataset.rosterRemove), 1);
      renderRosterList();
      saveDraft();
    });
  });
}

rosterAddBtn.addEventListener("click", async () => {
  const name = rosterNameInput.value.trim();
  const episode = rosterEpisodeInput.value.trim();
  if (!name || !pendingRosterImage) {
    rosterErrorBox.textContent = "لطفاً اسم کاراکتر و عکس مرجع را وارد کن.";
    rosterErrorBox.classList.remove("hidden");
    return;
  }
  rosterErrorBox.classList.add("hidden");
  rosterAddBtn.disabled = true;
  rosterAddBtn.textContent = "در حال ساخت توضیح...";

  try {
    const system =
      "You are a precise visual describer. Given one reference image, first identify the subject's actual species/type (human, animal, or otherwise) — never assume human by default. Then write a concise 2-3 sentence identity-lock description covering: species/type, facial features or fur/coloring, body build, and wardrobe if visible — written so it can be reused verbatim as a consistency reference in future video prompts. No preamble, just the description.";
    const contentBlocks = [
      { type: "image", source: { type: "base64", media_type: pendingRosterImage.mediaType, data: pendingRosterImage.base64 } },
      { type: "text", text: "Describe this character for reuse as a consistency reference." },
    ];
    const description = await callAI(system, [{ role: "user", content: contentBlocks }], 300);

    state.characterRoster.push({
      name,
      episode,
      base64: pendingRosterImage.base64,
      mediaType: pendingRosterImage.mediaType,
      previewUrl: pendingRosterImage.previewUrl,
      description,
    });
    saveDraft();
    renderRosterList();

    pendingRosterImage = null;
    renderRosterImage();
    rosterNameInput.value = "";
    rosterEpisodeInput.value = "";
  } catch (err) {
    rosterErrorBox.textContent = "ساخت توضیح ناموفق بود. دوباره تلاش کن.";
    rosterErrorBox.classList.remove("hidden");
  } finally {
    rosterAddBtn.disabled = false;
    rosterAddBtn.textContent = "افزودن کاراکتر";
  }
});

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
    const frames = await extractVideoFrames(file, 8);
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

  return `You are an elite AI video-generation prompt engineer specializing in character replacement. You are given ${state.swapVideoFrames.length} frames extracted in chronological order from an original video, PLUS one reference photo of a NEW character/subject (the final image provided). The subject in either the original footage or the reference photo may be a human, an animal, or another creature — first identify the actual species/type shown in each, never assume human by default.

Your job: write one finished prompt (target platform: ${platformLabel}, aspect ratio ${state.aspect}) that regenerates the ORIGINAL footage's action, camera work, environment, and lighting EXACTLY as observed in the frames, but with the subject in the footage replaced by the individual/creature shown in the reference photo — including replacing its species/body type if the reference photo shows a different one than the original footage (e.g., if the original footage shows an animal and the reference photo also shows an animal, the result must keep a full animal body, not shift toward a human one, and vice versa).

LENGTH & FOCUS: Keep the total prompt practical for real video-generation platforms — aim for roughly 150-250 words total across all sections combined. Prioritize the identity swap and the original action over secondary embellishments.

Structure the output with these exact uppercase section labels:

LOGLINE — one vivid sentence.
SCENE & SETTING — location, time of day, environment, exactly as seen in the original frames.
SUBJECT — describe the NEW subject using the reference photo's exact species/type, distinguishing features (facial features/hairstyle for a human; fur/coloring/body shape for an animal), and wardrobe if applicable, in detail. Explicitly state this identity — including its species/body type — replaces the original subject while everything else about the scene stays identical, with no drift into a different anatomy. Include a direct instruction such as: "Use the provided/attached reference photo for this subject's identity and body" — phrased so it still makes sense if the person also uploads that same reference photo directly into a video platform's own character/reference-image field, not just as a text description. WARDROBE LOCK: once described, the outfit must stay identical for the entire clip, with no changes partway through.
ACTION & TIMELINE — the same action/motion observed across the original frames, described as staged beats: OPENING, DEVELOPMENT, MAIN MOMENT, ENDING.
CAMERA — shot type, framing, movement, exactly as in the original. Give ONE coherent camera movement, not several conflicting ones.
LIGHTING & COLOR — as observed in the original footage.
ATMOSPHERE & STYLE — as observed.
NEGATIVE / AVOID — should explicitly include an instruction not to retain the original subject's identity, species/body type, or wardrobe.

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

    const text = await callAI(buildCharacterSwapSystemPrompt(), [{ role: "user", content: contentBlocks }], 2600);
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
  return `You are a viral social media strategist specializing in catchy, high-click-through titles/captions and platform-specific hashtag research for short-form video.

Given a short description of a video's topic/idea, produce:

TITLES — exactly 8 catchy, scroll-stopping, user-friendly title/caption options in English, each on its own line, numbered 1-8. Vary the style across the list (curiosity-driven, bold claim, funny, relatable, question-based, etc). Keep each under 12 words.
HASHTAGS FOR INSTAGRAM — a single line of 15-20 relevant English hashtags suited to Instagram's culture (mix of broad reach tags, niche/community tags, and a couple of Reels-specific tags), space-separated, each starting with #.
HASHTAGS FOR TIKTOK — a single line of 15-20 relevant English hashtags suited to TikTok's culture (mix of trending/For-You-Page tags, challenge-style tags, and niche tags), space-separated, each starting with #. This list should genuinely differ from the Instagram list, not just repeat it — TikTok hashtag culture favors trend/challenge phrasing over Instagram's more descriptive/niche style.

Do not add any preamble, explanation, or markdown formatting like asterisks. Just the three labeled sections exactly as specified above.`;
}

titlesGenerateBtn.addEventListener("click", async () => {
  const topic = ideaInput.value.trim();
  if (!topic) {
    titlesErrorBox.textContent = "لطفاً اول ایده‌ی کلی ویدیو رو بالای صفحه بنویس.";
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

// ---------- Auto-save draft (so work isn't lost when switching apps) ----------
const DRAFT_KEY = "video-prompt-draft-v1";

function saveDraft() {
  try {
    const draft = {
      idea: ideaInput.value,
      styleNotes: styleNotesInput.value,
      musicStyle: musicStyleInput.value,
      platform: state.platform,
      aspect: state.aspect,
      duration: state.duration,
      outputLang: state.outputLang,
      provider: state.provider,
      splitEnabled: state.splitEnabled,
      segmentCount: state.segmentCount,
      hasDialogue: state.hasDialogue,
      musicEnabled: state.musicEnabled,
      selectedPreset: state.selectedPreset,
      images: state.images.map((img) => ({ base64: img.base64, mediaType: img.mediaType })),
      result: state.result,
      characterRoster: state.characterRoster.map((c) => ({
        name: c.name,
        episode: c.episode,
        base64: c.base64,
        mediaType: c.mediaType,
        description: c.description,
      })),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    // storage full or unavailable — not critical, skip silently
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);

    ideaInput.value = draft.idea || "";
    styleNotesInput.value = draft.styleNotes || "";
    state.idea = draft.idea || "";
    musicStyleInput.value = draft.musicStyle || "";

    state.platform = draft.platform || state.platform;
    state.aspect = draft.aspect || state.aspect;
    state.duration = draft.duration || state.duration;
    state.outputLang = draft.outputLang || state.outputLang;
    state.provider = draft.provider || state.provider;
    state.splitEnabled = !!draft.splitEnabled;
    state.segmentCount = draft.segmentCount || state.segmentCount;
    state.hasDialogue = !!draft.hasDialogue;
    state.musicEnabled = !!draft.musicEnabled;
    state.selectedPreset = draft.selectedPreset || null;
    state.result = draft.result || "";

    if (Array.isArray(draft.images)) {
      state.images = draft.images.map((img) => ({
        id: Math.random().toString(36).slice(2),
        base64: img.base64,
        mediaType: img.mediaType,
        previewUrl: `data:${img.mediaType};base64,${img.base64}`,
      }));
    }

    if (Array.isArray(draft.characterRoster)) {
      state.characterRoster = draft.characterRoster.map((c) => ({
        ...c,
        previewUrl: `data:${c.mediaType};base64,${c.base64}`,
      }));
    }
  } catch (e) {
    // corrupted draft — ignore and start fresh
  }
}

function syncUIFromState() {
  setSwitch(splitToggle, state.splitEnabled);
  segmentCountRow.classList.toggle("hidden", !state.splitEnabled);

  setSwitch(dialogueToggle, state.hasDialogue);
  dialogueSub.textContent = state.hasDialogue
    ? "روشن — شخصیت‌ها می‌توانند صحبت کنند"
    : "خاموش — ویدیو بدون هیچ صحبت یا لب‌زدنی خواهد بود";

  setSwitch(musicToggle, state.musicEnabled);
  musicStyleInput.classList.toggle("hidden", !state.musicEnabled);

  if (state.outputLang === "fa") {
    langFaBtn.classList.add("active");
    langEnBtn.classList.remove("active");
  } else {
    langEnBtn.classList.add("active");
    langFaBtn.classList.remove("active");
  }

  providerClaudeBtn.classList.toggle("active", state.provider === "anthropic");
  providerGeminiBtn.classList.toggle("active", state.provider === "gemini");
  providerZaiBtn.classList.toggle("active", state.provider === "zai");
}

// ---------- Init ----------
loadDraft();
initSelects();
syncUIFromState();
renderStylePresets();
renderImages();
renderResult();
renderLipsyncImage();
renderSwapImage();
renderRosterImage();
renderRosterList();

setInterval(saveDraft, 2000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) saveDraft();
});
window.addEventListener("pagehide", saveDraft);
