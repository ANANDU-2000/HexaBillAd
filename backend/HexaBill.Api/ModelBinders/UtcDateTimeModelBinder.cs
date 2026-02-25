using Microsoft.AspNetCore.Mvc.ModelBinding;
using System;
using System.Globalization;
using System.Threading.Tasks;

namespace HexaBill.Api.ModelBinders
{
    /// <summary>
    /// CRITICAL: Automatically converts ALL query string DateTime parameters to UTC
    /// Solves ASP.NET Core default DateTimeKind.Unspecified issue for PostgreSQL
    /// </summary>
    public class UtcDateTimeModelBinder : IModelBinder
    {
        public Task BindModelAsync(ModelBindingContext bindingContext)
        {
            if (bindingContext == null)
                throw new ArgumentNullException(nameof(bindingContext));

            var modelName = bindingContext.ModelName;
            var valueProviderResult = bindingContext.ValueProvider.GetValue(modelName);

            if (valueProviderResult == ValueProviderResult.None)
                return Task.CompletedTask;

            bindingContext.ModelState.SetModelValue(modelName, valueProviderResult);

            var value = valueProviderResult.FirstValue;

            if (string.IsNullOrEmpty(value))
                return Task.CompletedTask;

            // CRITICAL: Try YYYY-MM-DD first (API standard), then DD-MM-YYYY (locale fallback)
            var formats = new[] { "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ssZ", "dd-MM-yyyy", "dd/MM/yyyy" };
            DateTime dateTime;
            if ((DateTime.TryParseExact(value.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out dateTime) ||
                 DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out dateTime)))
            {
                // CRITICAL FIX: Convert Kind.Unspecified to Kind.Utc for PostgreSQL compatibility
                if (dateTime.Kind == DateTimeKind.Unspecified)
                {
                    dateTime = DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);
                }
                else if (dateTime.Kind == DateTimeKind.Local)
                {
                    dateTime = dateTime.ToUniversalTime();
                }

                bindingContext.Result = ModelBindingResult.Success(dateTime);
            }
            else
            {
                bindingContext.ModelState.TryAddModelError(modelName, "Invalid datetime format");
            }

            return Task.CompletedTask;
        }
    }

    /// <summary>
    /// Model binder provider that applies UtcDateTimeModelBinder to ALL DateTime parameters
    /// </summary>
    public class UtcDateTimeModelBinderProvider : IModelBinderProvider
    {
        public IModelBinder GetBinder(ModelBinderProviderContext context)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            if (context.Metadata.ModelType == typeof(DateTime) || 
                context.Metadata.ModelType == typeof(DateTime?))
            {
                return new UtcDateTimeModelBinder();
            }

            return null;
        }
    }
}
