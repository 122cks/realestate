// Simple geocoding utility using OpenStreetMap Nominatim and localStorage cache
// Note: For production use, replace with a proper geocoding provider and API key.

const CACHE_KEY = 'geocode_cache_v1';

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // ignore
  }
}

export async function geocodeAddress(address) {
  if (!address) return null;
  const key = address.trim();
  const cache = loadCache();
  if (cache[key]) return cache[key];

  // Use Nominatim (OpenStreetMap) for geocoding (no API key required)
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    key
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'ko',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    const { lat, lon } = data[0];
    const result = { lat: parseFloat(lat), lng: parseFloat(lon) };
    cache[key] = result;
    saveCache(cache);
    return result;
  } catch (err) {
    console.warn('geocode error', err);
    return null;
  }
}

export async function batchGeocode(items, getAddress, onProgress) {
  // items: array of arbitrary objects
  // getAddress: fn(item) => address string
  // onProgress: fn(done, total)
  const toGeocode = items.filter((it) => {
    const addr = getAddress(it);
    return addr && (!it.lat || !it.lng);
  });

  const total = toGeocode.length;
  let done = 0;
  onProgress && onProgress(done, total);

  for (const it of toGeocode) {
    try {
      const addr = getAddress(it);
      const geo = await geocodeAddress(addr);
      if (geo) {
        // caller is expected to update the item state
        // we just notify via onProgress
      }
    } catch (e) {
      // ignore per-item errors
    }
    done += 1;
    onProgress && onProgress(done, total);
    // be gentle to Nominatim (rate-limit)
    await new Promise((r) => setTimeout(r, 1100));
  }
}

export function clearGeocodeCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {}
}
