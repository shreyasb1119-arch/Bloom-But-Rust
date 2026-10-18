import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../bridge/backend";

// WMO weather interpretation codes: https://open-meteo.com/en/docs#weathervariables
const WMO_CODES: Record<number, string> = {
	0: "Clear",
	1: "Mostly Clear",
	2: "Partly Cloudy",
	3: "Overcast",
	45: "Foggy",
	48: "Foggy",
	51: "Drizzle",
	53: "Drizzle",
	55: "Drizzle",
	56: "Freezing Drizzle",
	57: "Freezing Drizzle",
	61: "Rainy",
	63: "Rainy",
	65: "Rainy",
	66: "Freezing Rain",
	67: "Freezing Rain",
	71: "Snowy",
	73: "Snowy",
	75: "Snowy",
	77: "Snowy",
	80: "Rain Showers",
	81: "Rain Showers",
	82: "Rain Showers",
	85: "Snow Showers",
	86: "Snow Showers",
	95: "Stormy",
	96: "Stormy",
	99: "Stormy"
};

export function weatherEmoji(condition: string, isDay = true): string {
	switch (condition) {
		case "Clear":
		case "Mostly Clear":
			return isDay ? "☀️" : "🌙";
		case "Partly Cloudy":
			return isDay ? "⛅" : "☁️";
		case "Overcast":
			return "☁️";
		case "Foggy":
			return "🌫️";
		case "Drizzle":
		case "Freezing Drizzle":
		case "Rainy":
		case "Rain Showers":
		case "Freezing Rain":
			return "🌧️";
		case "Snowy":
		case "Snow Showers":
			return "❄️";
		case "Stormy":
			return "⛈️";
		default:
			return "🌡️";
	}
}

export interface ForecastDay {
	date: string;
	condition: string;
	isToday: boolean;
	max: number;
	min: number;
}

export interface Forecast {
	city: string;
	temperature: number;
	feelsLike: number;
	humidity: number;
	wind: number;
	condition: string;
	isDay: boolean;
	days: ForecastDay[];
}

interface Location {
	lat: number;
	lon: number;
	city?: string;
}

async function resolveLocation(): Promise<Location> {
	// Saved coordinates first.
	try {
		const settings = await invoke<Record<string, string>>("load_settings");
		const lat = settings["bloom-weather-lat"];
		const lon = settings["bloom-weather-lon"];
		if (lat && lon) {
			return {
				lat: parseFloat(lat),
				lon: parseFloat(lon),
				city: settings["bloom-weather-city"] || undefined
			};
		}
	} catch {
		// fall through to IP lookup
	}

	try {
		const response = await fetch("https://ipapi.co/json/");
		if (response.ok) {
			const data = await response.json();
			const lat = data.latitude || data.lat;
			const lon = data.longitude || data.lon;
			if (lat && lon) return { lat, lon, city: data.city || undefined };
		}
	} catch {
		// try the fallback
	}

	try {
		const response = await fetch("http://ip-api.com/json/?fields=status,lat,lon,city,country");
		if (response.ok) {
			const data = await response.json();
			if (data.lat && data.lon) return { lat: data.lat, lon: data.lon, city: data.city || undefined };
		}
	} catch {
		// fall through to the default
	}

	return { lat: 28.6139, lon: 77.209, city: "Delhi" };
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { unit: string; at: number; data: Forecast } | null = null;

async function fetchForecast(unit: string): Promise<Forecast> {
	const location = await resolveLocation();
	const fahrenheit = unit === "fahrenheit";
	const unitParams = fahrenheit ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "";
	const response = await fetch(
		`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}` +
			"&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day" +
			"&daily=weather_code,temperature_2m_max,temperature_2m_min" +
			`&forecast_days=5&timezone=auto${unitParams}`
	);
	if (!response.ok) throw new Error(`Forecast API returned ${response.status}`);
	const data = await response.json();
	const current = data?.current;
	const daily = data?.daily;
	if (!current || !daily?.time || current.temperature_2m == null) {
		throw new Error("Invalid forecast response");
	}

	return {
		city: location.city || "Current location",
		temperature: Math.round(current.temperature_2m),
		feelsLike: Math.round(current.apparent_temperature),
		humidity: Math.round(current.relative_humidity_2m),
		wind: Math.round(current.wind_speed_10m),
		condition: WMO_CODES[current.weather_code] || "Unknown",
		isDay: current.is_day === 1,
		days: (daily.time as string[]).map((date, i) => ({
			date,
			condition: WMO_CODES[daily.weather_code[i]] || "Unknown",
			isToday: i === 0,
			max: Math.round(daily.temperature_2m_max[i]),
			min: Math.round(daily.temperature_2m_min[i])
		}))
	};
}

export function useForecast(unit: string) {
	const fresh = cache && cache.unit === unit && Date.now() - cache.at < CACHE_TTL_MS;
	const [data, setData] = useState<Forecast | null>(cache && cache.unit === unit ? cache.data : null);
	const [loading, setLoading] = useState(!fresh);
	const [error, setError] = useState<string | null>(null);
	const alive = useRef(true);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await fetchForecast(unit);
			cache = { unit, at: Date.now(), data: result };
			if (alive.current) setData(result);
		} catch {
			if (alive.current) setError("Couldn't load the forecast. Check your connection.");
		} finally {
			if (alive.current) setLoading(false);
		}
	}, [unit]);

	useEffect(() => {
		alive.current = true;
		if (!(cache && cache.unit === unit && Date.now() - cache.at < CACHE_TTL_MS)) void load();
		return () => {
			alive.current = false;
		};
	}, [unit, load]);

	return { data, loading, error, reload: load };
}
