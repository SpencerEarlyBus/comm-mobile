import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { env } from '../utils/env';

export const api = axios.create({ baseURL: env.apiBase });

let isRefreshing = false;
let queue: Array<(t: string) => void> = [];

api.interceptors.request.use(async (config) => {
  const access = await SecureStore.getItemAsync('access_token');
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refresh = await SecureStore.getItemAsync('refresh_token');
          if (!refresh) throw new Error('No refresh token');
          const { data } = await axios.post(`${env.apiBase}/login/refresh-mobile`.replace('/login/', '/'), {
            refresh
          });
          await SecureStore.setItemAsync('access_token', data.access);
          await SecureStore.setItemAsync('refresh_token', data.refresh);
          api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
          queue.forEach(fn => fn(data.access));
          queue = [];
          return api(original);
        } finally {
          isRefreshing = false;
        }
      }

      return new Promise(resolve => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }
    throw error;
  }
);
