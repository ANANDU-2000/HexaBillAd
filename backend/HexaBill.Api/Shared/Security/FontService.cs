/*Purpose: Font Service for managing custom fonts in PDF generation
Author: AI Assistant
Date: 2024
*/
using QuestPDF.Infrastructure;

namespace HexaBill.Api.Shared.Security
{
    public interface IFontService
    {
        void RegisterFonts();
        string GetArabicFontFamily();
        string GetEnglishFontFamily();
    }

    public class FontService : IFontService
    {
        private readonly ILogger<FontService> _logger;
        private bool _fontsRegistered = false;
        private string _arabicFontFamily = "Arial"; // Fallback
        private string _englishFontFamily = "Arial"; // Fallback
        private readonly List<Stream> _fontStreams = new(); // Keep streams open

        public FontService(ILogger<FontService> logger)
        {
            _logger = logger;
        }

        public void RegisterFonts()
        {
            if (_fontsRegistered)
            {
                _logger.LogInformation("? Fonts already registered");
                return;
            }

            // CRITICAL: Wrap entire font registration in try-catch to prevent native crashes
            // QuestPDF's FontManager.RegisterFont can crash with access violations if fonts are corrupted or inaccessible
            try
            {
                var fontsDir = Path.Combine(Directory.GetCurrentDirectory(), "Fonts");
                
                if (!Directory.Exists(fontsDir))
                {
                    _logger.LogWarning("?? Fonts directory not found: {FontsDir}", fontsDir);
                    _logger.LogWarning("?? Using system fallback fonts. Arabic may not render correctly.");
                    _arabicFontFamily = "Tahoma"; // System fallback
                    _englishFontFamily = "Arial";
                    _fontsRegistered = true;
                    return;
                }

                // Try to register Noto Sans Arabic (recommended)
                var notoRegular = Path.Combine(fontsDir, "NotoSansArabic-Regular.ttf");
                var notoBold = Path.Combine(fontsDir, "NotoSansArabic-Bold.ttf");
                
                if (File.Exists(notoRegular))
                {
                    try
                    {
                        // CRITICAL: QuestPDF FontManager can crash with access violations - wrap in try-catch
                        // Keep stream open for QuestPDF
                        var stream = File.OpenRead(notoRegular);
                        _fontStreams.Add(stream);
                        QuestPDF.Drawing.FontManager.RegisterFont(stream);
                        _arabicFontFamily = "Noto Sans Arabic";
                        _logger.LogInformation("? Registered Noto Sans Arabic Regular from: {Path}", notoRegular);
                    }
                    catch (System.AccessViolationException avEx)
                    {
                        // CRITICAL: Catch access violations to prevent process crash
                        _logger.LogError(avEx, "❌ Access violation while registering Noto Sans Arabic Regular - font may be corrupted");
                        _arabicFontFamily = "Tahoma"; // Fallback
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "? Failed to register Noto Sans Arabic Regular: {Error}", ex.Message);
                    }
                }
                else
                {
                    _logger.LogWarning("?? Font file not found: {Path}", notoRegular);
                }

                if (File.Exists(notoBold))
                {
                    try
                    {
                        // Keep stream open for QuestPDF
                        var stream = File.OpenRead(notoBold);
                        _fontStreams.Add(stream);
                        QuestPDF.Drawing.FontManager.RegisterFont(stream);
                        _logger.LogInformation("? Registered Noto Sans Arabic Bold from: {Path}", notoBold);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "? Failed to register Noto Sans Arabic Bold");
                    }
                }
                else
                {
                    _logger.LogWarning("?? Font file not found: {Path}", notoBold);
                }

                // Try alternative fonts: Amiri
                var amiriRegular = Path.Combine(fontsDir, "Amiri-Regular.ttf");
                var amiriBold = Path.Combine(fontsDir, "Amiri-Bold.ttf");
                
                if (File.Exists(amiriRegular) && _arabicFontFamily == "Arial")
                {
                    try
                    {
                        var stream = File.OpenRead(amiriRegular);
                        _fontStreams.Add(stream);
                        QuestPDF.Drawing.FontManager.RegisterFont(stream);
                        _arabicFontFamily = "Amiri";
                        _logger.LogInformation("? Registered Amiri Regular from: {Path}", amiriRegular);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "? Failed to register Amiri Regular");
                    }
                }

                if (File.Exists(amiriBold))
                {
                    try
                    {
                        var stream = File.OpenRead(amiriBold);
                        _fontStreams.Add(stream);
                        QuestPDF.Drawing.FontManager.RegisterFont(stream);
                        _logger.LogInformation("? Registered Amiri Bold from: {Path}", amiriBold);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "? Failed to register Amiri Bold");
                    }
                }

                // Try alternative fonts: Cairo
                var cairoRegular = Path.Combine(fontsDir, "Cairo-Regular.ttf");
                var cairoBold = Path.Combine(fontsDir, "Cairo-Bold.ttf");
                
                if (File.Exists(cairoRegular) && _arabicFontFamily == "Arial")
                {
                    try
                    {
                        var stream = File.OpenRead(cairoRegular);
                        _fontStreams.Add(stream);
                        QuestPDF.Drawing.FontManager.RegisterFont(stream);
                        _arabicFontFamily = "Cairo";
                        _logger.LogInformation("? Registered Cairo Regular from: {Path}", cairoRegular);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "? Failed to register Cairo Regular");
                    }
                }

                if (File.Exists(cairoBold))
                {
                    try
                    {
                        var stream = File.OpenRead(cairoBold);
                        _fontStreams.Add(stream);
                        QuestPDF.Drawing.FontManager.RegisterFont(stream);
                        _logger.LogInformation("? Registered Cairo Bold from: {Path}", cairoBold);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "? Failed to register Cairo Bold");
                    }
                }

                // If no custom fonts were loaded, use system fallback
                if (_arabicFontFamily == "Arial")
                {
                    _logger.LogWarning("?? No Arabic fonts found in {FontsDir}", fontsDir);
                    _logger.LogWarning("?? Please download fonts as per Fonts/FONT_DOWNLOAD_INSTRUCTIONS.md");
                    _logger.LogWarning("?? Using system fallback: Tahoma");
                    _arabicFontFamily = "Tahoma";
                }
                else
                {
                    _logger.LogInformation("? Arabic Font Family: {FontFamily}", _arabicFontFamily);
                }

                _englishFontFamily = "Arial";
                _fontsRegistered = true;
                
                _logger.LogInformation("? Font registration completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "? Font registration failed");
                _arabicFontFamily = "Tahoma"; // System fallback
                _englishFontFamily = "Arial";
                _fontsRegistered = true;
            }
        }

        public string GetArabicFontFamily()
        {
            if (!_fontsRegistered)
            {
                RegisterFonts();
            }
            return _arabicFontFamily;
        }

        public string GetEnglishFontFamily()
        {
            if (!_fontsRegistered)
            {
                RegisterFonts();
            }
            return _englishFontFamily;
        }
    }
}
