# Arabic Font Setup for Invoice PDF Generation - CRITICAL FOR PRODUCTION

## ⚠️ Problem
Arabic text shows as **question marks (??????)** in production PDFs because fonts are not embedded.

## ✅ Solution
Download and embed free Arabic fonts that support both Arabic and English characters.

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Download Fonts

**EASIEST METHOD - Direct Download:**

1. Go to: https://fonts.google.com/noto/specimen/Noto+Sans+Arabic
2. Click the **"Download family"** button
3. Extract the ZIP file
4. Copy these TWO files to this `Fonts` folder:
   - `NotoSansArabic-Regular.ttf`
   - `NotoSansArabic-Bold.ttf`

**ALTERNATIVE - Use PowerShell (Windows):**
```powershell
# Open PowerShell in this directory and run:
Invoke-WebRequest -Uri "https://github.com/notofonts/arabic/raw/main/fonts/NotoSansArabic/full/ttf/NotoSansArabic-Regular.ttf" -OutFile "NotoSansArabic-Regular.ttf"
Invoke-WebRequest -Uri "https://github.com/notofonts/arabic/raw/main/fonts/NotoSansArabic/full/ttf/NotoSansArabic-Bold.ttf" -OutFile "NotoSansArabic-Bold.ttf"
```

**ALTERNATIVE - Use curl (Linux/Mac):**
```bash
curl -L "https://github.com/notofonts/arabic/raw/main/fonts/NotoSansArabic/full/ttf/NotoSansArabic-Regular.ttf" -o "NotoSansArabic-Regular.ttf"
curl -L "https://github.com/notofonts/arabic/raw/main/fonts/NotoSansArabic/full/ttf/NotoSansArabic-Bold.ttf" -o "NotoSansArabic-Bold.ttf"
```

### Step 2: Verify Installation

After downloading, this folder should contain:
```
Fonts/
├── NotoSansArabic-Regular.ttf  ✅
├── NotoSansArabic-Bold.ttf     ✅
├── FONT_DOWNLOAD_INSTRUCTIONS.md
└── download-fonts.ps1
```

### Step 3: Deploy

1. **For Development:**
   ```bash
   dotnet build
   dotnet run
   ```

2. **For Production:**
   ```bash
   dotnet publish -c Release
   # Deploy the published files including the Fonts folder
   ```

---

## 📋 Alternative Fonts (If Noto Sans Arabic doesn't work)

### Option 2: Amiri (Classical Arabic)
- Download: https://fonts.google.com/specimen/Amiri
- Files needed:
  - `Amiri-Regular.ttf`
  - `Amiri-Bold.ttf`

### Option 3: Cairo (Modern Arabic)
- Download: https://fonts.google.com/specimen/Cairo
- Files needed:
  - `Cairo-Regular.ttf`
  - `Cairo-Bold.ttf`

---

## 🔍 How to Check if Fonts Are Working

1. **Application Startup Logs:**
   Look for these messages when the app starts:
   ```
   ✅ Registered Noto Sans Arabic Regular from: Fonts/NotoSansArabic-Regular.ttf
   ✅ Registered Noto Sans Arabic Bold from: Fonts/NotoSansArabic-Bold.ttf
   ✅ Arabic Font Family: Noto Sans Arabic
   ✅ PDF Service initialized with Arabic font: Noto Sans Arabic
   ```

2. **Generate a Test Invoice:**
   - Create a sale with Arabic customer name
   - Print/Download the invoice PDF
   - Open the PDF - Arabic text should display correctly (NOT ??????)

3. **If You See Warnings:**
   ```
   ⚠️ No Arabic fonts found in Fonts directory
   ⚠️ Using system fallback: Tahoma
   ```
   This means fonts are missing - follow Step 1 again.

---

## 🛠️ Technical Details

### Why This Solution Works:
- ✅ Fonts are **embedded directly into PDF files**
- ✅ No system fonts required on production server
- ✅ Works on **Windows, Linux, Docker, Azure, AWS**, any hosting
- ✅ Arabic text renders correctly in **all PDF viewers**
- ✅ **Print-ready** with proper font embedding
- ✅ Uses **open-source, license-free fonts** (SIL Open Font License)

### Files Modified:
- `Services/FontService.cs` - Font registration service
- `Services/PdfService.cs` - Updated to use embedded fonts
- `Program.cs` - Registers FontService as singleton
- `HexaBill.Api.csproj` - Copies Fonts folder to published output

---

## 🚨 Production Deployment Checklist

- [ ] Download `NotoSansArabic-Regular.ttf` to `Fonts/` folder
- [ ] Download `NotoSansArabic-Bold.ttf` to `Fonts/` folder
- [ ] Verify files exist (check file sizes > 100KB each)
- [ ] Build application: `dotnet build`
- [ ] Check startup logs for "✅ Registered Noto Sans Arabic"
- [ ] Test invoice generation with Arabic text
- [ ] Verify Arabic displays correctly (not ??????)
- [ ] Deploy to production with Fonts folder included
- [ ] Test production deployment with sample invoice

---

## 📞 Troubleshooting

**Problem: Still seeing ??????**
- ✅ Check: Are .ttf files in the Fonts folder?
- ✅ Check: Did you rebuild after adding fonts?
- ✅ Check: Are fonts included in published output?
- ✅ Check: Application startup logs for font registration

**Problem: Fonts not loading**
- ✅ Check: File names must be EXACT (case-sensitive on Linux)
- ✅ Check: Files should be ~150-300KB each (not empty)
- ✅ Check: .csproj includes Fonts folder in publish

**Problem: Application crashes on startup**
- ✅ Check: Font files are valid TTF format
- ✅ Check: No corruption during download
- ✅ Re-download fonts from official source

---

## 📄 License

Noto Sans Arabic is licensed under the **SIL Open Font License 1.1**
- ✅ Free for commercial use
- ✅ Can be embedded in PDFs
- ✅ No attribution required
- License: https://scripts.sil.org/OFL
