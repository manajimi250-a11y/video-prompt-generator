# 🎬 پرامت‌ساز ویدیو

اپلیکیشن وب برای ساخت پرامت‌های کامل و دقیق ویدیو (برای Sora، Veo، Kling، Runway و...) از روی یک ایده کلی و عکس‌های مرجع. شامل امکاناتی مثل:

- تولید پرامت ساختاریافته (صحنه، دوربین، نور، اکشن، صدا و...)
- انتخاب سبک ویدیو (سینمایی، کمدی، انیمیشن، تیک‌تاکی و...)
- تقسیم به چند پرامت متوالی برای ویدیوهای طولانی‌تر (با حفظ تداوم صحنه)
- حفظ چهره‌های مرجع در تمام خروجی
- روشن/خاموش کردن دیالوگ
- افزودن بخش موزیک به پرامت
- تبدیل یک ویدیوی واقعی به پرامت کامل (Video → Prompt)

این پروژه یک سرور Node.js ساده (Express) دارد که از سمت سرور با **Claude (آنتروپیک)** یا **Gemini (گوگل)** صحبت می‌کند (کلید API هرگز در مرورگر/کلاینت دیده نمی‌شود؛ داخل اپ می‌تونی بین این دو جابه‌جا بشی) و یک صفحه‌ی وب ساده (بدون نیاز به build) با تم بصری «Cinematic Synthetic» (شیشه‌ای تیره، بنفش/سایان) که در Termux هم به‌راحتی اجرا می‌شود.

---

## 📱 اجرا در Termux

### ۱. نصب پیش‌نیازها
```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
```
بررسی نسخه Node (باید ۱۸ یا بالاتر باشد):
```bash
node -v
```

### ۲. گرفتن پروژه
اگر پروژه را در گیت‌هاب گذاشتی:
```bash
git clone https://github.com/USERNAME/video-prompt-generator.git
cd video-prompt-generator
```
یا اگر فایل‌ها را مستقیم روی گوشی داری، به همان پوشه برو:
```bash
cd /path/to/video-prompt-generator
```

### ۳. نصب پکیج‌ها
```bash
npm install
```

### ۴. تنظیم کلید API
```bash
cp .env.example .env
nano .env
```
مقدار `ANTHROPIC_API_KEY` را با کلید خودت (از [console.anthropic.com](https://console.anthropic.com)) جایگزین کن.

اگه می‌خوای از **Gemini رایگان گوگل** هم استفاده کنی (و داخل اپ بین Claude/Gemini جابه‌جا بشی)، یک کلید رایگان از [aistudio.google.com](https://aistudio.google.com) بگیر و جلوی `GEMINI_API_KEY` بذار. پر کردن این بخش اختیاریه — اگه خالی بمونه فقط دکمه‌ی Claude کار می‌کنه.

یه گزینه‌ی سوم هم هست: **Z.ai** (مدل‌های GLM) — کاملاً رایگان، بدون کارت بانکی، از [z.ai](https://z.ai) کلید بگیر و جلوی `ZAI_API_KEY` بذار. ⚠️ توجه: مدل رایگان Z.ai فقط متنیه و از عکس/ویدیو پشتیبانی نمی‌کنه، پس فقط برای بخش‌های متنی اپ (مثل «عنوان و هشتگ وایرال») قابل استفاده‌ست.

سپس فایل رو ذخیره کن (در nano: `Ctrl+O` سپس `Enter`، بعد `Ctrl+X`).

### ۵. اجرا
```bash
npm start
```
حالا در مرورگر گوشی برو به:
```
http://localhost:3000
```

> برای اینکه سرور با بسته شدن Termux قطع نشود، می‌توانی از `pkg install tmux` یا `termux-wake-lock` کمک بگیری.

---

## 💻 اجرا روی کامپیوتر (اختیاری)
همان مراحل بالا (از مرحله ۳ به بعد) روی هر سیستمی با Node.js نسخه ۱۸+ کار می‌کند.

---

## 🚀 آپلود پروژه در گیت‌هاب

### ۱. یک ریپازیتوری جدید بساز
در [github.com/new](https://github.com/new) یک ریپازیتوری خالی (بدون README) به اسم `video-prompt-generator` بساز.

### ۲. از داخل پوشه پروژه (در Termux یا کامپیوتر):
```bash
git init
git add .
git commit -m "اولین نسخه پرامت‌ساز ویدیو"
git branch -M main
git remote add origin https://github.com/USERNAME/video-prompt-generator.git
git push -u origin main
```
به‌جای `USERNAME` نام کاربری گیت‌هاب خودت را بگذار.

> فایل `.env` هرگز آپلود نمی‌شود (داخل `.gitignore` قرار دارد) پس کلید API‌ات لو نمی‌رود. هرکس این پروژه را دانلود کند باید کلید API خودش را در `.env` بگذارد.

### ۳. آپدیت‌های بعدی
```bash
git add .
git commit -m "توضیح تغییرات"
git push
```

---

## 📁 ساختار پروژه
```
video-prompt-generator/
├── server.js          # سرور Express — پراکسی امن به Anthropic API
├── package.json
├── .env.example       # نمونه فایل تنظیمات (کلید API)
├── public/
│   ├── index.html     # رابط کاربری
│   ├── style.css       # استایل (تم تاریک سینمایی)
│   └── app.js          # منطق برنامه (استخراج فریم ویدیو، فراخوانی API، رندر خروجی)
```

## ⚠️ نکته
مدل استفاده‌شده `claude-sonnet-4-6` است. اگر خطای مدل گرفتی، در `server.js` نام مدل را با مدل فعال حساب API خودت جایگزین کن.
