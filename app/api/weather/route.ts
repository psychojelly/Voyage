import { NextResponse } from 'next/server';

// Forecast API covers 92 days of historical data + 16 days ahead
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const POLLEN_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'rain_sum',
  'wind_speed_10m_max',
  'uv_index_max',
  'relative_humidity_2m_max',
  'relative_humidity_2m_min',
].join(',');

const HOURLY_PARAMS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'wind_speed_10m',
  'uv_index',
].join(',');

const POLLEN_DAILY_PARAMS = [
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen',
].join(',');

function sumNullable(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeFetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const focusDay = url.searchParams.get('focus');

  if (!lat || !lon || !start || !end) {
    return NextResponse.json(
      { error: 'Missing required params: lat, lon, start, end' },
      { status: 400 },
    );
  }

  try {
    const dailyWeatherUrl = `${WEATHER_BASE}?latitude=${lat}&longitude=${lon}&daily=${DAILY_PARAMS}&start_date=${start}&end_date=${end}&timezone=auto`;
    const dailyPollenUrl = `${POLLEN_BASE}?latitude=${lat}&longitude=${lon}&daily=${POLLEN_DAILY_PARAMS}&start_date=${start}&end_date=${end}&timezone=auto`;

    // Fetch weather (required) and pollen (optional - not available in all regions)
    const [dailyWeatherRes, dailyPollen] = await Promise.all([
      fetch(dailyWeatherUrl),
      safeFetchJson(dailyPollenUrl),
    ]);

    if (!dailyWeatherRes.ok) {
      const text = await dailyWeatherRes.text();
      console.error('Open-Meteo daily weather error:', dailyWeatherRes.status, text);
      return NextResponse.json(
        { error: `Weather API failed: ${text}` },
        { status: 502 },
      );
    }

    const dailyWeather = await dailyWeatherRes.json();

    // Combine daily weather + pollen into WeatherDay[]
    const dates: string[] = dailyWeather.daily?.time || [];
    const daily = dates.map((date: string, i: number) => ({
      date,
      temperature_max: dailyWeather.daily.temperature_2m_max?.[i] ?? null,
      temperature_min: dailyWeather.daily.temperature_2m_min?.[i] ?? null,
      precipitation_sum: dailyWeather.daily.precipitation_sum?.[i] ?? null,
      rain_sum: dailyWeather.daily.rain_sum?.[i] ?? null,
      windspeed_max: dailyWeather.daily.wind_speed_10m_max?.[i] ?? null,
      uv_index_max: dailyWeather.daily.uv_index_max?.[i] ?? null,
      humidity_mean: dailyWeather.daily.relative_humidity_2m_max?.[i] != null && dailyWeather.daily.relative_humidity_2m_min?.[i] != null
        ? Math.round((dailyWeather.daily.relative_humidity_2m_max[i] + dailyWeather.daily.relative_humidity_2m_min[i]) / 2)
        : null,
      pollen_alder: dailyPollen?.daily?.alder_pollen?.[i] ?? null,
      pollen_birch: dailyPollen?.daily?.birch_pollen?.[i] ?? null,
      pollen_olive: dailyPollen?.daily?.olive_pollen?.[i] ?? null,
      pollen_grass: dailyPollen?.daily?.grass_pollen?.[i] ?? null,
      pollen_mugwort: dailyPollen?.daily?.mugwort_pollen?.[i] ?? null,
      pollen_ragweed: dailyPollen?.daily?.ragweed_pollen?.[i] ?? null,
      pollen_tree: dailyPollen ? sumNullable([
        dailyPollen.daily?.alder_pollen?.[i],
        dailyPollen.daily?.birch_pollen?.[i],
        dailyPollen.daily?.olive_pollen?.[i],
      ]) : null,
      pollen_weed: dailyPollen ? sumNullable([
        dailyPollen.daily?.mugwort_pollen?.[i],
        dailyPollen.daily?.ragweed_pollen?.[i],
      ]) : null,
    }));

    // Build hourly data if focus day was requested
    let hourly = null;
    if (focusDay) {
      const hourlyWeatherUrl = `${WEATHER_BASE}?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_PARAMS}&start_date=${focusDay}&end_date=${focusDay}&timezone=auto`;
      const hourlyWeatherRes = await fetch(hourlyWeatherUrl);

      if (hourlyWeatherRes.ok) {
        const hourlyWeather = await hourlyWeatherRes.json();
        hourly = {
          time: hourlyWeather.hourly?.time || [],
          temperature_2m: hourlyWeather.hourly?.temperature_2m || [],
          relative_humidity_2m: hourlyWeather.hourly?.relative_humidity_2m || [],
          precipitation: hourlyWeather.hourly?.precipitation || [],
          windspeed_10m: hourlyWeather.hourly?.wind_speed_10m || [],
          uv_index: hourlyWeather.hourly?.uv_index || [],
        };
      }
    }

    return NextResponse.json({ daily, hourly });
  } catch (err) {
    console.error('Weather proxy error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 502 },
    );
  }
}
