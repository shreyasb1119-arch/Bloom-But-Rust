import { MapPin, Droplets, Wind, Thermometer } from "lucide-react";
import { useForecast } from "../hooks/useForecast";
import { getWeatherIcon } from "../hooks/useWeather";

function dayLabel(date: string, isToday: boolean) {
	if (isToday) return "Today";
	return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

export function WeatherPanel({ tempUnit }: { tempUnit: string }) {
	const { data, loading, error, reload } = useForecast(tempUnit);
	const fahrenheit = tempUnit === "fahrenheit";
	const windUnit = fahrenheit ? "mph" : "km/h";

	if (!data) {
		return (
			<div className="wx-panel wx-status">
				{error ? (
					<>
						<span>{error}</span>
						<button type="button" className="wx-retry" onClick={() => void reload()}>
							Try again
						</button>
					</>
				) : (
					<span>{loading ? "Loading forecast…" : "No forecast available."}</span>
				)}
			</div>
		);
	}

	const NowIcon = getWeatherIcon(data.condition, data.isDay);

	return (
		<div className="wx-panel">
			<div className="wx-current">
				<div className="wx-loc">
					<MapPin size={11} strokeWidth={2} />
					<span>{data.city}</span>
				</div>
				<div className="wx-now">
					<NowIcon size={30} strokeWidth={1.75} />
					<span className="wx-temp">{data.temperature}°</span>
					<div className="wx-cond">
						<span className="wx-cond-name">{data.condition}</span>
						<span className="wx-meta">
							<Thermometer size={10} strokeWidth={2} /> Feels {data.feelsLike}°
							<Droplets size={10} strokeWidth={2} /> {data.humidity}%
							<Wind size={10} strokeWidth={2} /> {data.wind} {windUnit}
						</span>
					</div>
				</div>
			</div>
			<div className="wx-days">
				{data.days.map((d) => {
					const Icon = getWeatherIcon(d.condition, true);
					return (
						<div className="wx-day" key={d.date} title={d.condition}>
							<span className="wx-day-label">{dayLabel(d.date, d.isToday)}</span>
							<Icon size={18} strokeWidth={1.75} />
							<span className="wx-hi">{d.max}°</span>
							<span className="wx-lo">{d.min}°</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
