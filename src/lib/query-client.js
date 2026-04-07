import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60 * 1000,
			refetchOnMount: false,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
			retryDelay: 2000,
		},
	},
});
