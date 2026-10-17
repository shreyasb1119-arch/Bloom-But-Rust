import { useCallback, useEffect, useRef, useState } from "react";
import { resolveLocation, WMO_CODES } from "./useWeather";

export interface ForecastDay {
	date: string;
	condition: string;
	isToday: boolean;
	max: number;
	min: number;
	rain: number | null;
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

const FORECAST_DAYS = 5;
const CACHE_TTL_MS = 10 * 60 * 1000;

// Survives the panel closing, so reopening it is instant.
let cache: { unit: string; at: number; data: Forecast } | null = null;

async function fetchForecast(unit: string): Promise<Forecast> {
	const location = await resolveLocation();
	const fahrenheit = unit === "fahrenheit";
	const unitParams = fahrenheit ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "";
	const res = await fetch(
		`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}` +
			"&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day" +
			"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
			`&forecast_days=${FORECAST_DAYS}&timezone=auto${unitParams}`
	);
	if (!res.ok) throw new Error(`Forecast API returned ${res.status}`);
	const data = await res.json();
	const cur = data?.current;
	const daily = data?.daily;
	if (!cur || !daily?.time || cur.temperature_2m == null) {
		throw new Error("Invalid forecast response");
	}

	const days: ForecastDay[] = (daily.time as string[]).map((date, i) => ({
		date,
		condition: WMO_CODES[daily.weather_code[i]] || "Unknown",
		isToday: i === 0,
		max: Math.round(daily.temperature_2m_max[i]),
		min: Math.round(daily.temperature_2m_min[i]),
		rain: daily.precipitation_probability_max?.[i] ?? null
	}));

	return {
		city: location.city || localStorage.getItem("bloom-weather-city") || "Current location",
		temperature: Math.round(cur.temperature_2m),
		feelsLike: Math.round(cur.apparent_temperature),
		humidity: Math.round(cur.relative_humidity_2m),
		wind: Math.round(cur.wind_speed_10m),
		condition: WMO_CODES[cur.weather_code] || "Unknown",
		isDay: cur.is_day === 1,
		days
	};
}

export function useForecast(unit: string) {
	const fresh = cache && cache.unit === unit && Date.now() - cache.at < CACHE_TTL_MS;
	const [data, setData] = useState<Forecast | null>(() =>
		cache && cache.unit === unit ? cache.data : null
	);
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
		if (!(cache && cache.unit === unit && Date.now() - cache.at < CACHE_TTL_MS)) {
			void load();
		}
		return () => {
			alive.current = false;
		};
	}, [unit, load]);

	return { data, loading, error, reload: load };
}
