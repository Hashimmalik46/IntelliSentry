import { supabase } from '../supabaseClient';

export const DEFAULT_CURFEW_CONFIG = {
  startHour: 17, // 5:00 PM
  endHour: 8,    // 8:00 AM
  warningMins: 60 // 60 mins before curfew start
};

export const getCurfewConfig = () => {
  try {
    const saved = localStorage.getItem('intellisentry_curfew_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        startHour: Number(parsed.startHour ?? 17),
        endHour: Number(parsed.endHour ?? 8),
        warningMins: Number(parsed.warningMins ?? 60)
      };
    }
  } catch (e) {
    console.warn("Failed reading curfew config:", e);
  }
  return DEFAULT_CURFEW_CONFIG;
};

export const saveCurfewConfig = async (config) => {
  const normalized = {
    startHour: Number(config.startHour),
    endHour: Number(config.endHour),
    warningMins: Number(config.warningMins)
  };
  
  try {
    localStorage.setItem('intellisentry_curfew_config', JSON.stringify(normalized));
    await supabase.from('system_settings').upsert([
      { key: 'curfew_config', value: normalized }
    ], { onConflict: 'key' });
  } catch (e) {
    console.warn("Curfew config save notice:", e);
  }
  return normalized;
};

export const fetchRemoteCurfewConfig = async () => {
  try {
    const { data } = await supabase.from('system_settings').select('*').eq('key', 'curfew_config');
    if (data && data.length > 0 && data[0].value) {
      const config = data[0].value;
      const normalized = {
        startHour: Number(config.startHour ?? 17),
        endHour: Number(config.endHour ?? 8),
        warningMins: Number(config.warningMins ?? 60)
      };
      localStorage.setItem('intellisentry_curfew_config', JSON.stringify(normalized));
      return normalized;
    }
  } catch (e) {
    // Graceful fallback to localStorage
  }
  return getCurfewConfig();
};

export const formatHourLabel = (hour) => {
  const h = Number(hour);
  if (h === 0) return '12:00 AM (Midnight)';
  if (h === 12) return '12:00 PM (Noon)';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
};
