const axios = require('axios');

const getWeather = async (lat, lon) => {
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !process.env.WEATHER_API_KEY) {
    return {
      temp: null,
      condition: 'Unknown',
      description: 'Unknown weather',
    };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${process.env.WEATHER_API_KEY}&units=metric`;
    const { data } = await axios.get(url, { timeout: 6000 });
    return {
      temp: Number(data?.main?.temp),
      condition: data?.weather?.[0]?.main || 'Unknown',
      description: data?.weather?.[0]?.description || 'Unknown weather',
    };
  } catch {
    return {
      temp: null,
      condition: 'Unknown',
      description: 'Unknown weather',
    };
  }
};

module.exports = { getWeather };
