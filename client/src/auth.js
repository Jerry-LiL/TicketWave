import { useQuery } from '@tanstack/react-query';
import { api, getToken, setToken } from './api';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api('/api/auth/me');
      } catch (error) {
        if (error.status === 401) setToken(null);
        throw error;
      }
    },
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: 60_000,
  });
}
