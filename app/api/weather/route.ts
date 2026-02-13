import { NextResponse } from 'next/server';

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';
const POLLEN_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'rain_sum',
  'windspeed_10m_max',
  'uv_index_max',
  'relative_humidity_2m_mean',
].join(',');

const HOURLY_PARAMS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'windspeed_10m',
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

function getWeatherBase(startDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const diffDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 10 ? ARCHIVE_BASE : FORECAST_BASE;
}

function sumNullable(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null;
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
    const weatherBase = getWeatherBase(start);

    const dailyWeatherUrl = `${weatherBase}?latitude=${lat}&longitude=${lon}&daily=${DAILY_PARAMS}&start_date=${start}&end_date=${end}&timezone=auto`;
    const dailyPollenUrl = `${POLLEN_BASE}?latitude=${lat}&longitude=${lon}&daily=${POLLEN_DAILY_PARAMS}&start_date=${start}&end_date=${end}&timezone=auto`;

    const fetches: Promise<Response>[] = [
      fetch(dailyWeatherUrl),
      fetch(dailyPollenUrl),
    ];

    if (focusDay) {
      const hourlyWeatherUrl = `${weatherBase}?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_PARAMS}&start_date=${focusDay}&end_date=${focusDay}&timezone=auto`;
      const hourlyPollenUrl = `${POLLEN_BASE}?latitude=${lat}&longitude=${lon}&hourly=${POLLEN_DAILY_PARAMS}&start_date=${focusDay}&end_date=${focusDay}&timezone=auto`;
      fetches.push(fetch(hourlyWeatherUrl), fetch(hourlyPollenUrl));
    }

    const responses = await Promise.all(fetches);

    for (const res of responses) {
      if (!res.ok) {
        const text = await res.text();
        console.error('Open-Meteo error:', res.status, text);
        return NextResponse.json(
          { error: 'Weather API request failed' },
          { status: 502 },
        );
      }
    }

    const [dailyWeather, dailyPollen] = await Promise.all([
      responses[0].json(),
      responses[1].json(),
    ]);

    // Combine daily weather + pollen into WeatherDay[]
    const dates: string[] = dailyWeather.daily?.time || [];
    const daily = dates.map((date: string, i: number) => ({
      date,
      temperature_max: dailyWeather.daily.temperature_2m_max?.[i] ?? null,
      temperature_min: dailyWeather.daily.temperature_2m_min?.[i] ?? null,
      precipitation_sum: dailyWeather.daily.precipitation_sum?.[i] ?? null,
      rain_sum: dailyWeather.daily.rain_sum?.[i] ?? null,
      windspeed_max: dailyWeather.daily.windspeed_10m_max?.[i] ?? null,
      uv_index_max: dailyWeather.daily.uv_index_max?.[i] ?? null,
      humidity_mean: dailyWeather.daily.relative_humidity_2m_mean?.[i] ?? null,
      pollen_tree: sumNullable([
        dailyPollen.daily?.alder_pollen?.[i],
        dailyPollen.daily?.birch_pollen?.[i],
        dailyPollen.daily?.olive_pollen?.[i],
      ]),
      pollen_grass: dailyPollen.daily?.grass_pollen?.[i] ?? null,
      pollen_weed: sumNullable([
        dailyPollen.daily?.mugwort_pollen?.[i],
        dailyPollen.daily?.ragweed_pollen?.[i],
      ]),
    }));

    // Build hourly data if focus day was requested
    let hourly = null;
    if (focusDay && responses.length >= 4) {
      const [hourlyWeather, hourlyPollen] = await Promise.all([
        responses[2].json(),
        responses[3].json(),
      ]);

      hourly = {
        time: hourlyWeather.hourly?.time || [],
        temperature_2m: hourlyWeather.hourly?.temperature_2m || [],
        relative_humidity_2m: hourlyWeather.hourly?.relative_humidity_2m || [],
        precipitation: hourlyWeather.hourly?.precipitation || [],
        windspeed_10m: hourlyWeather.hourly?.windspeed_10m || [],
        uv_index: hourlyWeather.hourly?.uv_index || [],
      };
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
