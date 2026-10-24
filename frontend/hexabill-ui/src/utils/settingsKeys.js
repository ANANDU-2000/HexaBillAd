/**
 * Case- and underscore-insensitive settings lookup.
 * ASP.NET CamelCase JSON policy lowercases only the first letter of dictionary keys
 * (e.g. Feature_DocumentStampSignature → feature_DocumentStampSignature), and the API client then
 * camel-cases every key (PRINT_MARGIN_TOP_MM → printMarginTopMm), so exact-key reads miss flags and
 * print margins and the Settings page would save defaults back over the stored values.
 */
const looseKey = (k) => String(k).replace(/_/g, '').toLowerCase()

export function getSetting(data, key, fallback = undefined) {
  if (!data || key == null) return fallback
  if (Object.prototype.hasOwnProperty.call(data, key) && data[key] != null && data[key] !== '') {
    return data[key]
  }
  const lower = looseKey(key)
  for (const k of Object.keys(data)) {
    if (looseKey(k) === lower) {
      const v = data[k]
      if (v != null && v !== '') return v
    }
  }
  // Try camelCase first-letter variant explicitly
  const camel = key.charAt(0).toLowerCase() + key.slice(1)
  if (Object.prototype.hasOwnProperty.call(data, camel) && data[camel] != null && data[camel] !== '') {
    return data[camel]
  }
  return fallback
}

export function getSettingBool(data, key, fallback = false) {
  const raw = getSetting(data, key, null)
  if (raw == null) return fallback
  if (typeof raw === 'boolean') return raw
  return String(raw).toLowerCase() === 'true'
}
